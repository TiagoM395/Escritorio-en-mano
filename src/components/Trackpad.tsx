import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useControl } from '../hooks/useControl';
import type { ScrollInfo } from '../types';
import { Icon } from './ui/Icon';
import TrackpadKeyboard from './TrackpadKeyboard';

const SENSITIVITY = 2;
const TAP_THRESHOLD = 10;
const TAP_MAX_MS = 400;
const SCROLL_STEP = 18;
const MOVE_SEND_MS = 16;
const SCROLL_POLL_MS = 1000;
const SCROLL_SEND_MS = 60;

function ScrollBar({
  axis,
  percent,
  viewSize,
  onStart,
  onChange,
  onEnd,
}: {
  axis: 'vertical' | 'horizontal';
  percent: number;
  viewSize: number;
  onStart: () => void;
  onChange: (p: number) => void;
  onEnd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isV = axis === 'vertical';
  const thumbPct = Math.max(14, Math.min(100, viewSize));
  const safePercent = Math.max(0, Math.min(100, percent));
  const thumbOffset = (safePercent / 100) * (100 - thumbPct);

  const moveTo = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const size = isV ? rect.height : rect.width;
      const pos = isV ? clientY - rect.top : clientX - rect.left;
      const pctPos = (pos / size) * 100;
      const p = Math.max(0, Math.min(100 - thumbPct, pctPos - thumbPct / 2));
      onChange(p);
    },
    [isV, thumbPct, onChange],
  );

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onStart();
    moveTo(e.clientX, e.clientY);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    moveTo(e.clientX, e.clientY);
  };

  const onUp = () => onEnd();

  return (
    <div
      ref={trackRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={`absolute z-10 touch-none ${
        isV ? 'bottom-3 right-2 top-3 w-4' : 'bottom-2 left-3 right-3 h-4'
      }`}
    >
      <div
        className={`absolute rounded-full bg-white/25 ${
          isV ? 'left-1/2 w-1.5 -translate-x-1/2' : 'top-1/2 h-1.5 -translate-y-1/2'
        }`}
        style={isV ? { top: `${thumbOffset}%`, height: `${thumbPct}%` } : { left: `${thumbOffset}%`, width: `${thumbPct}%` }}
      />
    </div>
  );
}

