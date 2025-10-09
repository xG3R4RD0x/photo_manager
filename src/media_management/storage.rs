use sysinfo::Disks;
use walkdir::WalkDir;
use std::path::PathBuf;
use std::fs;

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

pub fn count_photos(folder_path: &PathBuf) -> usize {
    let mut count = 0;
    for entry in WalkDir::new(folder_path)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_file())
    {
        if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
            let ext_lower = ext.to_lowercase();
            if matches!(ext_lower.as_str(), "jpg" | "jpeg" | "png" | "cr2" | "nef" | "arw" | "raf") {
                count += 1;
            }
        }
    }
    count
}
