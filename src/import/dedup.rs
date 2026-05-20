use std::path::PathBuf;
use blake3::hash;
use std::fs::File;
use std::io::Read;

/// Fast hash dedup: hash first 64KB + filename
pub fn compute_dedup_key(path: &PathBuf) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut buffer = vec![0; 65536]; // 64KB
    let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
    buffer.truncate(n);
    
    let hash_value = hash(&buffer).to_hex();
    let filename = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    
    Ok(format!("{}_{}", hash_value, filename))
}

/// Check if file already exists by dedup key
pub fn is_duplicate(dedup_key: &str, existing_dedup_keys: &[String]) -> bool {
    existing_dedup_keys.iter().any(|k| k == dedup_key)
}
