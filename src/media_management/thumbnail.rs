use std::path::PathBuf;
use std::fs::File;
use std::io::{BufReader, Seek, SeekFrom, Read};
use image::ImageReader;
use std::io::Cursor;
use exif::{Reader, Tag, In};

/// Extract embedded JPEG thumbnail from RAW file and resize to 200px
pub fn get_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
    let ext = path.extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    
    match ext.as_str() {
        "jpg" | "jpeg" | "png" => {
            // For JPEG/PNG, decode directly
            let img = ImageReader::open(path)
                .map_err(|e| e.to_string())?
                .decode()
                .map_err(|e| e.to_string())?;
            
            let resized = img.resize(width, width, image::imageops::FilterType::Lanczos3);
            let mut buf = Vec::new();
            resized.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
                .map_err(|e| e.to_string())?;
            
            Ok(buf)
        }
        "cr2" | "nef" | "arw" | "raf" => {
            // For RAW, extract embedded JPEG from EXIF thumbnail
            extract_embedded_thumbnail(path, width)
        }
        _ => Err(format!("Unsupported image format: {}", ext))
    }
}

/// Extract embedded JPEG from RAW EXIF data, with fallback to full RAW conversion
fn extract_embedded_thumbnail(path: &PathBuf, width: u32) -> Result<Vec<u8>, String> {
    let file = File::open(path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    
    // Parse EXIF to find thumbnail data
    let exif = Reader::new()
        .read_from_container(&mut reader)
        .map_err(|e| format!("Failed to read EXIF: {:?}", e))?;
    
    // Look for JPEG interchange format (thumbnail JPEG data location)
    // In the thumbnail IFD (In::THUMBNAIL)
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
            
            // Read JPEG data from file
            let mut file2 = File::open(path).map_err(|e| e.to_string())?;
            file2.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
            
            let mut jpeg_data = vec![0u8; length];
            file2.read_exact(&mut jpeg_data).map_err(|e| e.to_string())?;
            
            // Decode and resize
            let mut reader = ImageReader::new(Cursor::new(&jpeg_data));
            reader.set_format(image::ImageFormat::Jpeg);
            let img = reader.decode()
                .map_err(|e| e.to_string())?;
            
            let resized = img.resize(width, width, image::imageops::FilterType::Lanczos3);
            let mut buf = Vec::new();
            resized.write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
                .map_err(|e| e.to_string())?;
            
            return Ok(buf);
        }
    }
    
    // Fallback: attempt full RAW to JPEG conversion
    // This would require a RAW processing library like libraw
    // For now, return error with suggestion to install raw conversion tools
    Err("No embedded JPEG found in RAW file - full RAW conversion not yet implemented. Install dcraw or similar tools for full RAW support.".to_string())
}
