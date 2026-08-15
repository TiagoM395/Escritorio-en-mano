use std::io::Read;
use std::sync::{Arc, Mutex};
use tiny_http::{Header, Response, Server};

use crate::config::{self, AppConfig};
use crate::{system, winapi};

type Shared = Arc<Mutex<AppConfig>>;

fn respond(request: &mut tiny_http::Request, status: u16, body: String) {
    let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap_or_else(|_| {
        Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap()
    });
    let response = Response::from_string(body)
        .with_status_code(status)
        .with_header(header);
    let _ = request.respond(response);
}

fn read_body(request: &mut tiny_http::Request) -> String {
    let mut body = String::new();
    let _ = request.as_reader().take(64 * 1024).read_to_string(&mut body);
    body
}

fn authorized(request: &tiny_http::Request, secret: &str) -> bool {
    request
        .headers()
        .iter()
        .any(|h| h.field.equiv("x-shared-secret") && h.value.as_str() == secret)
}

fn handle_control(request: &mut tiny_http::Request, state: &Shared) {
    let body = read_body(request);
    let payload: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
            respond(request, 400, r#"{"ok":false,"error":"JSON inválido"}"#.into());
            return;
        }
    };
    let action = payload.get("action").and_then(|a| a.as_str()).unwrap_or("");
    let value = payload.get("value");

    let result = match action {
        "volume_get" => winapi::get_volume()
            .map(|v| serde_json::json!({ "volume": (v * 100.0).round() as i64 })),
        "volume_set" => {
            let v = value.and_then(|x| x.as_f64()).unwrap_or(0.0) as f32 / 100.0;
            winapi::set_volume(v).map(|_| serde_json::json!({ "volume": (v * 100.0).round() as i64 }))
        }
        "mute_get" => winapi::get_mute().map(|m| serde_json::json!({ "muted": m })),
        "mute_set" => {
            let m = value.and_then(|x| x.as_bool()).unwrap_or(false);
            winapi::set_mute(m).map(|_| serde_json::json!({ "muted": m }))
        }
        "brightness_get" => winapi::get_brightness()
            .map(|b| serde_json::json!({ "brightness": b.unwrap_or(50), "supported": b.is_some() })),
        "brightness_set" => {
            let v = value.and_then(|x| x.as_f64()).unwrap_or(0.0) as i32;
            winapi::set_brightness(v).map(|_| serde_json::json!({ "brightness": v }))
        }
        "media" => {
            let a = value.and_then(|x| x.as_str()).unwrap_or("");
            winapi::media(a).map(|_| serde_json::json!({ "sent": true }))
        }
        "lock" => winapi::lock().map(|_| serde_json::json!({ "done": true })),
        "sleep" => winapi::sleep().map(|_| serde_json::json!({ "done": true })),
        "shutdown" => winapi::shutdown().map(|_| serde_json::json!({ "done": true })),
        "restart" => winapi::restart().map(|_| serde_json::json!({ "done": true })),
        "display_off" => winapi::display_off().map(|_| serde_json::json!({ "done": true })),
        "system_info" => Ok(system_info(state)),
        _ => Err(format!("acción desconocida: {action}")),
    };

    match result {
        Ok(data) => respond(
            request,
            200,
            serde_json::json!({ "ok": true, "data": data }).to_string(),
        ),
        Err(error) => respond(
            request,
            500,
            serde_json::json!({ "ok": false, "error": error }).to_string(),
        ),
    }
}

fn system_info(state: &Shared) -> serde_json::Value {
    let cfg = state.lock().unwrap().clone();
    let (total_mb, free_mb) = system::memory_mb();
    let ip = system::lan_ip();
    let volume = winapi::get_volume().map(|v| (v * 100.0).round() as i64).unwrap_or(0);
    let muted = winapi::get_mute().unwrap_or(false);
    let brightness = winapi::get_brightness().unwrap_or(None);
    serde_json::json!({
        "os": system::os_name(),
        "cpu": system::cpu_name(),
        "ramTotalMb": total_mb,
        "ramFreeMb": free_mb,
        "ip": ip,
        "port": cfg.server.port,
        "url": format!("http://{}:{}", ip, cfg.server.port),
        "volume": volume,
        "muted": muted,
        "brightness": brightness.unwrap_or(50),
        "brightnessSupported": brightness.is_some(),
    })
}

