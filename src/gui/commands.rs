use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::collections::HashMap;
use base64::Engine;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use rayon::prelude::*;
use tauri::Emitter;

use crate::media_management::{storage, metadata, thumbnail};
use crate::import::{dedup, copier};
use crate::gui::config::{load_config, save_config};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoInfo {
    pub path: String,
    pub filename: String,
    pub date: Option<String>,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EXIFData {
    pub camera: Option<String>,
    pub lens: Option<String>,
    pub aperture: Option<String>,
    pub shutter: Option<String>,
    pub iso: Option<String>,
    pub focal_length: Option<String>,
    pub date: Option<String>,
    pub file_type: String,
    pub file_size: u64,
    pub gps: Option<(f64, f64)>,
}

// Thumbnail cache: path -> base64 encoded JPEG
lazy_static::lazy_static! {
    static ref THUMBNAIL_CACHE: Mutex<HashMap<String, String>> = Mutex::new(HashMap::new());
}

#[tauri::command]
pub fn detect_camera() -> Option<String> {
    storage::detect_camera_drive().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn find_photo_folder(drive: String) -> Option<String> {
    let drive_path = PathBuf::from(&drive);
    storage::find_photo_folder(&drive_path).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_all_removable_drives() -> Vec<storage::RemovableDrive> {
    storage::list_all_removable_drives()
}

/// Quick scan without EXIF extraction (instant)
#[tauri::command]
pub fn scan_photos_quick(folder: String) -> Vec<PhotoInfo> {
    let folder_path = PathBuf::from(&folder);
    let paths = storage::list_photos(&folder_path);
    
    paths.into_iter().map(|path| {
        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let file_size = std::fs::metadata(&path)
            .map(|m| m.len())
            .unwrap_or(0);
        
        PhotoInfo {
            path: path.to_string_lossy().to_string(),
            filename,
            date: None,  // No EXIF extraction yet
            file_size,
        }
    }).collect()
}

/// Enrich photos with metadata (EXIF dates) in parallel
#[tauri::command(async)]
pub async fn enrich_photos_metadata_fast(
    folder: String,
    app: tauri::AppHandle,
) -> Result<Vec<PhotoInfo>, String> {
    let folder_path = PathBuf::from(&folder);
    let mut paths = storage::list_photos(&folder_path);
    
    // Sort for deterministic order
    paths.sort();
    
    let _total = paths.len();
    let processed = Arc::new(AtomicUsize::new(0));

    // Process in parallel
    let results: Vec<PhotoInfo> = paths
        .par_iter()
        .map(|path| {
            let filename = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            // Fast EXIF extraction with cache + fallback
            let date = metadata::extract_exif_date_fast(path)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());

            let file_size = std::fs::metadata(&path)
                .map(|m| m.len())
                .unwrap_or(0);

            // Track progress
            let _count = processed.fetch_add(1, Ordering::Relaxed);

            PhotoInfo {
                path: path.to_string_lossy().to_string(),
                filename,
                date,
                file_size,
            }
        })
        .collect();

    // Sort results: by date (newest first), then "Sin fecha" at end
    let mut results = results;
    results.sort_by(|a, b| {
        let date_a = &a.date;
        let date_b = &b.date;

        match (date_a, date_b) {
            (Some(da), Some(db)) => db.cmp(da), // Newest first
            (None, None) => std::cmp::Ordering::Equal,
            (Some(_), None) => std::cmp::Ordering::Less, // Dates before "Sin fecha"
            (None, Some(_)) => std::cmp::Ordering::Greater, // "Sin fecha" at end
        }
    });

    // Emit completion event with organized results
    let _ = app.emit("metadata_ready", &results);

    Ok(results)
}

#[tauri::command]
pub fn scan_photos(folder: String) -> Vec<PhotoInfo> {
    let folder_path = PathBuf::from(&folder);
    let paths = storage::list_photos(&folder_path);
    
    paths.into_iter().map(|path| {
        let filename = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        
        let date = metadata::extract_exif_date(&path)
            .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());
        
        let file_size = std::fs::metadata(&path)
            .map(|m| m.len())
            .unwrap_or(0);
        
        PhotoInfo {
            path: path.to_string_lossy().to_string(),
            filename,
            date,
            file_size,
        }
    }).collect()
}

#[tauri::command]
pub fn get_exif(path: String) -> Option<EXIFData> {
    let file_path = PathBuf::from(&path);
    let metadata = metadata::extract_exif_date(&file_path)?;
    
    let _filename = file_path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    let ext = file_path.extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default()
        .to_uppercase();
    
    let file_size = std::fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);
    
    Some(EXIFData {
        camera: Some("Canon EOS R5".to_string()), // TODO: extract from EXIF
        lens: Some("Canon RF 24-70mm f/2.8L IS USM".to_string()), // TODO
        aperture: Some("f/2.8".to_string()), // TODO
        shutter: Some("1/500s".to_string()), // TODO
        iso: Some("400".to_string()), // TODO
        focal_length: Some("50mm".to_string()), // TODO
        date: Some(metadata.format("%Y-%m-%d %H:%M:%S").to_string()),
        file_type: ext,
        file_size,
        gps: None, // TODO: extract from EXIF
    })
}

#[tauri::command]
pub fn get_thumbnail(path: String) -> Result<String, String> {
    // Check cache first
    if let Ok(cache) = THUMBNAIL_CACHE.lock() {
        if let Some(cached) = cache.get(&path) {
            return Ok(cached.clone());
        }
    }
    
    // Generate thumbnail
    let file_path = PathBuf::from(&path);
    let thumbnail_data = thumbnail::get_thumbnail(&file_path, 200)?;
    
    // Encode to base64
    let engine = base64::engine::general_purpose::STANDARD;
    let base64 = engine.encode(&thumbnail_data);
    let data_url = format!("data:image/jpeg;base64,{}", base64);
    
    // Cache it
    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.insert(path, data_url.clone());
    }
    
    Ok(data_url)
}

#[tauri::command]
pub fn get_config() -> crate::gui::config::AppConfig {
    load_config()
}

#[tauri::command]
pub fn save_config_cmd(config: crate::gui::config::AppConfig) -> Result<(), String> {
    save_config(&config)
}

#[tauri::command]
pub fn import_photos(
    paths: Vec<String>,
    dest: String,
    template: String,
) -> Result<String, String> {
    let dest_path = PathBuf::from(&dest);
    
    let mut imported = 0;
    let mut errors = Vec::new();
    let mut dedup_keys = Vec::new();
    
    for path_str in paths {
        let source_path = PathBuf::from(&path_str);
        
        // Extract EXIF date
        let date = metadata::extract_exif_date(&source_path);
        
        // Check dedup
        match dedup::compute_dedup_key(&source_path) {
            Ok(key) => {
                if dedup::is_duplicate(&key, &dedup_keys) {
                    errors.push(format!("Skipped (duplicate): {}", source_path.file_name().unwrap_or_default().to_string_lossy()));
                    continue;
                }
                dedup_keys.push(key);
            }
            Err(e) => {
                errors.push(format!("Failed hash: {}", e));
                continue;
            }
        }
        
        // Copy with template
        match copier::copy_with_template(&source_path, &dest_path, &template, date) {
            Ok(_) => imported += 1,
            Err(e) => errors.push(format!("Failed: {}", e)),
        }
    }
    
    let summary = format!(
        "Imported {} photos{}",
        imported,
        if errors.is_empty() { "".to_string() } else { format!(" with {} errors", errors.len()) }
    );
    
    Ok(summary)
}
