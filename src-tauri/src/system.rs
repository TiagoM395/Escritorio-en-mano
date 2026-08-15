use windows::core::{PCWSTR, PWSTR};
use windows::Win32::NetworkManagement::IpHelper::{
    GetAdaptersAddresses, GAA_FLAG_INCLUDE_GATEWAYS, IP_ADAPTER_ADDRESSES_LH,
};
use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;
use windows::Win32::Networking::WinSock::{AF_INET, AF_UNSPEC, SOCKADDR, SOCKADDR_IN};
use windows::Win32::System::Registry::{RegGetValueW, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ};
use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

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
        let s = s.trim_end_matches('\0').trim();
        if !s.is_empty() {
            return s.to_string();
        }
    }
    "Desconocido".to_string()
}

pub fn memory_mb() -> (u64, u64) {
    let mut info = MEMORYSTATUSEX::default();
    info.dwLength = std::mem::size_of::<MEMORYSTATUSEX>() as u32;
    let ok = unsafe { GlobalMemoryStatusEx(&mut info) }.is_ok();
    if ok {
        (info.ullTotalPhys / 1024 / 1024, info.ullAvailPhys / 1024 / 1024)
    } else {
        (0, 0)
    }
}

struct AdapterInfo {
    name: String,
    ip: String,
    is_up: bool,
    has_gateway: bool,
}

fn enumerate_adapters() -> Vec<AdapterInfo> {
    const ERROR_BUFFER_OVERFLOW: u32 = 111;
    let flags = GAA_FLAG_INCLUDE_GATEWAYS;
    let family = AF_UNSPEC.0 as u32;

    let mut size: u32 = 0;
    let status = unsafe { GetAdaptersAddresses(family, flags, None, None, &mut size) };
    if status != ERROR_BUFFER_OVERFLOW && status != 0 {
        return Vec::new();
    }
    if size == 0 {
        return Vec::new();
    }

    // Vec<u64> garantiza la alineación de la lista enlazada.
    let mut buf = vec![0u64; (size as usize + 7) / 8];
    let status = unsafe {
        GetAdaptersAddresses(
            family,
            flags,
            None,
            Some(buf.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH),
            &mut size,
        )
    };
    if status != 0 {
        return Vec::new();
    }

    let mut out = Vec::new();
    let mut adapter = buf.as_ptr() as *const IP_ADAPTER_ADDRESSES_LH;
    while !adapter.is_null() {
        let a = unsafe { &*adapter };
        let name = unsafe { PWSTR(a.FriendlyName.0).to_string() }.unwrap_or_default();
        let is_up = a.OperStatus == IfOperStatusUp;
        let has_gateway = !a.FirstGatewayAddress.is_null();
        let mut addr = a.FirstUnicastAddress;
        while !addr.is_null() {
            let ua = unsafe { &*addr };
            if let Some(ip) = unsafe { ipv4_from_sockaddr(ua.Address.lpSockaddr) } {
                out.push(AdapterInfo {
                    name: name.clone(),
                    ip,
                    is_up,
                    has_gateway,
                });
            }
            addr = ua.Next;
        }
        adapter = a.Next;
    }
    out
}

/// IP de la red local: prefiere el adaptador activo con puerta de enlace
/// (excluye VPN tipo Tailscale, redes host-only y direcciones de enlace local).
pub fn lan_ip() -> String {
    let mut preferred: Option<String> = None;
    let mut fallback: Option<String> = None;
    for info in enumerate_adapters() {
        if !is_usable_lan_ip(&info.ip) {
            continue;
        }
        if info.is_up && info.has_gateway {
            if preferred.is_none() {
                preferred = Some(info.ip);
            }
        } else if fallback.is_none() {
            fallback = Some(info.ip);
        }
    }
    preferred.or(fallback).unwrap_or_else(|| "127.0.0.1".to_string())
}

/// IP del túnel VPN (Tailscale / WireGuard) si el adaptador está activo.
pub fn vpn_ip() -> String {
    for info in enumerate_adapters() {
        let name = info.name.to_lowercase();
        if (name.contains("tailscale") || name.contains("wireguard")) && info.is_up {
            return info.ip;
        }
    }
    String::new()
}

unsafe fn ipv4_from_sockaddr(sa: *mut SOCKADDR) -> Option<String> {
    if sa.is_null() {
        return None;
    }
    let sockaddr = unsafe { &*sa };
    if sockaddr.sa_family != AF_INET {
        return None;
    }
    let sin = unsafe { &*(sa as *const SOCKADDR_IN) };
    let b = sin.sin_addr.S_un.S_un_b;
    Some(format!("{}.{}.{}.{}", b.s_b1, b.s_b2, b.s_b3, b.s_b4))
}

fn is_usable_lan_ip(ip: &str) -> bool {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    let oct: Vec<u32> = parts.iter().map(|p| p.parse().unwrap_or(256)).collect();
    let loopback = oct[0] == 127;
    let unspecified = oct[0] == 0;
    let link_local = oct[0] == 169 && oct[1] == 254;
    let broadcast = oct[0] == 255 && oct[1] == 255 && oct[2] == 255 && oct[3] == 255;
    !(loopback || unspecified || link_local || broadcast)
}
