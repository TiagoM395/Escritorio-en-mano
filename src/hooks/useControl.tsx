import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import type {
  AppConfig,
  ApiResponse,
  Bootstrap,
  MediaAction,
  MouseButton,
  PowerAction,
  ScrollInfo,
  SystemInfo,
  TextInputStatus,
} from '../types';

export type ConfigPatch = Partial<AppConfig> & { regenerateToken?: boolean };

interface ControlValue {
  system: SystemInfo | null;
  config: AppConfig | null;
  connected: boolean;
  error: string | null;
  configError: string | null;
  apiBase: string;
  refresh: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  setVolume: (value: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  setBrightness: (value: number) => Promise<void>;
  media: (action: MediaAction) => Promise<void>;
  powerAction: (action: PowerAction) => Promise<void>;
  mouseMove: (dx: number, dy: number) => Promise<void>;
  mouseClick: (button?: MouseButton) => Promise<void>;
  mouseButton: (button: MouseButton, down: boolean) => Promise<void>;
  mouseScroll: (dx: number, dy: number) => Promise<void>;
  getScrollInfo: () => Promise<ScrollInfo | null>;
  mouseScrollTo: (axis: 'vertical' | 'horizontal', percent: number) => Promise<void>;
  focusedTextInput: () => Promise<TextInputStatus | null>;
  typeText: (text: string) => Promise<void>;
  saveConfig: (patch: ConfigPatch) => Promise<AppConfig>;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const ControlContext = createContext<ControlValue | null>(null);

export function ControlProvider({ children }: { children: ReactNode }) {
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState('http://127.0.0.1:7456');

  const tokenRef = useRef('');

  const loadBootstrap = useCallback(async () => {
    if (isTauri()) {
      try {
        const b = await invoke<Bootstrap>('get_bootstrap');
        setApiBase(b.apiBase);
        tokenRef.current = b.token;
        return;
      } catch {
        // Si falla el comando, usar el origen actual.
      }
    }
    setApiBase(window.location.origin);
    tokenRef.current = new URLSearchParams(window.location.search).get('token') ?? '';
  }, []);

  const api = useCallback(
    async <T,>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'x-auth-token': tokenRef.current,
      };
      const res = await fetch(`${apiBase}/api${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as ApiResponse | null;
        throw new Error(payload?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ApiResponse<T>;
      if (!json.ok) throw new Error(json.error ?? 'Error desconocido');
      return json.data as T;
    },
    [apiBase],
  );

  const refresh = useCallback(async () => {
    const info = await api<SystemInfo>('/system');
    setSystem(info);
    setError(null);
  }, [api]);

  const refreshConfig = useCallback(async () => {
    try {
      setConfig(await api<AppConfig>('/config'));
      setConfigError(null);
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    let disposed = false;
    let id: ReturnType<typeof setInterval> | undefined;
    void loadBootstrap().then(() => {
      if (disposed) return;
      const tick = async () => {
        void refreshConfig();
        try {
          const res = await fetch(`${apiBase}/api/health`);
          if (!res.ok) throw new Error('health');
          if (tokenRef.current) await refresh();
          if (!disposed) setConnected(true);
        } catch {
          if (!disposed) setConnected(false);
        }
      };
      void tick();
      id = setInterval(tick, 5000);
    });
    return () => {
      disposed = true;
      if (id !== undefined) clearInterval(id);
    };
  }, [apiBase, loadBootstrap, refresh, refreshConfig]);

  const setVolume = useCallback(
    async (value: number) => {
      const v = Math.round(Math.max(0, Math.min(100, value)));
      try {
        await api('/volume', { method: 'PUT', body: { value: v } });
        setSystem((s) => (s ? { ...s, volume: v, muted: false } : s));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const toggleMute = useCallback(async () => {
    const next = !(system?.muted ?? false);
    try {
      await api('/mute', { method: 'PUT', body: { muted: next } });
      setSystem((s) => (s ? { ...s, muted: next } : s));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, system?.muted]);

  const setBrightness = useCallback(
    async (value: number) => {
      const v = Math.round(Math.max(0, Math.min(100, value)));
      try {
        await api('/brightness', { method: 'PUT', body: { value: v } });
        setSystem((s) => (s ? { ...s, brightness: v } : s));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const media = useCallback(
    async (action: MediaAction) => {
      try {
        await api('/media', { method: 'POST', body: { action } });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const powerAction = useCallback(
    async (action: PowerAction) => {
      try {
        await api(`/actions/${action}`, { method: 'POST' });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const mouseMove = useCallback(async (dx: number, dy: number) => {
    await api('/mouse/move', { method: 'POST', body: { dx, dy } });
  }, [api]);

  const mouseClick = useCallback(
    async (button: MouseButton = 'left') => {
      try {
        await api('/mouse/click', { method: 'POST', body: { button } });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const mouseButton = useCallback(
    async (button: MouseButton, down: boolean) => {
      try {
        await api('/mouse/button', { method: 'POST', body: { button, down } });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const mouseScroll = useCallback(
    async (dx: number, dy: number) => {
      try {
        await api('/mouse/scroll', { method: 'POST', body: { dx, dy } });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const getScrollInfo = useCallback(async () => {
    try {
      const info = await api<ScrollInfo>('/mouse/scroll-info');
      setError(null);
      return info;
    } catch {
      return null;
    }
  }, [api]);

  const focusedTextInput = useCallback(async () => {
    try {
      return await api<TextInputStatus>('/keyboard/focused-text-input');
    } catch {
      return null;
    }
  }, [api]);

  const typeText = useCallback(
    async (text: string) => {
      await api('/keyboard/type', { method: 'POST', body: { text } });
    },
    [api],
  );

  const mouseScrollTo = useCallback(
    async (axis: 'vertical' | 'horizontal', percent: number) => {
      const p = Math.round(Math.max(0, Math.min(100, percent)));
      try {
        await api('/mouse/scroll-to', { method: 'POST', body: { axis, percent: p } });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [api],
  );

  const saveConfig = useCallback(
    async (patch: ConfigPatch) => {
      const next = await api<AppConfig>('/config', { method: 'PUT', body: patch });
      tokenRef.current = next.token;
      setConfig(next);
      return next;
    },
    [api],
  );

  const value = useMemo<ControlValue>(
    () => ({
      system,
      config,
      connected,
      error,
      configError,
      apiBase,
      refresh,
      refreshConfig,
      setVolume,
      toggleMute,
      setBrightness,
      media,
      powerAction,
      mouseMove,
      mouseClick,
      mouseButton,
      mouseScroll,
      getScrollInfo,
      mouseScrollTo,
      focusedTextInput,
      typeText,
      saveConfig,
    }),
    [
      system,
      config,
      connected,
      error,
      configError,
      apiBase,
      refresh,
      refreshConfig,
      setVolume,
      toggleMute,
      setBrightness,
      media,
      powerAction,
      mouseMove,
      mouseClick,
      mouseButton,
      mouseScroll,
      getScrollInfo,
      mouseScrollTo,
      focusedTextInput,
      typeText,
      saveConfig,
    ],
  );

  return <ControlContext.Provider value={value}>{children}</ControlContext.Provider>;
}

export function useControl(): ControlValue {
  const ctx = useContext(ControlContext);
  if (!ctx) throw new Error('useControl debe usarse dentro de ControlProvider');
  return ctx;
}
