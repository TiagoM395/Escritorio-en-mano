use windows::core::Interface as _;
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
    COINIT_APARTMENTTHREADED,
};
use windows::Win32::UI::Accessibility::{
    CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationScrollPattern,
    IUIAutomationTreeWalker, UIA_ComboBoxControlTypeId, UIA_DocumentControlTypeId,
    UIA_EditControlTypeId, UIA_ScrollPatternId,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

fn run_com<T>(f: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
    }
    let r = f();
    unsafe {
        CoUninitialize();
    }
    r
}

fn automation() -> Result<IUIAutomation, String> {
    unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER) }
        .map_err(|e| format!("no se pudo inicializar UI Automation: {e}"))
}

fn window_title(hwnd: HWND) -> String {
    let mut buf = [0u16; 256];
    let len = unsafe { GetWindowTextW(hwnd, &mut buf) };
    String::from_utf16_lossy(&buf[..len.max(0) as usize])
        .trim()
        .to_string()
}

fn element_scrollable(el: &IUIAutomationElement) -> Option<IUIAutomationScrollPattern> {
    unsafe {
        let unknown = el.GetCurrentPattern(UIA_ScrollPatternId).ok()?;
        let pattern: IUIAutomationScrollPattern = unknown.cast().ok()?;
        let vp = pattern.CurrentVerticalScrollPercent().unwrap_or(-1.0);
        let vs = pattern.CurrentVerticalViewSize().unwrap_or(100.0);
        let hp = pattern.CurrentHorizontalScrollPercent().unwrap_or(-1.0);
        let hs = pattern.CurrentHorizontalViewSize().unwrap_or(100.0);
        let scrollable = (vp >= 0.0 || hp >= 0.0) && (vs < 99.0 || hs < 99.0);
        if scrollable {
            Some(pattern)
        } else {
            None
        }
    }
}

fn first_scrollable(
    automation: &IUIAutomation,
    root: &IUIAutomationElement,
) -> Option<IUIAutomationScrollPattern> {
    unsafe {
        if let Some(p) = element_scrollable(root) {
            return Some(p);
        }
        // Recorrer el árbol en orden, cortando en el primer elemento desplazable
        // (sin construir el array completo como FindAll).
        let condition = automation.CreateTrueCondition().ok()?;
        let walker: IUIAutomationTreeWalker = automation.CreateTreeWalker(&condition).ok()?;
        let mut el = match walker.GetFirstChildElement(root) {
            Ok(e) => e,
            Err(_) => return None,
        };
        loop {
            if let Some(p) = element_scrollable(&el) {
                return Some(p);
            }
            el = match walker.GetNextSiblingElement(&el) {
                Ok(next) => next,
                Err(_) => return None,
            };
        }
    }
}

fn no_scroll() -> serde_json::Value {
    serde_json::json!({ "scrollable": false, "percent": 0.0, "viewSize": 100.0 })
}

pub fn scroll_info() -> Result<serde_json::Value, String> {
    run_com(|| {
        let fg = unsafe { GetForegroundWindow() };
        if fg.is_invalid() {
            return Ok(serde_json::json!({
                "foreground": "",
                "vertical": no_scroll(),
                "horizontal": no_scroll(),
            }));
        }
        let title = window_title(fg);
        let automation = automation()?;
        let root = unsafe { automation.ElementFromHandle(fg) }
            .map_err(|e| format!("no se pudo inspeccionar la ventana activa: {e}"))?;
        let info = match first_scrollable(&automation, &root) {
            Some(pattern) => unsafe {
                let vp = pattern.CurrentVerticalScrollPercent().unwrap_or(-1.0);
                let vs = pattern.CurrentVerticalViewSize().unwrap_or(100.0);
                let hp = pattern.CurrentHorizontalScrollPercent().unwrap_or(-1.0);
                let hs = pattern.CurrentHorizontalViewSize().unwrap_or(100.0);
                serde_json::json!({
                    "foreground": title,
                    "vertical": {
                        "scrollable": vp >= 0.0 && vs < 99.0,
                        "percent": if vp >= 0.0 { vp } else { 0.0 },
                        "viewSize": vs,
                    },
                    "horizontal": {
                        "scrollable": hp >= 0.0 && hs < 99.0,
                        "percent": if hp >= 0.0 { hp } else { 0.0 },
                        "viewSize": hs,
                    },
                })
            },
            None => serde_json::json!({
                "foreground": title,
                "vertical": no_scroll(),
                "horizontal": no_scroll(),
            }),
        };
        Ok(info)
    })
}

pub fn scroll_to(axis: &str, percent: f64) -> Result<(), String> {
    run_com(|| {
        let fg = unsafe { GetForegroundWindow() };
        if fg.is_invalid() {
            return Err("no hay una ventana activa".into());
        }
        let automation = automation()?;
        let root = unsafe { automation.ElementFromHandle(fg) }
            .map_err(|e| format!("no se pudo inspeccionar la ventana activa: {e}"))?;
        let Some(pattern) = first_scrollable(&automation, &root) else {
            return Err("no hay contenido desplazable en la ventana activa".into());
        };
        let pct = percent.clamp(0.0, 100.0);
        let (h, v) = if axis == "horizontal" {
            (pct, -1.0)
        } else {
            (-1.0, pct)
        };
        unsafe { pattern.SetScrollPercent(h, v) }
            .map_err(|e| format!("no se pudo posicionar el scroll: {e}"))
    })
}

/// Indica si el elemento enfocado de la ventana activa es un campo de texto.
/// Devuelve (¿acepta texto?, título de la ventana activa).
pub fn focused_is_text_input() -> Result<(bool, String), String> {
    run_com(|| {
        let fg = unsafe { GetForegroundWindow() };
        let title = if fg.is_invalid() {
            String::new()
        } else {
            window_title(fg)
        };
        let automation = automation()?;
        let el = unsafe { automation.GetFocusedElement() }
            .map_err(|e| format!("no se pudo obtener el elemento enfocado: {e}"))?;
        let ctype = unsafe { el.CurrentControlType().map(|t| t.0).unwrap_or(0) };
        let is_text = ctype == UIA_EditControlTypeId.0
            || ctype == UIA_DocumentControlTypeId.0
            || ctype == UIA_ComboBoxControlTypeId.0;
        Ok((is_text, title))
    })
}
