use std::path::PathBuf;
use std::fs;
use chrono::NaiveDateTime;

pub struct ImportJob {
    pub source_path: PathBuf,
    pub dest_base: PathBuf,
    pub template: String,
    pub photos: Vec<(PathBuf, Option<NaiveDateTime>)>,
}

pub struct ImportProgress {
    pub current_file: String,
    pub total: usize,
    pub completed: usize,
    pub errors: Vec<String>,
}

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
    let mut result = template.to_string();
    
    result = result.replace("YYYY", &dt.format("%Y").to_string());
    result = result.replace("MM", &dt.format("%m").to_string());
    result = result.replace("DD", &dt.format("%d").to_string());
    result = result.replace("YY", &dt.format("%y").to_string());
    result = result.replace("MONTH", &dt.format("%B").to_string());
    result = result.replace("YYYY-MM-DD", &dt.format("%Y-%m-%d").to_string());
    result = result.replace("YYYYMMDD", &dt.format("%Y%m%d").to_string());
    
    result
}
