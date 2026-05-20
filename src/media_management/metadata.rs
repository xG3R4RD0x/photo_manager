use std::fs::File;
use std::io::BufReader;
use std::path::PathBuf;
use chrono::{NaiveDateTime, Datelike};
use exif::{Reader, Tag, In};

/// Extrae la fecha de captura desde los metadatos EXIF
pub fn extract_exif_date(path: &PathBuf) -> Option<NaiveDateTime> {
    let file = File::open(path).ok()?;
    let mut bufreader = BufReader::new(file);
    let exifreader = Reader::new().read_from_container(&mut bufreader).ok()?;

    // Imprimir TODOS los metadatos EXIF para debug
    println!("\n🔍 Metadatos EXIF para: {:?}", path.file_name().unwrap_or_default());
    println!("{}", "=".repeat(50));
    
    for field in exifreader.fields() {
        println!("📋 {:?}: {}", field.tag, field.display_value());
    }
    
    println!("{}", "=".repeat(50));

    if let Some(field) = exifreader.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
        let raw_date = field.display_value().to_string();
        println!("✅ Fecha encontrada: {}", raw_date);
        // Formato EXIF típico: "2025:08:09 14:22:30"
        NaiveDateTime::parse_from_str(&raw_date, "%Y:%m:%d %H:%M:%S").ok()
    } else {
        println!("❌ No se encontró DateTimeOriginal");
        None
    }
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