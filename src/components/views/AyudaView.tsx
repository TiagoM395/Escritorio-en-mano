import { QRCodeSVG } from 'qrcode.react';
import { useControl } from '../../hooks/useControl';
import { Icon } from '../ui/Icon';

const steps = [
  {
    title: 'Instalá la app en tu PC',
    text: 'Ejecutá “Escritorio en Mano”. Verás el ícono en la bandeja del sistema y la ventana del panel.',
  },
  {
    title: 'Conectá el teléfono',
    text: 'Los dos deben estar en la misma red Wi-Fi o LAN. Si preferís un túnel directo, activá el modo VPN (Tailscale) en Configuración.',
  },
  {
    title: 'Escanéá el código QR',
    text: 'Apuntá la cámara del teléfono al QR: se abrirá la URL con el token de acceso incluido.',
  },
  {
    title: 'Controlá desde el navegador',
    text: 'Ajustá volumen, brillo, medios y energía con la interfaz de cristal oscuro.',
  },
];

export default function AyudaView() {
  const { system, config } = useControl();
  const url = system && config ? `${system.url}/?token=${config.token}` : '';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <section className="glass-card p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white">Conectá tu teléfono</h1>
        <p className="mt-2 text-sm text-white/55">
          Seguí estos pasos para convertir tu teléfono en el control remoto de la PC.
        </p>

        <ol className="mt-6 flex flex-col gap-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-bold text-cyan-300 ring-1 ring-cyan-300/30">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-white/90">{step.title}</p>
                <p className="mt-0.5 text-sm text-white/50">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-card flex flex-col items-center gap-5 p-6 md:flex-row md:items-start md:p-8">
        <div className="flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-white p-4">
            {url ? (
              <QRCodeSVG value={url} size={190} fgColor="#0b1020" bgColor="#ffffff" />
            ) : (
              <div className="flex h-[190px] w-[190px] items-center justify-center text-xs text-slate-500">
                Cargando…
              </div>
            )}
          </div>
          <p className="text-xs text-white/40">Escanéá con la cámara del teléfono</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm font-semibold text-white/90">O ingresá la URL manualmente</p>
          <code className="token-text rounded-xl bg-white/5 px-3 py-2 font-mono text-xs text-white/80 ring-1 ring-white/10">
            {url || 'Esperando datos…'}
          </code>
          <p className="text-xs text-white/40">El token ya viene incluido en la URL.</p>

          <div className="mt-2 flex items-start gap-3 rounded-xl bg-amber-400/10 p-3 ring-1 ring-amber-300/20">
            <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-xs text-white/55">
              La conexión es local y está protegida por token. No la compartas fuera de tu red.
            </p>
          </div>
        </div>
      </section>

      <section className="glass-card p-6 md:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">Solución de problemas</h2>
        <ul className="mt-4 flex flex-col gap-3 text-sm text-white/60">
          <li className="flex gap-3">
            <Icon name="wifi" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              <strong className="text-white/85">No abre desde el teléfono:</strong> verificá que ambos estén en la misma red y que el firewall de Windows permita Node.js (aceptá el aviso al primer inicio). Si el router aísla dispositivos, probá el modo VPN (Tailscale).
            </span>
          </li>
          <li className="flex gap-3">
            <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              <strong className="text-white/85">Pide token:</strong> usá la URL que muestra la app (se genera en Configuración) o escaneá el QR.
            </span>
          </li>
          <li className="flex gap-3">
            <Icon name="screen" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              <strong className="text-white/85">No aparece el brillo:</strong> el brillo por software solo está disponible en portátiles compatibles.
            </span>
          </li>
          <li className="flex gap-3">
            <Icon name="globe" className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <span>
              <strong className="text-white/85">Aislamiento de cliente:</strong> algunos routers bloquean la comunicación entre dispositivos Wi-Fi. Probá con “aislamiento AP” desactivado.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
