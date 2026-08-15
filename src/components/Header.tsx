import { useControl } from '../hooks/useControl';
import { Icon } from './ui/Icon';
import type { ViewId } from '../types';

interface Props {
  onNavigate: (view: ViewId) => void;
}

export default function Header({ onNavigate }: Props) {
  const { connected, apiBase, refresh } = useControl();

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#060714]/70 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('panel')} className="flex items-center gap-2 text-white">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-900 shadow-lg shadow-cyan-500/20">
            <Icon name="hand" className="h-5 w-5" />
          </span>
          <span className="hidden text-sm font-semibold sm:block">Escritorio en Mano</span>
        </button>
        <a
          href={apiBase}
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/50 ring-1 ring-white/10 transition-colors hover:text-white lg:flex"
        >
          <Icon name="globe" className="h-3.5 w-3.5" />
          {apiBase.replace(/^https?:\/\//, '')}
        </a>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${
            connected
              ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-300/30'
              : 'bg-red-400/10 text-red-300 ring-red-300/30'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulse bg-emerald-400' : 'bg-red-400'}`}
          />
          {connected ? 'En línea' : 'Sin conexión'}
        </span>
        <button
          onClick={() => void refresh()}
          title="Actualizar datos"
          className="rounded-lg bg-white/5 p-2 text-white/60 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="refresh" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
