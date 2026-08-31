use std::path::Path;
use std::fs::{self, File};
use std::io::{BufReader, Cursor, Write};
use exif::{Reader, Tag, In};

const RAW_EXTENSIONS: &[&str] = &[
    "3fr", "arw", "cr2", "cr3", "crw", "dcr", "dng", "erf",
    "fff", "gpr", "iiq", "k25", "kdc", "mdc", "mef", "mos", "mrw",
    "nef", "nrw", "orf", "ori", "pef", "raf", "raw", "rdc",
    "rw2", "rwl", "sr2", "srf", "srw", "x3f",
];

/// Timestamp (seconds) into a video at which to extract a thumbnail frame.
pub const VIDEO_THUMBNAIL_TIMESTAMP_SEC: f64 = 1.0;

pub fn get_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => decode_jpeg_thumbnail(path, width),
        "png" => decode_png_thumbnail(path, width),
        ext if RAW_EXTENSIONS.contains(&ext) => extract_embedded_thumbnail(path, width),
        _ if crate::media_management::video::is_video(path) => generate_video_thumbnail_bytes(path, width),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

/// Extract a video thumbnail.
///
/// Priority:
///   1. A JPEG thumbnail embedded in the video file (XAVC/AVCHD carry one).
///   2. Fallback: extract a frame via ffmpeg at VIDEO_THUMBNAIL_TIMESTAMP_SEC.
fn generate_video_thumbnail_bytes(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    // Try the embedded JPEG first (fast, no ffmpeg subprocess needed).
    if let Ok(img) = extract_video_embedded_thumbnail(path, width) {
        return Ok(img);
    }

    // Fallback: ffmpeg frame extraction.
    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    let thumb_dir = std::env::temp_dir().join("photo_manager_video_thumbs");
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    let tmp_jpeg = thumb_dir.join(format!("{}_{}.jpg", hash.to_hex(), width));

    crate::media_management::video::extract_video_thumbnail(
        path,
        &tmp_jpeg,
        VIDEO_THUMBNAIL_TIMESTAMP_SEC,
        width,
    )?;

    let data = fs::read(&tmp_jpeg).map_err(|e| e.to_string())?;
    Ok(data)
}

/// Extract a JPEG thumbnail embedded in a video file (e.g. Sony XAVC), if present.
///
/// AVCHD/XAVC containers carry a small JPEG preview near the `moov` metadata
/// atom, which typically sits at the start or end of the file. We read only the
/// first/last regions (never the whole video), scan them for JPEG markers
/// (0xFFD8...0xFFD9) and decode the largest candidate. Returns Err if none.
fn extract_video_embedded_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    use std::io::{Read, Seek, SeekFrom};

    let file_len = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    let mut file = File::open(path).map_err(|e| e.to_string())?;

    const FRONT: u64 = 16 * 1024 * 1024; // 16 MiB from the start
    const BACK: u64 = 16 * 1024 * 1024; // 16 MiB from the end

    let mut data = Vec::new();

    // Read the head.
    let to_read = file_len.min(FRONT) as usize;
    let mut head = vec![0u8; to_read];
    file.read_exact(&mut head).map_err(|e| e.to_string())?;
    data.extend_from_slice(&head);

    // Read the tail (if it doesn't overlap the head).
    if file_len > FRONT {
        let tail_start = file_len.saturating_sub(BACK);
        file.seek(SeekFrom::Start(tail_start)).map_err(|e| e.to_string())?;
        let tail_len = (file_len - tail_start) as usize;
        let mut tail = vec![0u8; tail_len];
        file.read_exact(&mut tail).map_err(|e| e.to_string())?;
        data.extend_from_slice(&tail);
    }

    if let Some(img) = scan_embedded_jpeg(&data, width, FRONT as usize, BACK as usize) {
        let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
        return encode_jpeg(&resized, 80);
    }

    Err("No embedded JPEG found in video".to_string())
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

