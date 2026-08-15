export type ViewId = 'panel' | 'config' | 'ayuda';

export type MediaAction = 'next' | 'prev' | 'play_pause';

export type PowerAction = 'lock' | 'sleep' | 'shutdown' | 'restart' | 'display_off';

export type MouseButton = 'left' | 'right' | 'middle';

export interface ScrollAxis {
  scrollable: boolean;
  percent: number;
  viewSize: number;
}

export interface ScrollInfo {
  foreground: string;
  vertical: ScrollAxis;
  horizontal: ScrollAxis;
}

export interface TextInputStatus {
  active: boolean;
  window: string;
}

export interface SystemInfo {
  os: string;
  cpu: string;
  ramTotalMb: number;
  ramFreeMb: number;
  ip: string;
  vpnIp?: string;
  port: number;
  url: string;
  volume: number;
  muted: boolean;
  brightness: number;
  brightnessSupported: boolean;
}

export type ConnectionMode = 'wifi' | 'vpn';

export interface AppConfig {
  server: { host: string; port: number; rustApiPort: number };
  token: string;
  app: { autoStart: boolean; minimizeToTray: boolean; lanIp: string; connectionMode?: ConnectionMode };
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
