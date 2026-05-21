use std::fs::File;
use std::io::{Read, Cursor};
use std::path::PathBuf;
use std::collections::HashMap;
use std::time::SystemTime;
use chrono::{NaiveDateTime, Datelike};
use exif::{Reader, Tag, In};
use lazy_static::lazy_static;
use std::sync::Mutex;

lazy_static! {
    static ref EXIF_CACHE: Mutex<HashMap<String, Option<NaiveDateTime>>> = 
        Mutex::new(HashMap::new());
}

/// Generate cache key from file metadata
fn get_cache_key(path: &PathBuf) -> Option<String> {
    let metadata = std::fs::metadata(path).ok()?;
    let size = metadata.len();
    let mtime = metadata.modified()
        .ok()?
        .duration_since(SystemTime::UNIX_EPOCH)
        .ok()?
        .as_secs();
    
    Some(format!("{}_{}", size, mtime))
}

/// Clear cache (useful for testing/refresh)
pub fn clear_exif_cache() {
    if let Ok(mut cache) = EXIF_CACHE.lock() {
        cache.clear();
    }
}

/// Fast EXIF extraction with cache
pub fn extract_exif_date_fast(path: &PathBuf) -> Option<NaiveDateTime> {
    // 1. Check cache first
    if let Some(cache_key) = get_cache_key(path) {
        if let Ok(cache) = EXIF_CACHE.lock() {
            if let Some(&cached_date) = cache.get(&cache_key) {
                return cached_date;
            }
        }
    }

    // 2. Extract with fallbacks
    let result = extract_date_with_fallback(path);

    // 3. Cache the result
    if let Some(cache_key) = get_cache_key(path) {
        if let Ok(mut cache) = EXIF_CACHE.lock() {
            cache.insert(cache_key, result);
        }
    }

    result
}

/// Try EXIF (64KB partial read) then fallback to file modification date
fn extract_date_with_fallback(path: &PathBuf) -> Option<NaiveDateTime> {
    // Try EXIF first (partial read: 64KB)
    if let Some(date) = extract_exif_from_partial_read(path) {
        println!("✅ EXIF date found for: {:?}", path.file_name().unwrap_or_default());
        return Some(date);
    }

    // Fallback: file modification date (immediate, no parsing cost)
    if let Some(date) = get_file_modification_date(path) {
        println!("⏰ Using file modification date for: {:?}", path.file_name().unwrap_or_default());
        return Some(date);
    }

    println!("❌ No date found for: {:?}", path.file_name().unwrap_or_default());
    None
}

/// Extract EXIF from first 64KB of file (EXIF is always at start)
fn extract_exif_from_partial_read(path: &PathBuf) -> Option<NaiveDateTime> {
    let file = File::open(path).ok()?;
    
    // Only read first 64KB (EXIF metadata is at start of file)
    let mut limited_reader = file.take(65536);
    let mut buffer = Vec::new();
    limited_reader.read_to_end(&mut buffer).ok()?;

    // Parse EXIF from buffer
    let mut cursor = Cursor::new(buffer);
    let exifreader = Reader::new()
        .read_from_container(&mut cursor)
        .ok()?;

    // Try tags in priority order
    for tag in [
        Tag::DateTimeOriginal,
        Tag::DateTimeDigitized,
        Tag::DateTime,
    ] {
        if let Some(field) = exifreader.get_field(tag, In::PRIMARY) {
            if let Ok(date) = parse_exif_date(&field.display_value().to_string()) {
                return Some(date);
            }
        }
    }

    None
}

/// Get file modification date as fallback
fn get_file_modification_date(path: &PathBuf) -> Option<NaiveDateTime> {
    let metadata = std::fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    let duration = modified.duration_since(SystemTime::UNIX_EPOCH).ok()?;
    let secs = duration.as_secs() as i64;

    NaiveDateTime::from_timestamp_opt(secs, 0)
}

/// Parse EXIF date string (format: "2025:08:09 14:22:30")
fn parse_exif_date(raw: &str) -> Result<NaiveDateTime, Box<dyn std::error::Error>> {
    Ok(NaiveDateTime::parse_from_str(raw, "%Y:%m:%d %H:%M:%S")?)
}

/// Deprecated: extract_exif_date (use extract_exif_date_fast instead)
pub fn extract_exif_date(path: &PathBuf) -> Option<NaiveDateTime> {
    extract_exif_date_fast(path)
}

//Esto me sirve para poder imprimir el struct para debuggear
#[derive(Debug, Clone)]
pub struct PhotoMetadata {
    pub path: PathBuf,
    pub date_time: Option<NaiveDateTime>,
}

impl PhotoMetadata {
    pub fn year(&self) -> Option<i32> {
        self.date_time.map(|d| d.year())
    }

    pub fn formatted_day(&self) -> Option<String> {
        self.date_time
            .map(|d| format!("{:02}-{:02}-{}", d.day(), d.month(), d.year()))
    }
}
