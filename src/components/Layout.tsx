import type { ReactNode } from 'react';
import { useControl } from '../hooks/useControl';
import Header from './Header';
import { Icon, type IconName } from './ui/Icon';
import type { ViewId } from '../types';

const navItems: { id: ViewId; label: string; icon: IconName }[] = [
  { id: 'panel', label: 'Panel', icon: 'zap' },
  { id: 'config', label: 'Configuración', icon: 'settings' },
  { id: 'ayuda', label: 'Ayuda', icon: 'help' },
];

interface Props {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  children: ReactNode;
}

export default function Layout({ view, onNavigate, children }: Props) {
  const { connected } = useControl();

  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Barra lateral (escritorio) */}
      <aside className="glass hidden w-60 shrink-0 flex-col gap-2 border-r border-white/10 p-4 md:flex">
        <div className="mb-4 flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-900 shadow-lg shadow-cyan-500/20">
            <Icon name="hand" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">Escritorio en Mano</p>
            <p className="text-xs text-white/40">Control remoto local</p>
          </div>
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              view === item.id
                ? 'bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </button>
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-white/50">
          <span
            className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 shadow shadow-emerald-400/50' : 'bg-red-400'}`}
          />
          {connected ? 'Servidor local activo' : 'Servidor sin conexión'}
        </div>
      </aside>

      {/* Área principal */}
      <div className="flex min-h-full flex-1 flex-col">
        <Header onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto p-4 pb-28 md:p-8 md:pb-8">{children}</main>
      </div>

      {/* Navegación inferior (móvil) */}
      <nav className="glass fixed inset-x-0 bottom-0 z-30 flex md:hidden">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
              view === item.id ? 'text-cyan-300' : 'text-white/50'
            }`}
          >
            <Icon name={item.icon} className="h-5 w-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
