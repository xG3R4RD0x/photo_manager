use std::path::PathBuf;

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
