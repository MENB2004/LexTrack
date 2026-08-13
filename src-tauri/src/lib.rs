use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Register auto-updater and process (relaunch) plugins
      #[cfg(desktop)]
      {
        app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
        app.handle().plugin(tauri_plugin_process::init())?;
      }

      // Create tray menu items using MenuBuilder and MenuItemBuilder in Tauri v2
      let show_i = tauri::menu::MenuItemBuilder::new("Show LexTrack")
          .id("show")
          .build(app)?;
      let quit_i = tauri::menu::MenuItemBuilder::new("Quit")
          .id("quit")
          .build(app)?;
      let menu = tauri::menu::MenuBuilder::new(app)
          .items(&[&show_i, &quit_i])
          .build()?;

      // Create system tray icon
      let _tray = tauri::tray::TrayIconBuilder::new()
          .menu(&menu)
          .tooltip("LexTrack — Case Management")
          .on_menu_event(|app, event| match event.id().as_ref() {
              "show" => {
                  if let Some(window) = app.get_webview_window("main") {
                      window.show().unwrap();
                      window.set_focus().unwrap();
                  }
              }
              "quit" => app.exit(0),
              _ => {}
          })
          .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        // Prevent window from closing, hide it to system tray instead
        api.prevent_close();
        window.hide().unwrap();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
