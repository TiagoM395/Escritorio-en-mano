use std::process::Command;
use windows::Win32::Foundation::{BOOL, BOOLEAN, LPARAM, POINT, WPARAM};
use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::System::Shutdown::{
    ExitWindowsEx, LockWorkStation, EWX_FORCE, EWX_FORCEIFHUNG, EWX_POWEROFF, EWX_REBOOT,
    SHUTDOWN_REASON,
};
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    keybd_event, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE, MOUSEEVENTF_HWHEEL,
    MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP,
    MOUSEEVENTF_MOVE, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_WHEEL, MOUSEINPUT,
    MOUSE_EVENT_FLAGS, VIRTUAL_KEY, VK_BACK, VK_DELETE, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE,
    VK_MEDIA_PREV_TRACK, VK_RETURN, VK_TAB,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetCursorPos, SendMessageW, HWND_BROADCAST, SC_MONITORPOWER, WM_SYSCOMMAND,
};

fn with_volume<T>(f: impl FnOnce(&IAudioEndpointVolume) -> windows::core::Result<T>) -> Result<T, String> {
    let init = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    let result = (|| {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device =
                enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)?;
            let endpoint: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
            f(&endpoint)
        }
    })();
    unsafe {
        CoUninitialize();
    }
    init.ok().map_err(|e| format!("CoInitializeEx: {e}"))?;
    result.map_err(|e| e.to_string())
}

pub fn get_volume() -> Result<f32, String> {
    with_volume(|epv| unsafe { epv.GetMasterVolumeLevelScalar() })
}

pub fn set_volume(level: f32) -> Result<(), String> {
    let clamped = level.clamp(0.0, 1.0);
    with_volume(|epv| unsafe { epv.SetMasterVolumeLevelScalar(clamped, std::ptr::null()) })
}

pub fn get_mute() -> Result<bool, String> {
    with_volume(|epv| unsafe { epv.GetMute().map(|m| m.as_bool()) })
}

pub fn set_mute(mute: bool) -> Result<(), String> {
    with_volume(|epv| unsafe { epv.SetMute(BOOL(mute as i32), std::ptr::null()) })
}

