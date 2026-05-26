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

pub fn get_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
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

fn decode_jpeg_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
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

fn decode_png_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
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

fn extract_embedded_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
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

pub fn get_cache_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("photo_manager")
        .join("thumbnail_cache")
}

pub fn cache_key(path: &Path, width: u32) -> String {
    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    format!("{}_{}", hash.to_hex(), width)
}

fn cache_file_path(key: &str) -> PathBuf {
    get_cache_dir().join(&key[..2]).join(format!("{}.jpg", key))
}

pub fn read_from_disk_cache(path: &Path, width: u32) -> Option<Vec<u8>> {
    let file_path = cache_file_path(&cache_key(path, width));
    fs::read(&file_path).ok()
}

pub fn write_to_disk_cache(path: &Path, width: u32, data: &[u8]) -> Result<(), String> {
    let file_path = cache_file_path(&cache_key(path, width));
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = File::create(&file_path).map_err(|e| e.to_string())?;
    file.write_all(data).map_err(|e| e.to_string())
}
