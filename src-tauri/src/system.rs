use std::net::ToSocketAddrs;
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ};
use windows::Win32::System::SystemInformation::{GetComputerNameW, GlobalMemoryStatusEx, MEMORYSTATUSEX};

pub fn os_name() -> String {
    "Windows".to_string()
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn cpu_name() -> String {
    let key = wide("HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0");
    let value = wide("ProcessorNameString");
    let mut buf = [0u16; 512];
    let mut size = (buf.len() * 2) as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_LOCAL_MACHINE,
            PCWSTR(key.as_ptr()),
            PCWSTR(value.as_ptr()),
            RRF_RT_REG_SZ,
            None,
            Some(buf.as_mut_ptr() as *mut _),
            Some(&mut size),
        )
    };
    if result.is_ok() {
        let s = String::from_utf16_lossy(&buf[..(size as usize / 2).min(buf.len())]);
        let s = s.trim();
        if !s.is_empty() {
            return s.to_string();
        }
    }
    "Desconocido".to_string()
}

pub fn memory_mb() -> (u64, u64) {
    let mut info = MEMORYSTATUSEX::default();
    info.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
    let ok = unsafe { GlobalMemoryStatusEx(&mut info) }.as_bool();
    if ok {
        (info.ullTotalPhys / 1024 / 1024, info.ullAvailPhys / 1024 / 1024)
    } else {
        (0, 0)
    }
}

pub fn lan_ip() -> String {
    let mut buf = [0u16; 256];
    let mut len = buf.len() as u32;
    let ok = unsafe { GetComputerNameW(&mut buf, &mut len) }.as_bool();
    if ok {
        let name = String::from_utf16_lossy(&buf[..(len as usize).min(buf.len())]);
        if let Ok(addrs) = (name.as_str(), 0u16).to_socket_addrs() {
            for addr in addrs {
                if let std::net::IpAddr::V4(v4) = addr.ip() {
                    if !v4.is_loopback() {
                        return v4.to_string();
                    }
                }
            }
        }
    }
    "127.0.0.1".to_string()
}