fn extract_exif_thumbnail_bytes(data: &[u8]) -> Option<Vec<u8>> {
    let mut cursor = Cursor::new(data);
    let exif = Reader::new().read_from_container(&mut cursor).ok()?;

    let offset_field = exif.get_field(Tag::JPEGInterchangeFormat, In::THUMBNAIL)?;
    let length_field = exif.get_field(Tag::JPEGInterchangeFormatLength, In::THUMBNAIL)?;

    let offset = match &offset_field.value {
        exif::Value::Long(v) if !v.is_empty() => v[0] as usize,
        exif::Value::Short(v) if !v.is_empty() => v[0] as usize,
        _ => return None,
    };
    let length = match &length_field.value {
        exif::Value::Long(v) if !v.is_empty() => v[0] as usize,
        exif::Value::Short(v) if !v.is_empty() => v[0] as usize,
        _ => return None,
    };

    if offset + length <= data.len() {
        Some(data[offset..offset + length].to_vec())
    } else {
        None
    }
}

fn scan_embedded_jpeg(data: &[u8], max_dim: u32, front_bytes: usize, back_bytes: usize) -> Option<image::DynamicImage> {
    use jpeg_decoder::Decoder;

    let len = data.len();
    let scan_chunks = [
        0..len.min(front_bytes),
        len.saturating_sub(back_bytes)..len,
    ];

    let mut best_pixels = 0u64;
    let mut best_img = None;

    for range in &scan_chunks {
        let mut pos = range.start;
        while pos + 1 < range.end && pos + 1 < len {
            if data[pos] == 0xFF && data[pos + 1] == 0xD8 {
                let mut decoder = Decoder::new(Cursor::new(&data[pos..]));
                if let Ok((w, h)) = decoder.scale(max_dim as u16, max_dim as u16) {
                    let pixels = (w as u64) * (h as u64);
                    if pixels > 10_000 && pixels > best_pixels {
                        if let Ok(pixel_data) = decoder.decode() {
                            if let Some(rgb) = image::RgbImage::from_raw(w as u32, h as u32, pixel_data) {
                                best_pixels = pixels;
                                best_img = Some(image::DynamicImage::ImageRgb8(rgb));
                            }
                        }
                    }
                }
            }
            pos += 1;
        }
    }

    best_img
}

fn extract_embedded_thumbnail(path: &Path, width: u32) -> Result<Vec<u8>, String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    if let Some(jpeg_bytes) = extract_exif_thumbnail_bytes(&data) {
        let mut reader = image::ImageReader::new(Cursor::new(&jpeg_bytes));
        reader.set_format(image::ImageFormat::Jpeg);
        let img = reader.decode().map_err(|e| e.to_string())?;
        let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
        return encode_jpeg(&resized, 80);
    }

    if let Some(img) = scan_embedded_jpeg(&data, width, 1_000_000, 2_000_000) {
        let resized = img.resize(width, width, image::imageops::FilterType::Triangle);
        return encode_jpeg(&resized, 80);
    }

    Err("No embedded JPEG found in RAW file".to_string())
}

pub fn get_display_image(path: &Path, max_pixels: u32, quality: u8, allow_scan: bool) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => decode_jpeg_display(path, max_pixels, quality),
        "png" => decode_png_display(path, max_pixels, quality),
        ext if RAW_EXTENSIONS.contains(&ext) => decode_raw_display(path, max_pixels, quality, allow_scan, None),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

pub fn get_display_image_fast(path: &Path, max_pixels: u32, quality: u8, scan_timeout_ms: u128) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "jpg" | "jpeg" => decode_jpeg_display(path, max_pixels, quality),
        "png" => decode_png_display(path, max_pixels, quality),
        ext if RAW_EXTENSIONS.contains(&ext) => decode_raw_display(path, max_pixels, quality, true, Some(scan_timeout_ms)),
        _ => Err(format!("Unsupported image format: {}", ext)),
    }
}

