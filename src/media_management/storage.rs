use sysinfo::Disks;
use walkdir::WalkDir;
use std::path::PathBuf;
use std::fs;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemovableDrive {
    pub mount_point: String,
    pub label: String,
    pub total_size: u64,
    pub used_size: u64,
    pub is_camera: bool,
}

/// Detecta la primera unidad extraíble (USB / cámara / SD)
pub fn detect_camera_drive() -> Option<PathBuf> {
    let disks = Disks::new_with_refreshed_list();

    for disk in &disks {
        if disk.is_removable() {
            let mount_point = disk.mount_point().to_path_buf();
            println!("Unidad extraíble detectada: {:?}", mount_point);
            return Some(mount_point);
        }
    }

    println!("No se detectó ninguna unidad extraíble.");
    None
}

/// List ALL removable drives with camera detection
pub fn list_all_removable_drives() -> Vec<RemovableDrive> {
    let disks = Disks::new_with_refreshed_list();
    let mut drives = Vec::new();

    for disk in &disks {
        if disk.is_removable() {
            let mount_point = disk.mount_point().to_path_buf();
            let label = disk.name()
                .to_string_lossy()
                .to_string();
            
            // Check if it's a camera (has DCIM or photos folder)
            let is_camera = find_photo_folder(&mount_point).is_some();

            let total_size = disk.total_space();
            let available = disk.available_space();
            let used_size = if total_size > available {
                total_size - available
            } else {
                0
            };

            drives.push(RemovableDrive {
                mount_point: mount_point.to_string_lossy().to_string(),
                label: if label.is_empty() { 
                    mount_point.to_string_lossy().to_string() 
                } else { 
                    label 
                },
                total_size,
                used_size,
                is_camera,
            });
        }
    }

    // Sort: cameras first, then by label
    drives.sort_by(|a, b| {
        if a.is_camera != b.is_camera {
            b.is_camera.cmp(&a.is_camera)
        } else {
            a.label.cmp(&b.label)
        }
    });

    drives
}

/// Busca la carpeta con fotos (por defecto DCIM) dentro del disco
pub fn find_photo_folder(drive_path: &PathBuf) -> Option<PathBuf> {
    let entries = fs::read_dir(drive_path).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            let name = path.file_name()?.to_string_lossy().to_lowercase();
            if name.contains("dcim") || name.contains("photos") {
                println!("Carpeta de fotos encontrada: {:?}", path);
                return Some(path);
            }
        }
    }
    None
}

pub fn list_photos(folder_path: &PathBuf) -> Vec<PathBuf> {
    let mut photos = Vec::new();
    for entry in WalkDir::new(folder_path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
    {
        if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if matches!(ext_lower.as_str(), "jpg" | "jpeg" | "png" | "cr2" | "nef" | "arw" | "raf") {
                photos.push(entry.path().to_path_buf());
            }
        }
    }
    photos
}
