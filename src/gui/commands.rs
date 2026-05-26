use std::path::PathBuf;
use serde::{Serialize, Deserialize};
use std::sync::Mutex;
use std::collections::HashMap;
use base64::Engine;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::fs;
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

    // Sort results: by date (newest first), tie-break by filename
    let mut results = results;
    results.sort_by(|a, b| {
        match (&a.date, &b.date) {
            (Some(da), Some(db)) => match db.cmp(da) {
                std::cmp::Ordering::Equal => a.filename.cmp(&b.filename),
                other => other,
            },
            (None, None) => a.filename.cmp(&b.filename),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
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
    let full = metadata::extract_full_exif(&file_path)?;

    let ext = file_path.extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default()
        .to_uppercase();

    let file_size = std::fs::metadata(&file_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Some(EXIFData {
        camera: full.camera,
        lens: full.lens,
        aperture: full.aperture,
        shutter: full.shutter,
        iso: full.iso,
        focal_length: full.focal_length,
        date: full.date,
        file_type: ext,
        file_size,
        gps: full.gps,
    })
}

#[tauri::command]
pub fn get_thumbnail(path: String) -> Result<String, String> {
    if let Ok(cache) = THUMBNAIL_CACHE.lock() {
        if let Some(cached) = cache.get(&path) {
            return Ok(cached.clone());
        }
    }

    let file_path = PathBuf::from(&path);
    let width = 200u32;

    if let Some(disk_data) = thumbnail::read_from_disk_cache(&file_path, width) {
        let engine = base64::engine::general_purpose::STANDARD;
        let base64 = engine.encode(&disk_data);
        let data_url = format!("data:image/jpeg;base64,{}", base64);
        if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
            cache.insert(path, data_url.clone());
        }
        return Ok(data_url);
    }

    let thumbnail_data = thumbnail::get_thumbnail(&file_path, width)?;
    let _ = thumbnail::write_to_disk_cache(&file_path, width, &thumbnail_data);

    let engine = base64::engine::general_purpose::STANDARD;
    let base64 = engine.encode(&thumbnail_data);
    let data_url = format!("data:image/jpeg;base64,{}", base64);

    if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
        cache.insert(path, data_url.clone());
    }

    Ok(data_url)
}

/// New event-based thumbnail generation command
/// Emits 'thumbnail_ready' or 'thumbnail_failed' events
#[tauri::command]
pub fn generate_thumbnail(path: String, app: tauri::AppHandle) {
    // Check cache first
    if let Ok(cache) = THUMBNAIL_CACHE.lock() {
        if let Some(cached) = cache.get(&path) {
            let _ = app.emit("thumbnail_ready", serde_json::json!({
                "path": path.clone(),
                "base64": cached.clone(),
            }));
            return;
        }
    }
    
    // Spawn background thread to avoid blocking
    std::thread::spawn(move || {
        match generate_thumbnail_impl(&path) {
            Ok(data_url) => {
                // Cache it
                if let Ok(mut cache) = THUMBNAIL_CACHE.lock() {
                    cache.insert(path.clone(), data_url.clone());
                }
                
                let _ = app.emit("thumbnail_ready", serde_json::json!({
                    "path": path,
                    "base64": data_url,
                }));
            }
            Err(err) => {
                let _ = app.emit("thumbnail_failed", serde_json::json!({
                    "path": path,
                    "reason": err,
                }));
            }
        }
    });
}

fn generate_thumbnail_impl(path: &str) -> Result<String, String> {
    let file_path = PathBuf::from(path);
    let width = 200u32;

    if let Some(disk_data) = thumbnail::read_from_disk_cache(&file_path, width) {
        let engine = base64::engine::general_purpose::STANDARD;
        let base64 = engine.encode(&disk_data);
        return Ok(format!("data:image/jpeg;base64,{}", base64));
    }

    let thumbnail_data = thumbnail::get_thumbnail(&file_path, width)?;
    let _ = thumbnail::write_to_disk_cache(&file_path, width, &thumbnail_data);

    let engine = base64::engine::general_purpose::STANDARD;
    let base64 = engine.encode(&thumbnail_data);
    Ok(format!("data:image/jpeg;base64,{}", base64))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThumbnailCacheEntry {
    pub path: String,
    pub base64: String,
}

#[tauri::command]
pub fn load_thumbnail_cache(dest_folder: String) -> Result<Vec<ThumbnailCacheEntry>, String> {
    let folder_path = PathBuf::from(&dest_folder);
    let paths = storage::list_photos(&folder_path);

    let mut entries = Vec::new();
    let engine = base64::engine::general_purpose::STANDARD;

    for path in paths {
        if let Some(disk_data) = thumbnail::read_from_disk_cache(&path, 200) {
            let base64 = engine.encode(&disk_data);
            let data_url = format!("data:image/jpeg;base64,{}", base64);
            entries.push(ThumbnailCacheEntry {
                path: path.to_string_lossy().to_string(),
                base64: data_url,
            });
        }
    }

    Ok(entries)
}

#[tauri::command]
pub fn cleanup_thumbnail_cache(dest_folder: String) -> Result<String, String> {
    let folder_path = PathBuf::from(&dest_folder);
    let paths = storage::list_photos(&folder_path);

    let valid_keys: std::collections::HashSet<String> = paths.iter()
        .map(|p| thumbnail::cache_key(p, 200))
        .collect();

    let cache_dir = thumbnail::get_cache_dir();
    if !cache_dir.exists() {
        return Ok("No cache to clean".to_string());
    }

    let mut cleaned = 0u32;

    if let Ok(read_dir) = fs::read_dir(&cache_dir) {
        for dir_entry in read_dir.filter_map(|e| e.ok()) {
            if !dir_entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                continue;
            }
            if let Ok(files) = fs::read_dir(dir_entry.path()) {
                for file in files.filter_map(|e| e.ok()) {
                    let file_path = file.path();
                    if file_path.extension().and_then(|e| e.to_str()) != Some("jpg") {
                        continue;
                    }
                    let file_stem = file_path.file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");
                    if !valid_keys.contains(file_stem) {
                        let _ = fs::remove_file(&file_path);
                        cleaned += 1;
                    }
                }
            }
        }
    }

    Ok(format!("Cleaned {} stale cache entries", cleaned))
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
pub fn get_pictures_folder() -> Result<String, String> {
    dirs::picture_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine pictures folder".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirEntry {
    pub name: String,
    pub children: Vec<DirEntry>,
}

#[tauri::command]
pub fn list_directory_tree(path: String) -> Result<DirEntry, String> {
    let root = std::path::PathBuf::from(&path);
    let name = root.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    Ok(DirEntry {
        name,
        children: scan_dir(&root, 2),
    })
}

fn scan_dir(dir: &std::path::PathBuf, depth: u32) -> Vec<DirEntry> {
    if depth == 0 { return vec![]; }

    let mut entries = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(dir) {
        for entry in read_dir.filter_map(|e| e.ok()) {
            if let Ok(ftype) = entry.file_type() {
                if ftype.is_dir() {
                    let child_path = entry.path();
                    entries.push(DirEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        children: scan_dir(&child_path, depth - 1),
                    });
                }
            }
        }
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    entries
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

#[derive(Clone, serde::Serialize)]
struct DupProgress {
    current: usize,
    total: usize,
}

#[tauri::command]
pub fn start_duplicate_check(
    paths: Vec<String>,
    subfolders: Vec<String>,
    dest: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let dest_base = PathBuf::from(&dest);
        let total = paths.len();

        if total == 0 {
            let _ = app.emit("duplicate_check_done", ());
            return;
        }

        let mut found: Vec<String> = Vec::new();

        for (i, (path, folder)) in paths.iter().zip(subfolders.iter()).enumerate() {
            // Emit progress every 50 files to avoid flooding the event loop
            if i % 50 == 0 || i == total - 1 {
                let _ = app.emit(
                    "duplicate_check_progress",
                    DupProgress {
                        current: i + 1,
                        total,
                    },
                );
            }

            if let Some(name) = PathBuf::from(path).file_name() {
                let candidate = dest_base.join(folder).join(name);
                if candidate.exists() {
                    found.push(path.clone());
                }
            }
        }

        // Emit all duplicates in a single batch
        let _ = app.emit("duplicate_found_batch", found);
        let _ = app.emit("duplicate_check_done", ());
    });

    Ok(())
}
