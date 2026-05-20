use photo_manager::media_management::{storage, metadata};

fn main() {
    println!("🔍 Buscando dispositivos de cámara...");
    
    if let Some(drive) = storage::detect_camera_drive() {
        if let Some(photo_folder) = storage::find_photo_folder(&drive) {
            let photos = storage::list_photos(&photo_folder);
            let count = photos.len();
            
            println!("📸 Se encontraron {} fotos en {:?}", count, photo_folder);
            println!("{}", "=".repeat(60));
            
            if photos.is_empty() {
                println!("No hay fotos para procesar.");
                return;
            }
            
            println!("📅 Extrayendo fechas de metadatos EXIF...\n");
            
            let mut processed = 0;
            let mut with_date = 0;
            
            // Solo procesar las primeras 5 fotos para debug
            let photos_to_process = photos.into_iter().take(5);
            
            for photo in photos_to_process {
                processed += 1;
                
                // Mostrar progreso cada 10 fotos
                if processed % 10 == 0 || processed == count {
                    println!("Procesando: {}/{}", processed, count);
                }
                
                let file_name = photo.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "Archivo sin nombre".to_string());
                
                match metadata::extract_exif_date(&photo) {
                    Some(date_time) => {
                        with_date += 1;
                        println!("📷 {} | 📅 {}", file_name, date_time.format("%Y-%m-%d %H:%M:%S"));
                    }
                    None => {
                        println!("❌ {} | Sin fecha EXIF", file_name);
                    }
                }
            }
            
            println!("\n{}", "=".repeat(60));
            println!("📊 Resumen:");
            println!("   Total de fotos: {}", count);
            println!("   Con fecha EXIF: {}", with_date);
            println!("   Sin fecha EXIF: {}", count - with_date);
            
            if with_date > 0 {
                let percentage = (with_date as f32 / count as f32) * 100.0;
                println!("   Porcentaje con metadatos: {:.1}%", percentage);
            }
            
        } else {
            println!("❌ No se encontró carpeta de fotos (DCIM).");
        }
    } else {
        println!("❌ No se detectó ninguna cámara conectada.");
    }
}
