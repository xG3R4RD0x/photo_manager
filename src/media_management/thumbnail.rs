use std::path::{Path, PathBuf};
use std::fs::{self, File};
use std::io::{BufReader, Seek, SeekFrom, Read, Cursor, Write};
use exif::{Reader, Tag, In};

const RAW_EXTENSIONS: &[&str] = &[
    "3fr", "arw", "cr2", "cr3", "crw", "dcr", "dng", "erf",
    "fff", "gpr", "iiq", "k25", "kdc", "mdc", "mef", "mos", "mrw",
    "nef", "nrw", "orf", "ori", "pef", "raf", "raw", "rdc",
    "rw2", "rwl", "sr2", "srf", "srw", "x3f",
];

pub fn get_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => decode_jpeg_thumbnail(path, width),
        "png" => decode_png_thumbnail(path, width),
        ext if RAW_EXTENSIONS.contains(&ext) => extract_embedded_thumbnail(path, width),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

fn decode_jpeg_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    use jpeg_decoder::Decoder;

    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut decoder = Decoder::new(BufReader::new(file));

    let (decoded_w, decoded_h) = decoder.scale(width as u16, width as u16)
        .map_err(|e| e.to_string())?;

    let pixels = decoder.decode().map_err(|e| e.to_string())?;

    let img = image::DynamicImage::ImageRgb8(
        image::RgbImage::from_raw(decoded_w as u32, decoded_h as u32, pixels)
            .ok_or("Failed to create image")?,
    );

    let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
    encode_jpeg(&resized, 80)
}

fn decode_png_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    let img = image::ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;

    let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
    encode_jpeg(&resized, 80)
}

fn encode_jpeg(img: &image::DynamicImage, quality: u8) -> Result<Vec<u8>, String> {
    use image::codecs::jpeg::JpegEncoder;

    let mut buf = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut buf, quality);
    encoder
        .encode(
            img.as_bytes(),
            img.width(),
            img.height(),
            image::ExtendedColorType::Rgb8,
        )
        .map_err(|e| e.to_string())?;
    Ok(buf)
}

fn extract_embedded_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);

    let exif = Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| format!("Failed to read EXIF: {:?}", e))?;

    if let Some(offset_field) = exif.get_field(Tag::JPEGInterchangeFormat, In::THUMBNAIL) {
        if let Some(length_field) = exif.get_field(Tag::JPEGInterchangeFormatLength, In::THUMBNAIL) {
            let offset = match &offset_field.value {
                exif::Value::Long(v) if !v.is_empty() => v[0] as u64,
                exif::Value::Short(v) if !v.is_empty() => v[0] as u64,
                _ => return Err("Invalid JPEG offset".to_string()),
            };

            let length = match &length_field.value {
                exif::Value::Long(v) if !v.is_empty() => v[0] as usize,
                exif::Value::Short(v) if !v.is_empty() => v[0] as usize,
                _ => return Err("Invalid JPEG length".to_string()),
            };

            let mut file2 = File::open(path).map_err(|e| e.to_string())?;
            file2.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;

            let mut jpeg_data = vec![0u8; length];
            file2.read_exact(&mut jpeg_data).map_err(|e| e.to_string())?;

            let mut reader = image::ImageReader::new(Cursor::new(&jpeg_data));
            reader.set_format(image::ImageFormat::Jpeg);
            let img = reader.decode().map_err(|e| e.to_string())?;

            let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
            return encode_jpeg(&resized, 80);
        }
    }

    Err("No embedded JPEG found in RAW file. Full RAW conversion not yet implemented.".to_string())
}

pub fn cache_key(path: &Path, width: u32) -> String {
    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    format!("{}_{}", hash.to_hex(), width)
}

pub fn thumbnail_dir(photo_path: &Path) -> PathBuf {
    photo_path.parent()
        .unwrap_or_else(|| Path::new("."))
        .join(".thumbnails")
}

pub fn read_from_disk_cache(path: &Path, width: u32) -> Option<Vec<u8>> {
    let file_path = thumbnail_dir(path).join(format!("{}.jpg", cache_key(path, width)));
    fs::read(&file_path).ok()
}

pub fn write_to_disk_cache(path: &Path, width: u32, data: &[u8]) -> Result<(), String> {
    let dir = thumbnail_dir(path);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file_path = dir.join(format!("{}.jpg", cache_key(path, width)));
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(data).map_err(|e| e.to_string())
}

// ── Unified memory + disk cache ─────────────────────────────

use std::sync::Mutex;
use std::collections::HashMap;

lazy_static::lazy_static! {
    static ref THUMBNAIL_CACHE: ThumbnailCache = ThumbnailCache::new();
}

pub fn thumbnail_cache() -> &'static ThumbnailCache {
    &THUMBNAIL_CACHE
}

pub fn get_display_image(path: &Path, max_pixels: u32, quality: u8) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => decode_jpeg_display(path, max_pixels, quality),
        "png" => decode_png_display(path, max_pixels, quality),
        ext if RAW_EXTENSIONS.contains(&ext) => decode_raw_display(path, max_pixels, quality),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