fn ps(command: &str) -> Result<String, String> {
    let out = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", command])
        .output()
        .map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

pub fn get_brightness() -> Result<Option<i32>, String> {
    let raw = match ps("(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness") {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    Ok(raw.trim().parse::<i32>().ok())
}

pub fn set_brightness(value: i32) -> Result<(), String> {
    ps(&format!(
        "(Get-WmiObject -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1,{value})"
    ))?;
    Ok(())
}

pub fn media(action: &str) -> Result<(), String> {
    let key = match action {
        "next" => VK_MEDIA_NEXT_TRACK,
        "prev" => VK_MEDIA_PREV_TRACK,
        "play_pause" => VK_MEDIA_PLAY_PAUSE,
        _ => return Err("acción de medios inválida".into()),
    };
    unsafe {
        keybd_event(key.0 as u8, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(key.0 as u8, 0, KEYEVENTF_KEYUP, 0);
    }
    Ok(())
}

// ── Teclado ────────────────────────────────────────────────

/// Escribe texto en el campo enfocado de la PC.
/// Secuencias especiales: "\n" → Enter, "\t" → Tab, "\u{8}" → Retroceso, "\u{7f}" → Supr.
pub fn type_text(text: &str) -> Result<(), String> {
    let mut inputs: Vec<INPUT> = Vec::new();
    for ch in text.chars() {
        let (vk, is_unicode) = match ch {
            '\n' => (VK_RETURN, false),
            '\t' => (VK_TAB, false),
            '\u{8}' => (VK_BACK, false),
            '\u{7f}' => (VK_DELETE, false),
            _ => (VIRTUAL_KEY(ch as u16), true),
        };
        let flags = if is_unicode { KEYEVENTF_UNICODE } else { KEYBD_EVENT_FLAGS(0) };
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: if is_unicode { VIRTUAL_KEY(0) } else { vk },
                    wScan: if is_unicode { vk.0 } else { 0 },
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
        inputs.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: if is_unicode { VIRTUAL_KEY(0) } else { vk },
                    wScan: if is_unicode { vk.0 } else { 0 },
                    dwFlags: flags | KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }
    for chunk in inputs.chunks(64) {
        let sent = unsafe { SendInput(chunk, std::mem::size_of::<INPUT>() as i32) };
        if sent as usize != chunk.len() {
            return Err("no se pudieron enviar los caracteres".into());
        }
    }
    Ok(())
}

// ── Mouse ────────────────────────────────────────────────

fn send_mouse_input(mi: MOUSEINPUT) -> Result<(), String> {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 { mi },
    };
    let sent = unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
    if sent != 1 {
        return Err("no se pudo enviar el evento de mouse".into());
    }
    Ok(())
}

pub fn mouse_move(dx: i32, dy: i32) -> Result<(), String> {
    send_mouse_input(MOUSEINPUT {
        dx,
        dy,
        dwFlags: MOUSEEVENTF_MOVE,
        ..Default::default()
    })
}

fn mouse_button_flag(button: &str, down: bool) -> Result<MOUSE_EVENT_FLAGS, String> {
    match (button, down) {
        ("left", true) => Ok(MOUSEEVENTF_LEFTDOWN),
        ("left", false) => Ok(MOUSEEVENTF_LEFTUP),
        ("right", true) => Ok(MOUSEEVENTF_RIGHTDOWN),
        ("right", false) => Ok(MOUSEEVENTF_RIGHTUP),
        ("middle", true) => Ok(MOUSEEVENTF_MIDDLEDOWN),
        ("middle", false) => Ok(MOUSEEVENTF_MIDDLEUP),
        _ => Err("botón de mouse inválido".into()),
    }
}

pub fn mouse_button(button: &str, down: bool) -> Result<(), String> {
    send_mouse_input(MOUSEINPUT {
        dwFlags: mouse_button_flag(button, down)?,
        ..Default::default()
    })
}

pub fn mouse_click(button: &str) -> Result<(), String> {
    mouse_button(button, true)?;
    std::thread::sleep(std::time::Duration::from_millis(25));
    mouse_button(button, false)
}

pub fn mouse_scroll(dx: i32, dy: i32) -> Result<(), String> {
    const WHEEL_DELTA: i32 = 120;
    if dy != 0 {
        send_mouse_input(MOUSEINPUT {
            mouseData: (dy * WHEEL_DELTA) as u32,
            dwFlags: MOUSEEVENTF_WHEEL,
            ..Default::default()
        })?;
    }
    if dx != 0 {
        send_mouse_input(MOUSEINPUT {
            mouseData: (dx * WHEEL_DELTA) as u32,
            dwFlags: MOUSEEVENTF_HWHEEL,
            ..Default::default()
        })?;
    }
    Ok(())
}

pub fn cursor_pos() -> Result<(i32, i32), String> {
    let mut p = POINT::default();
    unsafe { GetCursorPos(&mut p).map_err(|e| e.to_string())? };
    Ok((p.x, p.y))
}

pub fn lock() -> Result<(), String> {
    unsafe {
        let ok = LockWorkStation().is_ok();
        if ok {
            Ok(())
        } else {
            Err("no se pudo bloquear la estación de trabajo".into())
        }
    }
}

pub fn sleep() -> Result<(), String> {
    unsafe {
        let ok = SetSuspendState(BOOLEAN(0), BOOLEAN(0), BOOLEAN(0)).as_bool();
        if ok {
            Ok(())
        } else {
            Err("no se pudo suspender el equipo".into())
        }
    }
}

fn enable_shutdown_privilege() -> Result<(), String> {
    use windows::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
        SE_SHUTDOWN_NAME, TOKEN_ADJUST_PRIVILEGES, TOKEN_QUERY, TOKEN_PRIVILEGES,
    };
    unsafe {
        let process = GetCurrentProcess();
        let mut token = Default::default();
        OpenProcessToken(process, TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &mut token)
            .map_err(|e| e.to_string())?;
        let mut luid = Default::default();
        LookupPrivilegeValueW(None, SE_SHUTDOWN_NAME, &mut luid).map_err(|e| e.to_string())?;
        let mut privileges = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [LUID_AND_ATTRIBUTES {
                Luid: luid,
                Attributes: SE_PRIVILEGE_ENABLED,
            }],
        };
        AdjustTokenPrivileges(token, BOOL(0), Some(&mut privileges), 0, None, None)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn shutdown() -> Result<(), String> {
    let _ = enable_shutdown_privilege();
    unsafe {
        let ok = ExitWindowsEx(EWX_POWEROFF | EWX_FORCEIFHUNG, SHUTDOWN_REASON(0)).is_ok();
        if ok {
            Ok(())
        } else {
            Err("no se pudo iniciar el apagado".into())
        }
    }
}

pub fn restart() -> Result<(), String> {
    let _ = enable_shutdown_privilege();
    unsafe {
        let ok = ExitWindowsEx(EWX_REBOOT | EWX_FORCE, SHUTDOWN_REASON(0)).is_ok();
        if ok {
            Ok(())
        } else {
            Err("no se pudo iniciar el reinicio".into())
        }
    }
}

pub fn display_off() -> Result<(), String> {
    unsafe {
        SendMessageW(
            HWND_BROADCAST,
            WM_SYSCOMMAND,
            WPARAM(SC_MONITORPOWER as usize),
            LPARAM(2),
        );
    }
    Ok(())
}
