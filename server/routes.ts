import { Router, type Request, type Response } from 'express';
import type { AppConfig, ControlAction, ControlRequest, ControlResponse } from './types.js';

interface RouterDeps {
  config: AppConfig;
  rustBase: string;
  getLanIp: () => string;
}

function isAuthorized(req: Request, token: string): boolean {
  const header = req.header('x-auth-token');
  const query = typeof req.query.token === 'string' ? req.query.token : undefined;
  return (header ?? query) === token;
}

function deny(res: Response): void {
  res.status(401).json({ ok: false, error: 'Token inválido o ausente' });
}

export function createRouter(deps: RouterDeps): Router {
  const router = Router();
  const { config, rustBase } = deps;

  async function callRust(action: ControlAction, value?: ControlRequest['value']): Promise<ControlResponse> {
    try {
      const response = await fetch(`${rustBase}/control`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-shared-secret': config.rustSecret,
        },
        body: JSON.stringify({ action, value }),
      });
      return (await response.json()) as ControlResponse;
    } catch {
      return { ok: false, error: 'No se pudo conectar con el motor nativo (Rust). ¿Está la app abierta?' };
    }
  }

  function auth(handler: (req: Request, res: Response) => unknown): (req: Request, res: Response) => void {
    return (req, res) => {
      if (!isAuthorized(req, config.token)) {
        return deny(res);
      }
      return void handler(req, res);
    };
  }

  // ── Salud pública (sin token) ──────────────────────────────
  router.get('/health', (_req, res) => {
    res.json({ ok: true, status: 'ok', time: Date.now() });
  });

  // ── Sistema ────────────────────────────────────────────────
  router.get(
    '/system',
    auth((_req, res) => callRust('system_info').then((r) => res.status(r.ok ? 200 : 502).json(r))),
  );

  // ── Volumen ────────────────────────────────────────────────
  router.get(
    '/volume',
    auth((_req, res) => callRust('volume_get').then((r) => res.status(r.ok ? 200 : 502).json(r))),
  );

  router.put(
    '/volume',
    auth((req, res) => {
      const value = Number(req.body?.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({ ok: false, error: 'value debe ser un número entre 0 y 100' });
      }
      return callRust('volume_set', value).then((r) => res.status(r.ok ? 200 : 502).json(r));
    }),
  );

  // ── Silencio ───────────────────────────────────────────────
  router.get(
    '/mute',
    auth((_req, res) => callRust('mute_get').then((r) => res.status(r.ok ? 200 : 502).json(r))),
  );

  router.put(
    '/mute',
    auth((req, res) => {
      if (typeof req.body?.muted !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'muted debe ser booleano' });
      }
      return callRust('mute_set', req.body.muted).then((r) => res.status(r.ok ? 200 : 502).json(r));
    }),
  );

  // ── Brillo ─────────────────────────────────────────────────
  router.get(
    '/brightness',
    auth((_req, res) => callRust('brightness_get').then((r) => res.status(r.ok ? 200 : 502).json(r))),
  );

  router.put(
    '/brightness',
    auth((req, res) => {
      const value = Number(req.body?.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return res.status(400).json({ ok: false, error: 'value debe ser un número entre 0 y 100' });
      }
      return callRust('brightness_set', value).then((r) => res.status(r.ok ? 200 : 502).json(r));
    }),
  );

  // ── Acciones de energía ────────────────────────────────────
  const actions: Record<string, ControlAction> = {
    lock: 'lock',
    sleep: 'sleep',
    shutdown: 'shutdown',
    restart: 'restart',
    'display-off': 'display_off',
  };

  for (const [route, action] of Object.entries(actions)) {
    router.post(
      `/actions/${route}`,
      auth((_req, res) => callRust(action).then((r) => res.status(r.ok ? 200 : 502).json(r))),
    );
  }

  // ── Medios ─────────────────────────────────────────────────
  router.post(
    '/media',
    auth((req, res) => {
      const action = String(req.body?.action ?? '');
      if (!['next', 'prev', 'play_pause'].includes(action)) {
        return res.status(400).json({ ok: false, error: 'action debe ser next, prev o play_pause' });
      }
      return callRust('media', action).then((r) => res.status(r.ok ? 200 : 502).json(r));
    }),
  );

  // ── Configuración ──────────────────────────────────────────
  router.get(
    '/config',
    auth(async (_req, res) => {
      try {
        const response = await fetch(`${rustBase}/config`, {
          headers: { 'x-shared-secret': config.rustSecret },
        });
        const payload = (await response.json()) as ControlResponse;
        res.status(response.ok ? 200 : 502).json(payload);
      } catch {
        res.status(502).json({ ok: false, error: 'No se pudo conectar con el motor nativo (Rust).' });
      }
    }),
  );

  router.put(
    '/config',
    auth(async (req, res) => {
      try {
        const response = await fetch(`${rustBase}/config`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-shared-secret': config.rustSecret,
          },
          body: JSON.stringify(req.body ?? {}),
        });
        const payload = (await response.json()) as { ok: boolean; data?: unknown; error?: string };
        res.status(response.ok ? 200 : 400).json(payload);
      } catch {
        res.status(502).json({ ok: false, error: 'No se pudo conectar con el motor nativo (Rust).' });
      }
    }),
  );

  return router;
}
