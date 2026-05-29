#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use photo_manager_lib::gui::commands;
use photo_manager_lib::media_management::thumbnail;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::detect_camera,
            commands::find_photo_folder,
            commands::scan_photos,
            commands::scan_photos_quick,
            commands::enrich_photos_metadata_fast,
            commands::list_all_removable_drives,
            commands::get_exif,
            commands::get_thumbnail,
            commands::generate_thumbnail,
            commands::get_display_image,
            commands::get_display_image_medium,
            commands::get_display_image_low,
            commands::get_full_image,
            commands::import_photos,
            commands::list_directory_tree,
            commands::get_pictures_folder,
            commands::start_duplicate_check,
        ])
        .on_window_event(|_app, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                thumbnail::cleanup_display_cache();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

