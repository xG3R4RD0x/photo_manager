use std::path::PathBuf;

use crate::media_management::storage;

/// Simple filename-based dedup key
pub fn compute_dedup_key(path: &PathBuf) -> Result<String, String> {
    path.file_name()
        .map(|n| n.to_string_lossy().to_string())
        .ok_or_else(|| "No filename".to_string())
}

/// Check if file already exists by dedup key
pub fn is_duplicate(dedup_key: &str, existing_dedup_keys: &[String]) -> bool {
    existing_dedup_keys.iter().any(|k| k == dedup_key)
}

/// Collect filenames from all photos in a folder
pub fn compute_dedup_keys_for_folder(folder: &PathBuf) -> Vec<String> {
    let paths = storage::list_photos(folder);
    paths
        .iter()
        .filter_map(|path| compute_dedup_key(path).ok())
        .collect()
}