fn decode_exif_thumbnail_image(data: &[u8]) -> Option<image::DynamicImage> {
    let jpeg_bytes = extract_exif_thumbnail_bytes(data)?;
    let mut reader = image::ImageReader::new(Cursor::new(&jpeg_bytes));
    reader.set_format(image::ImageFormat::Jpeg);
    reader.decode().ok()
}

fn scan_embedded_jpeg_timed(
    data: &[u8],
    max_dim: u32,
    front_bytes: usize,
    back_bytes: usize,
    timeout_ms: u128,
) -> Option<image::DynamicImage> {
    use jpeg_decoder::Decoder;
    use std::time::Instant;

    let start = Instant::now();
    let len = data.len();
    let scan_chunks = [
        0..len.min(front_bytes),
        len.saturating_sub(back_bytes)..len,
    ];

    let mut best_pixels = 0u64;
    let mut best_img = None;

    for range in &scan_chunks {
        let mut pos = range.start;
        while pos + 1 < range.end && pos + 1 < len {
            if start.elapsed().as_millis() > timeout_ms {
                return best_img;
            }
            if data[pos] == 0xFF && data[pos + 1] == 0xD8 {
                let mut decoder = Decoder::new(Cursor::new(&data[pos..]));
                if let Ok((w, h)) = decoder.scale(max_dim as u16, max_dim as u16) {
                    let pixels = (w as u64) * (h as u64);
                    if pixels > 10_000 && pixels > best_pixels {
                        if let Ok(pixel_data) = decoder.decode() {
                            if let Some(rgb) = image::RgbImage::from_raw(w as u32, h as u32, pixel_data) {
                                best_pixels = pixels;
                                best_img = Some(image::DynamicImage::ImageRgb8(rgb));
                            }
                        }
                    }
                }
            }
            pos += 1;
        }
    }

    best_img
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

fn decode_raw_display(
    path: &Path,
    max_pixels: u32,
    quality: u8,
    allow_scan: bool,
    scan_timeout_ms: Option<u128>,
) -> Result<Vec<u8>, String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    if let Some(thumb) = decode_exif_thumbnail_image(&data) {
        let thumb_max = thumb.width().max(thumb.height());
        if thumb_max >= max_pixels {
            return encode_jpeg(&resize_to_fit(&thumb, max_pixels), quality);
        }

        if allow_scan {
            if let Some(timeout_ms) = scan_timeout_ms {
                if let Some(img) = scan_embedded_jpeg_timed(&data, max_pixels, 2_000_000, 4_000_000, timeout_ms) {
                    return encode_jpeg(&resize_to_fit(&img, max_pixels), quality);
                }
            } else if let Some(img) = scan_embedded_jpeg(&data, max_pixels, 6_000_000, 12_000_000) {
                return encode_jpeg(&resize_to_fit(&img, max_pixels), quality);
            }
        }

        let target = thumb.width().max(thumb.height());
        let scale = max_pixels as f64 / target as f64;
        let filled = thumb.resize(
            (thumb.width() as f64 * scale).round() as u32,
            (thumb.height() as f64 * scale).round() as u32,
            image::imageops::FilterType::Lanczos3,
        );
        return encode_jpeg(&filled, quality);
    }

    if allow_scan {
        if let Some(timeout_ms) = scan_timeout_ms {
            if let Some(img) = scan_embedded_jpeg_timed(&data, max_pixels, 2_000_000, 4_000_000, timeout_ms) {
                return encode_jpeg(&resize_to_fit(&img, max_pixels), quality);
            }
        } else if let Some(img) = scan_embedded_jpeg(&data, max_pixels, 6_000_000, 12_000_000) {
            return encode_jpeg(&resize_to_fit(&img, max_pixels), quality);
        }
    }

    Err("No embedded JPEG found in RAW file".to_string())
}

fn preview_path_for(path: &Path, max_pixels: u32, quality: u8) -> Result<std::path::PathBuf, String> {
    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    let preview_dir = std::env::temp_dir().join("photo_manager_previews");
    fs::create_dir_all(&preview_dir).map_err(|e| e.to_string())?;
    Ok(preview_dir.join(format!("{}_display_{}_{}.jpg", hash.to_hex(), max_pixels, quality)))
}

