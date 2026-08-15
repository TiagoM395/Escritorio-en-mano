export type ViewId = 'panel' | 'config' | 'ayuda';

export type MediaAction = 'next' | 'prev' | 'play_pause';

export type PowerAction = 'lock' | 'sleep' | 'shutdown' | 'restart' | 'display_off';

export interface SystemInfo {
  os: string;
  cpu: string;
  ramTotalMb: number;
  ramFreeMb: number;
  ip: string;
  port: number;
  url: string;
  volume: number;
  muted: boolean;
  brightness: number;
  brightnessSupported: boolean;
}

export interface AppConfig {
  server: { host: string; port: number; rustApiPort: number };
  token: string;
  app: { autoStart: boolean; minimizeToTray: boolean; lanIp: string };
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface Bootstrap {
  apiBase: string;
  token: string;
}
