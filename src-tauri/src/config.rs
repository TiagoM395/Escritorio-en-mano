use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub rust_api_port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".into(),
            port: 7456,
            rust_api_port: 7457,
        }
    }
}

fn default_connection_mode() -> String {
    "wifi".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPrefs {
    pub auto_start: bool,
    pub minimize_to_tray: bool,
    pub lan_ip: String,
    #[serde(default = "default_connection_mode")]
    pub connection_mode: String,
}

impl Default for AppPrefs {
    fn default() -> Self {
        Self {
            auto_start: false,
            minimize_to_tray: true,
            lan_ip: String::new(),
            connection_mode: "wifi".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub server: ServerConfig,
    pub token: String,
    pub rust_secret: String,
    pub app: AppPrefs,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            token: random_hex(48),
            rust_secret: random_hex(48),
            app: AppPrefs::default(),
        }
    }
}

pub fn random_hex(bytes: usize) -> String {
    use rand::RngCore;
    let mut rng = rand::thread_rng();
    let mut buf = vec![0u8; bytes];
    rng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

fn exe_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn config_path() -> PathBuf {
    if let Ok(p) = std::env::var("CONFIG_PATH") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    let candidates = [
        std::env::current_dir().unwrap_or_default().join("config.json"),
        exe_dir().join("config.json"),
    ];
    for c in candidates {
        if c.exists() {
            return c;
        }
    }
    exe_dir().join("config.json")
}

pub fn load_or_create() -> AppConfig {
    let path = config_path();
    let mut cfg = if path.exists() {
        if let Ok(raw) = fs::read_to_string(&path) {
            let raw = raw.strip_prefix('\u{FEFF}').unwrap_or(&raw);
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(raw) {
                cfg
            } else {
                AppConfig::default()
            }
        } else {
            AppConfig::default()
        }
    } else {
        AppConfig::default()
    };
    if cfg.token.is_empty() {
        cfg.token = random_hex(48);
    }
    if cfg.rust_secret.is_empty() {
        cfg.rust_secret = random_hex(48);
    }
    if cfg.app.connection_mode != "wifi" && cfg.app.connection_mode != "vpn" {
        cfg.app.connection_mode = "wifi".into();
    }
    let _ = save(&cfg);
    cfg
}

pub fn save(cfg: &AppConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

/// IP efectiva según el modo de conexión elegido:
/// "vpn" usa el túnel Tailscale (si está activo), sino la red local.
pub fn connection_ip(cfg: &AppConfig) -> String {
    if cfg.app.connection_mode == "vpn" {
        let vpn = crate::system::vpn_ip();
        if !vpn.is_empty() {
            return vpn;
        }
    }
    crate::system::lan_ip()
}

/// Vista pública (sin el secreto compartido) que recibe el frontend.
pub fn public_view(cfg: &AppConfig) -> serde_json::Value {
    serde_json::json!({
        "server": {
            "host": cfg.server.host,
            "port": cfg.server.port,
            "rustApiPort": cfg.server.rust_api_port
        },
        "token": cfg.token,
        "app": {
            "autoStart": cfg.app.auto_start,
            "minimizeToTray": cfg.app.minimize_to_tray,
            "lanIp": cfg.app.lan_ip,
            "connectionMode": cfg.app.connection_mode
        }
    })
}

#[allow(dead_code)]
pub fn existing_or_default(path: &Path) -> AppConfig {
    if path.exists() {
        if let Ok(raw) = fs::read_to_string(path) {
            let raw = raw.strip_prefix('\u{FEFF}').unwrap_or(&raw);
            if let Ok(cfg) = serde_json::from_str::<AppConfig>(raw) {
                return cfg;
            }
        }
    }
    AppConfig::default()
}
