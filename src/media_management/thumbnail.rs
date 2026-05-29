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
    let data = std::fs::read(path).map_err(|e| e.to_string())?;

    if let Some(img) = scan_embedded_jpeg(&data, max_pixels, 6_000_000, 12_000_000) {
        return encode_jpeg(&resize_to_fit(&img, max_pixels), quality);
    }

    if let Some(jpeg_bytes) = extract_exif_thumbnail_bytes(&data) {
        let mut r = image::ImageReader::new(Cursor::new(&jpeg_bytes));
        r.set_format(image::ImageFormat::Jpeg);
        let thumb = r.decode().map_err(|e| e.to_string())?;

        let filled = if thumb.width() < max_pixels || thumb.height() < max_pixels {
            let target = thumb.width().max(thumb.height());
            let scale = max_pixels as f64 / target as f64;
            thumb.resize(
                (thumb.width() as f64 * scale).round() as u32,
                (thumb.height() as f64 * scale).round() as u32,
                image::imageops::FilterType::Lanczos3,
            )
        } else {
            resize_to_fit(&thumb, max_pixels)
        };
        return encode_jpeg(&filled, quality);
    }

    Err("No embedded JPEG found in RAW file".to_string())
}

pub fn generate_display_preview(path: &Path, max_pixels: u32, quality: u8) -> Result<String, String> {
    let data = get_display_image(path, max_pixels, quality)?;

    let hash = blake3::hash(path.to_string_lossy().as_bytes());
    let preview_dir = std::env::temp_dir().join("photo_manager_previews");
    fs::create_dir_all(&preview_dir).map_err(|e| e.to_string())?;
    let preview_path = preview_dir.join(format!("{}_display_{}_{}.jpg", hash.to_hex(), max_pixels, quality));

    let mut file = File::create(&preview_path).map_err(|e| e.to_string())?;
    file.write_all(&data).map_err(|e| e.to_string())?;

    Ok(preview_path.to_string_lossy().to_string())
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