fn resize_to_fit(img: &image::DynamicImage, max_pixels: u32) -> image::DynamicImage {
    let (w, h) = (img.width(), img.height());
    if w <= max_pixels && h <= max_pixels {
        return img.clone();
    }
    let ratio = (max_pixels as f64 / w.max(h) as f64).min(1.0);
    let new_w = (w as f64 * ratio).round() as u32;
    let new_h = (h as f64 * ratio).round() as u32;
    img.resize(new_w, new_h, image::imageops::FilterType::Triangle)
}

fn decode_jpeg_display(path: &Path, max_pixels: u32, quality: u8) -> Result<Vec<u8>, String> {
    use jpeg_decoder::Decoder;

    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut decoder = Decoder::new(BufReader::new(file));

    let (decoded_w, decoded_h) = decoder.scale(max_pixels as u16, max_pixels as u16)
        .map_err(|e| e.to_string())?;

    let pixels = decoder.decode().map_err(|e| e.to_string())?;

    let img = image::DynamicImage::ImageRgb8(
        image::RgbImage::from_raw(decoded_w as u32, decoded_h as u32, pixels)
            .ok_or("Failed to create image")?,
    );

    let resized = resize_to_fit(&img, max_pixels);
    encode_jpeg(&resized, quality)
}

fn decode_png_display(path: &Path, max_pixels: u32, quality: u8) -> Result<Vec<u8>, String> {
    let img = image::ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .decode()
        .map_err(|e| e.to_string())?;
    let resized = resize_to_fit(&img, max_pixels);
    encode_jpeg(&resized, quality)
}

fn decode_raw_display(path: &Path, max_pixels: u32, quality: u8) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);

    let exif = Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| format!("Failed to read EXIF: {:?}", e))?;

    let offset_field = exif.get_field(Tag::JPEGInterchangeFormat, In::THUMBNAIL)
        .ok_or("No embedded JPEG thumbnail offset")?;
    let length_field = exif.get_field(Tag::JPEGInterchangeFormatLength, In::THUMBNAIL)
        .ok_or("No embedded JPEG thumbnail length")?;

    let offset = match &offset_field.value {
        exif::Value::Long(v) if !v.is_empty() => v[0] as u64,
        exif::Value::Short(v) if !v.is_empty() => v[0] as u64,
        _ => return Err("Invalid JPEG offset".to_string()),
    };

    let length = match &length_field.value {
        exif::Value::Long(v) if !v.is_empty() => v[0] as usize,
        exif::Value::Short(v) if !v.is_empty() => v[0] as usize,
        _ => return Err("Invalid JPEG length".to_string()),
    };

    let mut file2 = File::open(path).map_err(|e| e.to_string())?;
    file2.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;

    let mut jpeg_data = vec![0u8; length];
    file2.read_exact(&mut jpeg_data).map_err(|e| e.to_string())?;

    let mut reader = image::ImageReader::new(Cursor::new(&jpeg_data));
    reader.set_format(image::ImageFormat::Jpeg);
    let img = reader.decode().map_err(|e| e.to_string())?;

    let resized = resize_to_fit(&img, max_pixels);
    encode_jpeg(&resized, quality)
}

pub struct ThumbnailCache {
    memory: Mutex<HashMap<String, Vec<u8>>>,
}

impl ThumbnailCache {
    pub fn new() -> Self {
        ThumbnailCache {
            memory: Mutex::new(HashMap::new()),
        }
    }

    pub fn get(&self, path: &Path, width: u32) -> Option<Vec<u8>> {
        let key = cache_key(path, width);

        if let Ok(mem) = self.memory.lock() {
            if let Some(data) = mem.get(&key) {
                return Some(data.clone());
            }
        }

        if let Some(data) = read_from_disk_cache(path, width) {
            if let Ok(mut mem) = self.memory.lock() {
                mem.insert(key, data.clone());
            }
            return Some(data);
        }

        None
    }

    pub fn insert(&self, path: &Path, width: u32, data: &[u8]) {
        let key = cache_key(path, width);
        if let Ok(mut mem) = self.memory.lock() {
            mem.insert(key, data.to_vec());
        }
        let _ = write_to_disk_cache(path, width, data);
    }

    pub fn get_or_generate(&self, path: &Path, width: u32) -> Result<Vec<u8>, String> {
        if let Some(cached) = self.get(path, width) {
            return Ok(cached);
        }
        let data = get_thumbnail(path, width)?;
        self.insert(path, width, &data);
        Ok(data)
    }

    pub fn get_or_generate_display(&self, path: &Path, max_pixels: u32, quality: u8) -> Result<Vec<u8>, String> {
        let key = format!("{}_display_{}_{}", cache_key(path, 0), max_pixels, quality);

        if let Ok(mem) = self.memory.lock() {
            if let Some(data) = mem.get(&key) {
                return Ok(data.clone());
            }
        }

        let data = get_display_image(path, max_pixels, quality)?;

        if let Ok(mut mem) = self.memory.lock() {
            mem.insert(key, data.clone());
        }

        Ok(data)
    }
}
