import { useState } from 'react';
import { useControl } from '../../hooks/useControl';
import type { PowerAction } from '../../types';
import ActionCard from '../ui/ActionCard';
import ModalConfirm from '../ui/ModalConfirm';
import SliderVolume from '../ui/SliderVolume';
import { Icon, type IconName } from '../ui/Icon';

interface ConfirmMeta {
  title: string;
  message: string;
  icon: IconName;
  danger?: boolean;
  label: string;
}

const confirmMeta: Record<PowerAction, ConfirmMeta> = {
  shutdown: {
    title: 'Apagar el equipo',
    message: 'Se cerrarán todas las aplicaciones y el equipo se apagará.',
    icon: 'power',
    danger: true,
    label: 'Apagar',
  },
  restart: {
    title: 'Reiniciar el equipo',
    message: 'El equipo se reiniciará por completo. Guardá tu trabajo antes.',
    icon: 'restart',
    danger: true,
    label: 'Reiniciar',
  },
  sleep: {
    title: 'Suspender el equipo',
    message: 'El equipo entrará en estado de suspensión.',
    icon: 'moon',
    label: 'Suspender',
  },
  lock: {
    title: 'Bloquear el equipo',
    message: 'La sesión actual se bloqueará y pedirá contraseña.',
    icon: 'lock',
    label: 'Bloquear',
  },
  display_off: {
    title: 'Apagar la pantalla',
    message: 'La pantalla se apagará sin suspender el equipo.',
    icon: 'screen',
    label: 'Apagar pantalla',
  },
};

function fmtMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

export default function PanelView() {
  const { system, connected, setVolume, toggleMute, setBrightness, media, powerAction, refresh } = useControl();
  const [confirm, setConfirm] = useState<PowerAction | null>(null);

  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: 'cpu', label: 'Procesador', value: system?.cpu ?? '—' },
    {
      icon: 'ram',
      label: 'Memoria RAM',
      value: system ? `${fmtMb(system.ramTotalMb)} (${Math.round((system.ramFreeMb / Math.max(1, system.ramTotalMb)) * 100)}% libre)` : '—',
    },
    { icon: 'monitor', label: 'Sistema operativo', value: system?.os ?? '—' },
    { icon: 'wifi', label: 'Acceso desde el teléfono', value: system?.url ?? '—' },
  ];

  const handleConfirm = () => {
    if (!confirm) return;
    void powerAction(confirm);
    setConfirm(null);
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      {/* Encabezado de bienvenida */}
      <section className="glass-card relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-24 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <p className="text-xs font-medium uppercase tracking-widest text-cyan-300/80">Panel de control</p>
        <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Tu PC, en la palma de tu mano</h1>
        <p className="mt-2 max-w-xl text-sm text-white/55">
          Ajustá el volumen, manejá los medios o apagá el equipo desde cualquier dispositivo de la red local.
        </p>
        {!connected && (
          <button
            onClick={() => void refresh()}
            className="mt-4 rounded-xl bg-cyan-400/90 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-300"
          >
            Reconectar al servidor
          </button>
        )}
      </section>

      {/* Información del sistema */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Estado del equipo</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="glass-card p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-cyan-300 ring-1 ring-white/10">
                <Icon name={s.icon} className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-white/40">{s.label}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold text-white/90">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sonido */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Sonido</h2>
        <div className="glass-card flex items-center gap-5 p-5">
          <SliderVolume
            label="Volumen del sistema"
            icon="volume"
            value={system?.volume ?? 50}
            disabled={!connected}
            onChange={setVolume}
            onCommit={setVolume}
            className="flex-1"
          />
          <button
            onClick={() => void toggleMute()}
            disabled={!connected}
            aria-label={system?.muted ? 'Activar sonido' : 'Silenciar'}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 transition-colors disabled:opacity-40 ${
              system?.muted
                ? 'bg-red-400/15 text-red-300 ring-red-300/40'
                : 'bg-white/5 text-white/80 ring-white/10 hover:bg-white/10'
            }`}
          >
            <Icon name={system?.muted ? 'mute' : 'volume'} className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Brillo */}
      {system?.brightnessSupported && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Pantalla</h2>
          <div className="glass-card p-5">
            <SliderVolume
              label="Brillo de la pantalla"
              icon="brightness"
              value={system.brightness}
              disabled={!connected}
              onChange={setBrightness}
              onCommit={setBrightness}
            />
          </div>
        </section>
      )}

      {/* Medios */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Medios</h2>
        <div className="grid grid-cols-3 gap-3">
          <button className="media-btn" onClick={() => void media('prev')} disabled={!connected} aria-label="Anterior">
            <Icon name="prev" className="h-6 w-6" />
          </button>
          <button
            className="media-btn primary"
            onClick={() => void media('play_pause')}
            disabled={!connected}
            aria-label="Reproducir / Pausar"
          >
            <Icon name="play" className="h-6 w-6" />
          </button>
          <button className="media-btn" onClick={() => void media('next')} disabled={!connected} aria-label="Siguiente">
            <Icon name="next" className="h-6 w-6" />
          </button>
        </div>
      </section>

      {/* Energía */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/40">Energía</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ActionCard icon="lock" title="Bloquear" subtitle="Bloquea la sesión" onClick={() => void powerAction('lock')} disabled={!connected} />
          <ActionCard icon="moon" title="Suspender" subtitle="Sueño profundo" onClick={() => setConfirm('sleep')} disabled={!connected} />
          <ActionCard icon="screen" title="Apagar pantalla" subtitle="Ahorrá energía" onClick={() => setConfirm('display_off')} disabled={!connected} />
          <ActionCard icon="restart" title="Reiniciar" subtitle="Reinicia Windows" danger onClick={() => setConfirm('restart')} disabled={!connected} />
          <ActionCard icon="power" title="Apagar" subtitle="Apaga Windows" danger onClick={() => setConfirm('shutdown')} disabled={!connected} />
        </div>
      </section>

      <ModalConfirm
        open={confirm !== null}
        title={confirm ? confirmMeta[confirm].title : ''}
        message={confirm ? confirmMeta[confirm].message : ''}
        icon={confirm ? confirmMeta[confirm].icon : 'power'}
        confirmLabel={confirm ? confirmMeta[confirm].label : 'Confirmar'}
        danger={confirm ? confirmMeta[confirm].danger : false}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