fn handle_config_get(request: &mut tiny_http::Request, state: &Shared) {
    let cfg = state.lock().unwrap().clone();
    respond(
        request,
        200,
        serde_json::json!({ "ok": true, "data": config::public_view(&cfg) }).to_string(),
    );
}

fn handle_config_post(request: &mut tiny_http::Request, state: &Shared, handle: &tauri::AppHandle) {
    let body = read_body(request);
    let patch: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
            respond(request, 400, r#"{"ok":false,"error":"JSON inválido"}"#.into());
            return;
        }
    };

    let mut cfg = state.lock().unwrap().clone();

    if patch.get("regenerateToken").and_then(|v| v.as_bool()).unwrap_or(false) {
        cfg.token = config::random_hex(48);
    }

    if let Some(server) = patch.get("server") {
        if let Some(host) = server.get("host").and_then(|v| v.as_str()) {
            cfg.server.host = host.to_string();
        }
        if let Some(port) = server.get("port").and_then(|v| v.as_u64()) {
            if (1..=65535).contains(&port) {
                cfg.server.port = port as u16;
            }
        }
        if let Some(port) = server.get("rustApiPort").and_then(|v| v.as_u64()) {
            if (1..=65535).contains(&port) {
                cfg.server.rust_api_port = port as u16;
            }
        }
    }

    if let Some(token) = patch.get("token").and_then(|v| v.as_str()) {
        if !token.is_empty() {
            cfg.token = token.to_string();
        }
    }

    let mut autostart_change: Option<bool> = None;
    if let Some(app) = patch.get("app") {
        if let Some(auto) = app.get("autoStart").and_then(|v| v.as_bool()) {
            cfg.app.auto_start = auto;
            autostart_change = Some(auto);
        }
        if let Some(tray) = app.get("minimizeToTray").and_then(|v| v.as_bool()) {
            cfg.app.minimize_to_tray = tray;
        }
        if let Some(ip) = app.get("lanIp").and_then(|v| v.as_str()) {
            cfg.app.lan_ip = ip.to_string();
        }
    }

    if let Err(e) = config::save(&cfg) {
        respond(
            request,
            500,
            serde_json::json!({ "ok": false, "error": format!("no se pudo guardar la configuración: {e}") })
                .to_string(),
        );
        return;
    }

    if let Some(auto) = autostart_change {
        use tauri_plugin_autostart::ManagerExt;
        let manager = handle.autolaunch();
        if auto {
            let _ = manager.enable();
        } else {
            let _ = manager.disable();
        }
    }

    *state.lock().unwrap() = cfg.clone();
    respond(
        request,
        200,
        serde_json::json!({ "ok": true, "data": config::public_view(&cfg) }).to_string(),
    );
}

pub fn start_http_server(state: Shared, handle: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let port = state.lock().unwrap().server.rust_api_port;
    let server = Server::http(("127.0.0.1", port)).map_err(|e| {
        eprintln!("[rust] No se pudo iniciar la API nativa en el puerto {port}: {e}");
        e
    })?;
    println!("[rust] API nativa escuchando en http://127.0.0.1:{port}");

    for mut request in server.incoming_requests() {
        let state = state.clone();
        let handle = handle.clone();
        std::thread::spawn(move || {
            let secret = state.lock().unwrap().rust_secret.clone();
            if !authorized(&request, &secret) {
                respond(&mut request, 401, r#"{"ok":false,"error":"secreto inválido"}"#.into());
                return;
            }
            match (request.method().as_str(), request.url()) {
                ("POST", "/control") => handle_control(&mut request, &state),
                ("GET", "/config") => handle_config_get(&mut request, &state),
                ("POST", "/config") => handle_config_post(&mut request, &state, &handle),
                _ => respond(
                    &mut request,
                    404,
                    serde_json::json!({ "ok": false, "error": "no encontrado" }).to_string(),
                ),
            }
        });
    }
    Ok(())
}
