// Tauri app main
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            photo_manager::gui::commands::detect_camera,
            photo_manager::gui::commands::find_photo_folder,
            photo_manager::gui::commands::scan_photos,
            photo_manager::gui::commands::get_exif,
            photo_manager::gui::commands::get_thumbnail,
            photo_manager::gui::commands::get_config,
            photo_manager::gui::commands::save_config_cmd,
            photo_manager::gui::commands::import_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
