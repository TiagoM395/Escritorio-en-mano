use std::process::Command;
use windows::core::Interface;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, WPARAM};
use windows::Win32::Media::Audio::{
    AudioDeviceKind, AudioDeviceRole, IAudioEndpointVolume, IMMDeviceEnumerator, MediaDeviceEnumerator,
};
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_MULTITHREADED,
};
use windows::Win32::System::Power::SetSuspendState;
use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP};
use windows::Win32::UI::WindowsAndMessaging::{
    ExitWindowsEx, LockWorkStation, SendMessageW, EWX_POWEROFF, EWX_REBOOT, EWX_FORCE,
    EWX_FORCEIFHUNG, HWND_BROADCAST, SC_MONITORPOWER, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE,
    VK_MEDIA_PREV_TRACK, WM_SYSCOMMAND,
};

fn with_volume<T>(f: impl FnOnce(&IAudioEndpointVolume) -> windows::core::Result<T>) -> Result<T, String> {
    let init = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
    let result = (|| {
        unsafe {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MediaDeviceEnumerator, None, CLSCTX_ALL)?;
            let device =
                enumerator.GetDefaultAudioEndpoint(AudioDeviceKind::eRender, AudioDeviceRole::eMultimedia)?;
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
    with_volume(|epv| {
        let mut level = 0.0f32;
        unsafe { epv.GetMasterVolumeLevelScalar(&mut level)?; }
        Ok(level)
    })
}

pub fn set_volume(level: f32) -> Result<(), String> {
    let clamped = level.clamp(0.0, 1.0);
    with_volume(|epv| unsafe { epv.SetMasterVolumeLevelScalar(clamped, None) })
}

pub fn get_mute() -> Result<bool, String> {
    with_volume(|epv| {
        let mut mute = BOOL(0);
        unsafe { epv.GetMute(&mut mute)?; }
        Ok(mute.as_bool())
    })
}

pub fn set_mute(mute: bool) -> Result<(), String> {
    with_volume(|epv| unsafe { epv.SetMute(BOOL(mute as i32), None) })
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
        "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1,{value})"
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
        keybd_event(key, 0, KEYBD_EVENT_FLAGS(0), 0);
        keybd_event(key, 0, KEYBD_EVENT_FLAGS(KEYEVENTF_KEYUP), 0);
    }
    Ok(())
}

pub fn lock() -> Result<(), String> {
    unsafe {
        let ok = LockWorkStation().as_bool();
        if ok {
            Ok(())
        } else {
            Err("no se pudo bloquear la estación de trabajo".into())
        }
    }
}

pub fn sleep() -> Result<(), String> {
    unsafe {
        let ok = SetSuspendState(BOOL(0), BOOL(0), BOOL(0)).as_bool();
        if ok {
            Ok(())
        } else {
            Err("no se pudo suspender el equipo".into())
        }
    }
}

fn enable_shutdown_privilege() -> Result<(), String> {
    use windows::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, SeShutdownPrivilege, SE_PRIVILEGE_ENABLED,
        TOKEN_ADJUST_PRIVILEGES, TOKEN_QUERY, TOKEN_PRIVILEGES,
    };
    unsafe {
        let process = GetCurrentProcess();
        let mut token = Default::default();
        OpenProcessToken(process, TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY, &mut token)
            .map_err(|e| e.to_string())?;
        let mut luid = Default::default();
        LookupPrivilegeValueW(None, &SeShutdownPrivilege, &mut luid).map_err(|e| e.to_string())?;
        let mut privileges = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [luid; 1],
        };
        privileges.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
        AdjustTokenPrivileges(token, BOOL(0), Some(&mut privileges), 0, None, None)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn shutdown() -> Result<(), String> {
    let _ = enable_shutdown_privilege();
    unsafe {
        let ok = ExitWindowsEx(EWX_POWEROFF | EWX_FORCEIFHUNG, 0).as_bool();
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
        let ok = ExitWindowsEx(EWX_REBOOT | EWX_FORCE, 0).as_bool();
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
