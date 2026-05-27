use std::path::PathBuf;
use std::fs;
use chrono::NaiveDateTime;

/// Copy file from source to destination, organizing by template
pub fn copy_with_template(
    source: &PathBuf,
    dest_base: &PathBuf,
    template: &str,
    date: Option<NaiveDateTime>,
) -> Result<PathBuf, String> {
    let folder_path = match date {
        Some(dt) => apply_template(template, dt),
        None => "SinFecha".to_string(),
    };
    
    let dest_dir = dest_base.join(&folder_path);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    
    let filename = source
        .file_name()
        .ok_or("Invalid source filename")?;
    
    let dest_file = dest_dir.join(filename);
    fs::copy(source, &dest_file).map_err(|e| e.to_string())?;
    
    Ok(dest_file)
}

fn apply_template(template: &str, dt: chrono::NaiveDateTime) -> String {
    crate::media_management::template::apply_template(template, dt)
}