export default function Trackpad({ onClose }: { onClose: () => void }) {
  const { mouseMove, mouseClick, mouseButton, mouseScroll, getScrollInfo, mouseScrollTo, focusedTextInput } =
    useControl();
  const [dragMode, setDragMode] = useState(false);
  const [scrollInfo, setScrollInfo] = useState<ScrollInfo | null>(null);
  const [dragAxis, setDragAxis] = useState<'vertical' | 'horizontal' | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [dragPercent, setDragPercent] = useState({ vertical: 0, horizontal: 0 });
  const manuallyClosed = useRef(false);

  const scrollTarget = useRef<{ vertical: number | null; horizontal: number | null }>({
    vertical: null,
    horizontal: null,
  });
  const scrollSending = useRef(false);
  const movePending = useRef({ x: 0, y: 0 });
  const moveSending = useRef(false);

  const sendMove = useCallback(() => {
    if (moveSending.current) return;
    const { x, y } = movePending.current;
    if (x === 0 && y === 0) return;
    movePending.current.x = 0;
    movePending.current.y = 0;
    moveSending.current = true;
    void mouseMove(x, y)
      .catch(() => {})
      .finally(() => {
        moveSending.current = false;
      });
  }, [mouseMove]);

  // Envío de movimiento con coalescing: un solo request en vuelo, siempre el delta más reciente.
  useEffect(() => {
    const id = setInterval(sendMove, MOVE_SEND_MS);
    return () => clearInterval(id);
  }, [sendMove]);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const tapRef = useRef<{ start: number; x: number; y: number; moved: boolean } | null>(null);
  const twoRef = useRef<{ start: number; moved: boolean } | null>(null);
  const dragRef = useRef(false);
  const scrollAccum = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      const info = await getScrollInfo();
      if (!disposed) setScrollInfo(info);
    };
    void poll();
    const id = setInterval(poll, SCROLL_POLL_MS);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [getScrollInfo]);

  // Envío de scroll con coalescing: solo un request a la vez, siempre el último destino.
  useEffect(() => {
    const id = setInterval(() => {
      if (scrollSending.current) return;
      const t = scrollTarget.current;
      let axis: 'vertical' | 'horizontal' | null = null;
      let percent: number | null = null;
      if (t.vertical !== null) {
        axis = 'vertical';
        percent = t.vertical;
        t.vertical = null;
      } else if (t.horizontal !== null) {
        axis = 'horizontal';
        percent = t.horizontal;
        t.horizontal = null;
      }
      if (!axis || percent === null) return;
      scrollSending.current = true;
      void mouseScrollTo(axis, percent).finally(() => {
        scrollSending.current = false;
      });
    }, SCROLL_SEND_MS);
    return () => clearInterval(id);
  }, [mouseScrollTo]);

  // Auto-detectar campo de texto enfocado en la PC: solo auto-abre el teclado.
  // El usuario cierra el teclado manualmente con el botón.
  useEffect(() => {
    let disposed = false;
    const poll = async () => {
      const s = await focusedTextInput();
      if (disposed) return;
      if (s?.active && !manuallyClosed.current) {
        setKeyboardOpen(true);
      }
    };
    const id = setInterval(poll, 1500);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [focusedTextInput]);

  const handleScrollStart = useCallback((axis: 'vertical' | 'horizontal') => {
    setDragAxis(axis);
  }, []);

  const handleScrollChange = useCallback((axis: 'vertical' | 'horizontal', p: number) => {
    setDragPercent((d) => ({ ...d, [axis]: p }));
    scrollTarget.current[axis] = p;
  }, []);

  const handleScrollEnd = useCallback(
    (axis: 'vertical' | 'horizontal') => {
      setDragAxis(null);
      const t = scrollTarget.current[axis];
      scrollTarget.current[axis] = null;
      if (t !== null) void mouseScrollTo(axis, t);
    },
    [mouseScrollTo],
  );

  const flushQueue = useCallback(() => {
    sendMove();
  }, [sendMove]);

  // Si se desactiva el modo arrastre con el botón presionado, soltar.
  useEffect(() => {
    if (!dragMode && dragRef.current) {
      dragRef.current = false;
      void mouseButton('left', false);
    }
  }, [dragMode, mouseButton]);

  // Al cerrar: soltar botón y enviar lo pendiente.
  useEffect(
    () => () => {
      if (dragRef.current) void mouseButton('left', false);
      flushQueue();
    },
    [flushQueue, mouseButton],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const n = pointers.current.size;
      if (n === 1) {
        tapRef.current = { start: Date.now(), x: e.clientX, y: e.clientY, moved: false };
        if (dragMode) {
          dragRef.current = true;
          void mouseButton('left', true);
        }
      } else if (n === 2) {
        tapRef.current = null;
        twoRef.current = { start: Date.now(), moved: false };
      }
    },
    [dragMode, mouseButton],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.current.set(e.pointerId, cur);
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const n = pointers.current.size;

      if (n === 1) {
        const tap = tapRef.current;
        if (
          tap &&
          (Math.abs(cur.x - tap.x) > TAP_THRESHOLD || Math.abs(cur.y - tap.y) > TAP_THRESHOLD)
        ) {
          tap.moved = true;
        }
        movePending.current.x += dx * SENSITIVITY;
        movePending.current.y += dy * SENSITIVITY;
      } else if (n >= 2 && twoRef.current) {
        twoRef.current.moved = twoRef.current.moved || Math.abs(dx) > 12 || Math.abs(dy) > 12;
        scrollAccum.current.x += dx;
        scrollAccum.current.y += dy;
        const sx = Math.trunc(scrollAccum.current.x / SCROLL_STEP);
        const sy = Math.trunc(scrollAccum.current.y / SCROLL_STEP);
        if (sx !== 0) scrollAccum.current.x -= sx * SCROLL_STEP;
        if (sy !== 0) scrollAccum.current.y -= sy * SCROLL_STEP;
        // Natural: los dedos arrastran el contenido (arriba = scroll abajo, derecha = scroll izquierda).
        if (sx !== 0 || sy !== 0) void mouseScroll(-sx, sy);
      }
    },
    [mouseScroll],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointers.current.delete(e.pointerId);
      const n = pointers.current.size;

      if (dragRef.current && n === 0) {
        dragRef.current = false;
        void mouseButton('left', false);
        flushQueue();
        return;
      }

      if (twoRef.current) {
        if (n === 0) {
          const t = twoRef.current;
          twoRef.current = null;
          if (Date.now() - t.start < TAP_MAX_MS && !t.moved) void mouseClick('right');
        }
        return;
      }

      const tap = tapRef.current;
      if (tap && n === 0) {
        tapRef.current = null;
        if (Date.now() - tap.start < TAP_MAX_MS && !tap.moved) void mouseClick('left');
      }
      flushQueue();
    },
    [flushQueue, mouseButton, mouseClick],
  );

  const showV = Boolean(scrollInfo?.vertical.scrollable);
  const showH = Boolean(scrollInfo?.horizontal.scrollable);
  const showBar = showV || showH;
  const vPercent = dragAxis === 'vertical' ? dragPercent.vertical : (scrollInfo?.vertical.percent ?? dragPercent.vertical);
  const hPercent = dragAxis === 'horizontal' ? dragPercent.horizontal : (scrollInfo?.horizontal.percent ?? dragPercent.horizontal);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#04050c]/95 backdrop-blur-xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 ring-1 ring-cyan-300/30">
            <Icon name="mouse" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Trackpad</p>
            <p className="text-[11px] text-white/40">Mouse de la PC desde el celular</p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar trackpad"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/70 ring-1 ring-white/10 transition-colors hover:bg-white/10"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative mx-3 flex flex-1 touch-none select-none flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] overscroll-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Icon name="cursor" className="h-10 w-10 text-white/25" />
        <div className="flex max-w-[80%] flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium text-white/70">Deslizá para mover el mouse</p>
          <p className="text-[11px] text-white/35">
            Un toque: clic · Dos dedos: clic derecho · Dos dedos deslizando: scroll · Arrastrá la
            barra para desplazarte
          </p>
        </div>

        {showBar && scrollInfo && (
          <div className="pointer-events-none absolute top-3 left-1/2 flex max-w-[70%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 ring-1 ring-white/10">
            <Icon name="drag" className="h-3 w-3 text-white/50" />
            <span className="truncate text-[10px] font-medium text-white/60">
              {scrollInfo.foreground || 'Ventana activa'}
            </span>
          </div>
        )}

        {showV && scrollInfo && (
          <ScrollBar
            axis="vertical"
            percent={vPercent}
            viewSize={scrollInfo.vertical.viewSize}
            onStart={() => handleScrollStart('vertical')}
            onChange={(p) => handleScrollChange('vertical', p)}
            onEnd={() => handleScrollEnd('vertical')}
          />
        )}
        {showH && scrollInfo && (
          <ScrollBar
            axis="horizontal"
            percent={hPercent}
            viewSize={scrollInfo.horizontal.viewSize}
            onStart={() => handleScrollStart('horizontal')}
            onChange={(p) => handleScrollChange('horizontal', p)}
            onEnd={() => handleScrollEnd('horizontal')}
          />
        )}
      </div>

      {keyboardOpen && <TrackpadKeyboard />}

      <div className="flex items-center justify-center gap-3 p-4 pb-8">
        <button
          onClick={() => {
            if (keyboardOpen) {
              manuallyClosed.current = true;
              setKeyboardOpen(false);
            } else {
              manuallyClosed.current = false;
              setKeyboardOpen(true);
            }
          }}
          aria-pressed={keyboardOpen}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ring-1 transition-colors ${
            keyboardOpen
              ? 'bg-cyan-400/15 text-cyan-300 ring-cyan-300/40'
              : 'bg-white/5 text-white/70 ring-white/10 hover:bg-white/10'
          }`}
        >
          <Icon name="key" className="h-4 w-4" />
          Teclado
        </button>
        <button
          onClick={() => setDragMode((v) => !v)}
          aria-pressed={dragMode}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold ring-1 transition-colors ${
            dragMode
              ? 'bg-amber-400/15 text-amber-300 ring-amber-300/40'
              : 'bg-white/5 text-white/70 ring-white/10 hover:bg-white/10'
          }`}
        >
          <Icon name="drag" className="h-4 w-4" />
          Arrastrar
        </button>
      </div>
    </motion.div>
  );
}
