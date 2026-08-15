export type ControlAction =
  | 'volume_get'
  | 'volume_set'
  | 'mute_get'
  | 'mute_set'
  | 'brightness_get'
  | 'brightness_set'
  | 'lock'
  | 'sleep'
  | 'shutdown'
  | 'restart'
  | 'display_off'
  | 'media'
  | 'system_info';

export interface ControlRequest {
  action: ControlAction;
  value?: number | boolean | string;
}

export interface ControlResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ServerConfig {
  host: string;
  port: number;
  rustApiPort: number;
}

export interface AppPrefs {
  autoStart: boolean;
  minimizeToTray: boolean;
  lanIp?: string;
}

export interface AppConfig {
  server: ServerConfig;
  token: string;
  rustSecret: string;
  app: AppPrefs;
}

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
