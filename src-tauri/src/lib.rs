mod config;
mod server;
mod system;
mod uia;
mod winapi;

use std::sync::{Arc, Mutex};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_autostart::MacosLauncher;

use config::AppConfig;

#[tauri::command]
fn get_bootstrap(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let state = app.state::<Arc<Mutex<AppConfig>>>();
    let cfg = state.lock().unwrap().clone();
    Ok(serde_json::json!({
        "apiBase": format!("http://{}:{}", config::connection_ip(&cfg), cfg.server.port),
        "token": cfg.token,
    }))
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Mostrar panel", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("Escritorio en Mano")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn find_node_server() -> Option<std::path::PathBuf> {
    let mut dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    loop {
        let candidate = dir.join("server").join("dist").join("index.js");
        if candidate.exists() {
            return Some(candidate);
        }
        if !dir.pop() {
            break;
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let candidate = cwd.join("server").join("dist").join("index.js");
        if candidate.exists() {
            return Some(candidate);
        }
    }
    None
}

fn spawn_node_server(state: &Arc<Mutex<AppConfig>>) {
    let Some(script) = find_node_server() else {
        eprintln!("[rust] No se encontró el servidor Node; no se iniciará.");
        return;
    };
    let cfg = state.lock().unwrap().clone();
    use std::os::windows::process::CommandExt;
    let child = std::process::Command::new("node")
        .arg(&script)
        .env("RUST_SECRET", &cfg.rust_secret)
        .env("APP_TOKEN", &cfg.token)
        .env("SERVER_PORT", cfg.server.port.to_string())
        .env("RUST_API_URL", format!("http://127.0.0.1:{}", cfg.server.rust_api_port))
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn();
    match child {
        Ok(_) => println!("[rust] Servidor Node iniciado ({script:?})."),
        Err(e) => eprintln!("[rust] No se pudo iniciar el servidor Node: {e}"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_config = config::load_or_create();
    let shared = Arc::new(Mutex::new(app_config));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(shared.clone())
        .setup(move |app| {
            let manager = app.autolaunch();
            let cfg = shared.lock().unwrap().clone();
            let enabled = manager.is_enabled().unwrap_or(false);
            if cfg.app.auto_start && !enabled {
                let _ = manager.enable();
            }

            let state = shared.clone();
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let _ = server::start_http_server(state, handle);
            });

            spawn_node_server(&shared);
            setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let cfg = window.state::<Arc<Mutex<AppConfig>>>().lock().unwrap().clone();
                if cfg.app.minimize_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![get_bootstrap])
        .run(tauri::generate_context!())
        .expect("error al ejecutar la aplicación");
}
