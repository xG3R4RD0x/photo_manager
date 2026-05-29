use sysinfo::Disks;
use walkdir::WalkDir;
use std::path::PathBuf;
use std::fs;
use serde::{Serialize, Deserialize};
use ignore::gitignore::{Gitignore, GitignoreBuilder};

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

/// Load the photoignore file from the config directory.
/// Creates the file with default rules if it doesn't exist.
pub fn load_photoignore(source_root: &PathBuf) -> Gitignore {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("photo-manager");
    let photoignore_path = config_dir.join("photoignore");

    // Create default file on first run
    if !photoignore_path.exists() {
        std::fs::create_dir_all(&config_dir).ok();
        let defaults = "\
# Folders starting with . (thumbnails, trash, macOS metadata)
.*

# Windows thumbnail cache
Thumbs.db

# Windows Recycle Bin
$RECYCLE.BIN/

# Windows system folder
System Volume Information/

# macOS metadata directories and files
__MACOSX/
.DS_Store
";
        std::fs::write(&photoignore_path, defaults).ok();
    }

    let mut builder = GitignoreBuilder::new(source_root);

    // Read user patterns from file — skip comments and blanks
    if let Ok(content) = std::fs::read_to_string(&photoignore_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            // Ignore errors from invalid patterns so the file is resilient
            let _ = builder.add_line(None, trimmed);
        }
    }

    builder.build().unwrap_or(Gitignore::empty())
}

pub fn list_photos(folder_path: &PathBuf, photoignore: &Gitignore) -> Vec<PathBuf> {
    let mut photos = Vec::new();
    for entry in WalkDir::new(folder_path)
        .into_iter()
        .filter_entry(|e| {
            let path = e.path();
            let is_dir = e.file_type().is_dir();
            !photoignore.matched(path, is_dir).is_ignore()
        })
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

#[cfg(test)]
mod tests {
    use super::*;
    use ignore::gitignore::Gitignore;
    use std::fs;

    fn test_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(name);
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn test_list_photos_ignores_dot_dirs() {
        let root = test_dir("photoignore_test_dot_dirs");

        fs::create_dir_all(root.join(".thumbnails")).unwrap();
        fs::create_dir_all(root.join("keep")).unwrap();
        fs::write(root.join(".thumbnails/photo.jpg"), b"fake").unwrap();
        fs::write(root.join("keep/photo.jpg"), b"fake").unwrap();

        let mut builder = GitignoreBuilder::new(&root);
        builder.add_line(None, ".*").unwrap();
        let photoignore = builder.build().unwrap();

        let result = list_photos(&root, &photoignore);
        let paths: Vec<String> = result.iter()
            .map(|p| p.strip_prefix(&root).unwrap().to_string_lossy().to_string())
            .collect();

        assert!(!paths.iter().any(|p| p.contains(".thumbnails")),
            "Expected .thumbnails/photo.jpg to be ignored, got: {:?}", paths);
        assert!(paths.iter().any(|p| p.contains("keep")),
            "Expected keep/photo.jpg to be included, got: {:?}", paths);
        assert_eq!(paths.len(), 1, "Expected exactly 1 photo, got {:?}", paths);
    }

    #[test]
    fn test_list_photos_negation() {
        let root = test_dir("photoignore_test_negation");

        fs::create_dir_all(root.join(".hidden/keep")).unwrap();
        fs::write(root.join(".hidden/keep/photo.jpg"), b"fake").unwrap();
        fs::write(root.join(".hidden/also_ignored.jpg"), b"fake").unwrap();

        let mut builder = GitignoreBuilder::new(&root);
        builder.add_line(None, ".*").unwrap();
        builder.add_line(None, "!.hidden/keep").unwrap();
        let photoignore = builder.build().unwrap();

        let result = list_photos(&root, &photoignore);
        let paths: Vec<String> = result.iter()
            .map(|p| p.strip_prefix(&root).unwrap().to_string_lossy().to_string())
            .collect();

        assert!(paths.iter().any(|p| p.contains("keep")),
            "Expected .hidden/keep/photo.jpg re-included, got: {:?}", paths);
        assert!(!paths.iter().any(|p| p.contains("also_ignored")),
            "Expected .hidden/also_ignored.jpg ignored, got: {:?}", paths);
    }

    #[test]
    fn test_list_photos_no_ignore_all_included() {
        let root = test_dir("photoignore_test_all_included");

        fs::create_dir_all(root.join("a")).unwrap();
        fs::write(root.join("a/photo.jpg"), b"fake").unwrap();
        fs::write(root.join("b.jpg"), b"fake").unwrap();

        let photoignore = Gitignore::empty();

        let result = list_photos(&root, &photoignore);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_list_photos_skips_non_photo_extensions() {
        let root = test_dir("photoignore_test_extensions");

        fs::write(root.join("readme.txt"), b"text").unwrap();
        fs::write(root.join("photo.jpg"), b"fake").unwrap();
        fs::write(root.join("photo.png"), b"fake").unwrap();

        let photoignore = Gitignore::empty();

        let result = list_photos(&root, &photoignore);
        assert_eq!(result.len(), 2);
    }
}
