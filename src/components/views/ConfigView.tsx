import { useEffect, useState } from 'react';
import { useControl } from '../../hooks/useControl';
import ModalConfirm from '../ui/ModalConfirm';
import { Icon } from '../ui/Icon';

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-cyan-400' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function ConfigView() {
  const { config, system, saveConfig, connected } = useControl();
  const [port, setPort] = useState('7456');
  const [showToken, setShowToken] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    if (config) setPort(String(config.server.port));
  }, [config]);

  if (!config) {
    return (
      <div className="glass-card mx-auto max-w-2xl p-8 text-center text-sm text-white/50">
        Cargando configuración…
      </div>
    );
  }

  const connectionUrl = system ? `${system.url}/?token=${config.token}` : '';

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permisos de portapapeles: el usuario puede copiar manualmente.
    }
  };

  const savePort = async () => {
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) return;
    setSaving(true);
    try {
      await saveConfig({ server: { ...config.server, port: p } });
      setSavedNote(true);
      setTimeout(() => setSavedNote(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const togglePref = async (key: 'autoStart' | 'minimizeToTray') => {
    setSaving(true);
    try {
      await saveConfig({ app: { ...config.app, [key]: !config.app[key] } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Conexión</h2>
        <div className="glass-card flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">URL para el teléfono</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={connectionUrl || 'Conectando…'}
                className="token-text flex-1 rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-white/80 ring-1 ring-white/10 outline-none"
              />
              <button
                onClick={() => void copyText(connectionUrl)}
                className="rounded-xl bg-white/5 p-2.5 text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                aria-label="Copiar URL"
              >
                <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-white/40">
              {connectionUrl
                ? 'Abrila desde el navegador del teléfono, en la misma red Wi-Fi.'
                : 'Esperando datos del servidor…'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">Token de acceso</span>
            <div className="flex items-center gap-2">
              <code className="token-text flex-1 rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-white/80 ring-1 ring-white/10">
                {showToken ? config.token : '••••••••••••••••••••'}
              </code>
              <button
                onClick={() => setShowToken((v) => !v)}
                className="rounded-xl bg-white/5 p-2.5 text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                aria-label="Mostrar token"
              >
                <Icon name={showToken ? 'close' : 'key'} className="h-4 w-4" />
              </button>
              <button
                onClick={() => void copyText(config.token)}
                className="rounded-xl bg-white/5 p-2.5 text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10"
                aria-label="Copiar token"
              >
                <Icon name="copy" className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRegenerating(true)}
                disabled={!connected || saving}
                className="rounded-xl bg-amber-400/15 px-3 py-2 text-xs font-semibold text-amber-300 ring-1 ring-amber-300/30 transition-colors hover:bg-amber-400/25 disabled:opacity-40"
              >
                Regenerar token
              </button>
              {savedNote && <span className="text-xs text-emerald-300">Guardado ✓</span>}
            </div>
            <p className="text-xs text-white/40">
              Al regenerar, la URL cambia. Copiá la nueva en tus dispositivos.
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Comportamiento</h2>
        <div className="glass-card flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/85">Iniciar con Windows</p>
              <p className="text-xs text-white/40">Arranca la app junto con el sistema.</p>
            </div>
            <Switch
              checked={config.app.autoStart}
              onChange={() => void togglePref('autoStart')}
              disabled={!connected || saving}
              label="Iniciar con Windows"
            />
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/85">Minimizar a la bandeja</p>
              <p className="text-xs text-white/40">Al cerrar la ventana, la app sigue en la bandeja del sistema.</p>
            </div>
            <Switch
              checked={config.app.minimizeToTray}
              onChange={() => void togglePref('minimizeToTray')}
              disabled={!connected || saving}
              label="Minimizar a la bandeja"
            />
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white/85">Puerto del servidor</p>
              <p className="text-xs text-white/40">Requiere reiniciar la aplicación para aplicarse.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-28 rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 outline-none focus:ring-cyan-300/40"
              />
              <button
                onClick={() => void savePort()}
                disabled={!connected || saving}
                className="rounded-xl bg-cyan-400/90 px-3 py-2 text-xs font-semibold text-slate-900 transition-colors hover:bg-cyan-300 disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </section>

      <ModalConfirm
        open={regenerating}
        title="Regenerar token de acceso"
        message="Se invalidará el token actual en todos los dispositivos. Copiá la nueva URL para seguir conectado."
        icon="key"
        confirmLabel="Regenerar"
        danger
        onConfirm={() => {
          setRegenerating(false);
          void saveConfig({ regenerateToken: true });
        }}
        onClose={() => setRegenerating(false)}
      />
    </div>
  );
}
