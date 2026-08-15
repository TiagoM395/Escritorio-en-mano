import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './routes.js';
import type { AppConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function defaultConfig(): AppConfig {
  return {
    server: { host: '0.0.0.0', port: 7456, rustApiPort: 7457 },
    token: '',
    rustSecret: '',
    app: { autoStart: false, minimizeToTray: true, lanIp: '', connectionMode: 'wifi' },
  };
}

function resolveConfigPath(): string {
  const candidates = [
    process.env.CONFIG_PATH,
    path.resolve(process.cwd(), 'config.json'),
    path.resolve(__dirname, '..', 'config.json'),
    path.resolve(__dirname, '..', '..', 'config.json'),
  ].filter((p): p is string => Boolean(p) && fs.existsSync(p as string));
  if (candidates.length > 0) return candidates[0];
  const fallback = path.resolve(process.cwd(), 'config.json');
  fs.writeFileSync(fallback, JSON.stringify(defaultConfig(), null, 2));
  return fallback;
}

function loadConfig(): AppConfig {
  const configPath = resolveConfigPath();
  let raw = defaultConfig();
  try {
    const text = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '');
    raw = { ...raw, ...(JSON.parse(text) as Partial<AppConfig>) };
    raw.server = { ...defaultConfig().server, ...raw.server };
    raw.app = { ...defaultConfig().app, ...raw.app };
  } catch {
    // config.json ausente o corrupto: usar valores por defecto
  }
  if (process.env.APP_TOKEN) raw.token = process.env.APP_TOKEN;
  if (process.env.RUST_SECRET) raw.rustSecret = process.env.RUST_SECRET;
  if (process.env.SERVER_PORT) raw.server.port = Number(process.env.SERVER_PORT);
  return raw;
}

function getLanIp(): string {
  if (process.env.LAN_IP && process.env.LAN_IP.trim()) return process.env.LAN_IP.trim();
  const ifaces = os.networkInterfaces();
  const isLanName = (name: string) => /wi-?fi|ethernet|lan|wlan/i.test(name);
  const isVirtualName = (name: string) => /tailscale|virtual|vmware|virtualbox|hyper|loopback|bluetooth/i.test(name);
  const inCgnat = (a: string) => a.startsWith('100.64.') || a.startsWith('100.65.') || a.startsWith('100.127.');
  const candidates: string[] = [];
  let fallback: string | null = null;
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      const addr = net.address;
      if (addr.startsWith('127.') || addr.startsWith('169.254.')) continue;
      if (isVirtualName(name) || inCgnat(addr)) continue;
      if (isLanName(name)) candidates.push(addr);
      else if (fallback === null) fallback = addr;
    }
  }
  return candidates[0] ?? fallback ?? '127.0.0.1';
}

const config = loadConfig();
const rustBase = process.env.RUST_API_URL ?? `http://127.0.0.1:${config.server.rustApiPort}`;

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.use('/api', createRouter({ config, rustBase, getLanIp }));

// Servir el frontend compilado (producción / teléfono)
const distDir = path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Middleware de errores (JSON inválido, etc.)
app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ ok: false, error: 'JSON inválido' });
    return;
  }
  console.error('[server]', err);
  res.status(500).json({ ok: false, error: 'Error interno del servidor' });
});

const host = process.env.HOST ?? config.server.host;
const port = config.server.port;

app.listen(port, host, () => {
  const ip = getLanIp();
  const url = `http://${ip}:${port}`;
  console.log(`[server] Escritorio en Mano en ${url}`);
  console.log(`[server] Interfaz de escucha: ${host}:${port}`);
});
