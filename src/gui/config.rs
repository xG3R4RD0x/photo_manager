use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub window_width: u32,
    pub window_height: u32,
    pub window_x: i32,
    pub window_y: i32,
    pub last_template: String,
    pub last_dest_folder: Option<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            window_width: 1400,
            window_height: 900,
            window_x: 100,
            window_y: 100,
            last_template: "YYYY/YYYY-MM-DD/".to_string(),
            last_dest_folder: None,
        }
    }
}

pub fn get_config_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(appdata)
        .join("photo-manager")
        .join("config.json")
}

pub fn load_config() -> AppConfig {
    let config_path = get_config_path();
    
    if config_path.exists() {
        match fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_json::from_str(&content) {
                    Ok(config) => return config,
                    Err(_) => {}
                }
            }
            Err(_) => {}
        }
    }
    
    AppConfig::default()
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let config_path = get_config_path();
    
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&config_path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}