pub fn generate_display_preview(path: &Path, max_pixels: u32, quality: u8, allow_scan: bool) -> Result<String, String> {
    let preview_path = preview_path_for(path, max_pixels, quality)?;

    if preview_path.exists() {
        return Ok(preview_path.to_string_lossy().to_string());
    }

    let data = get_display_image(path, max_pixels, quality, allow_scan)?;

    let mut file = File::create(&preview_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(preview_path.to_string_lossy().to_string())
}

pub fn generate_display_preview_fast(
    path: &Path,
    max_pixels: u32,
    quality: u8,
    scan_timeout_ms: u128,
) -> Result<String, String> {
    let preview_path = preview_path_for(path, max_pixels, quality)?;

    if preview_path.exists() {
        return Ok(preview_path.to_string_lossy().to_string());
    }

    let data = get_display_image_fast(path, max_pixels, quality, scan_timeout_ms)?;

    let mut file = File::create(&preview_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(preview_path.to_string_lossy().to_string())
}

pub fn cleanup_display_cache() {
    let preview_dir = std::env::temp_dir().join("photo_manager_previews");
    let _ = fs::remove_dir_all(preview_dir);
}

pub fn generate_thumbnail_preview(path: &Path, width: u32) -> Result<String, String> {
    let data = get_thumbnail(path, width)?;

    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    let thumb_dir = std::env::temp_dir().join("photo_manager_thumbnails");
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    let thumb_path = thumb_dir.join(format!("{}_{}.jpg", hash.to_hex(), width));

    let mut file = File::create(&thumb_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(thumb_path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_jpeg_bytes() -> Vec<u8> {
        let img = image::RgbImage::from_pixel(320, 180, image::Rgb([120, 80, 40]));
        encode_jpeg(&image::DynamicImage::ImageRgb8(img), 80).unwrap()
    }

    #[test]
    fn extracts_embedded_jpeg_from_video_like_buffer() {
        // Build a synthetic "video" file: a small head, an embedded JPEG, then
        // a large body that pushes the file over our FRONT window so the JPEG
        // lives in the tail region.
        let tmp_dir = std::env::temp_dir().join("photo_manager_thumb_tests");
        fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join("synth_video.mp4");

        let head = vec![0u8; 1024];
        let jpeg = make_jpeg_bytes();
        let tail = vec![0u8; 20 * 1024 * 1024]; // push total > 16 MiB FRONT

        let mut file = File::create(&path).unwrap();
        file.write_all(&head).unwrap();
        file.write_all(&jpeg).unwrap();
        file.write_all(&tail).unwrap();
        drop(file);

        let result = extract_video_embedded_thumbnail(&path, 200);
        assert!(result.is_ok(), "expected embedded JPEG extraction to succeed");
        let bytes = result.unwrap();
        assert!(!bytes.is_empty());
        assert_eq!(&bytes[0..2], &[0xFF, 0xD8], "output should be a JPEG");

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn extracts_embedded_jpeg_from_tail_region() {
        let tmp_dir = std::env::temp_dir().join("photo_manager_thumb_tests");
        fs::create_dir_all(&tmp_dir).unwrap();
        let path = tmp_dir.join("synth_video_tail.mp4");

        // A large body keeps moov-like metadata (and its embedded JPEG) in the
        // tail region, beyond the FRONT window.
        let jpeg = make_jpeg_bytes();
        let body = vec![0u8; 20 * 1024 * 1024];

        let mut file = File::create(&path).unwrap();
        file.write_all(&body).unwrap();
        file.write_all(&jpeg).unwrap();
        drop(file);

        let result = extract_video_embedded_thumbnail(&path, 200);
        assert!(result.is_ok(), "expected embedded JPEG from tail to succeed");
        let bytes = result.unwrap();
        assert_eq!(&bytes[0..2], &[0xFF, 0xD8]);

        let _ = fs::remove_file(&path);
    }
}
