import { useCallback, useEffect, useState } from 'react';
import { useControl } from '../hooks/useControl';
import { Icon } from './ui/Icon';

const BUTTONS_H = 92;

function useKeyboardHeight(): number {
  const [kbH, setKbH] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKbH(Math.max(0, window.innerHeight - vv.height));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return kbH;
}

export default function TrackpadKeyboard() {
  const { typeText } = useControl();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const kbH = useKeyboardHeight();

  const send = useCallback(() => {
    const value = text.replace(/[\r\n]+/g, ' ').trim();
    setText('');
    setSending(true);
    const payload = value ? `${value}\n` : '\n';
    void typeText(payload)
      .catch(() => {})
      .finally(() => setSending(false));
  }, [text, typeText]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] px-3"
      style={{ bottom: Math.max(kbH, BUTTONS_H) }}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-[#0b0e1a]/95 p-2 shadow-2xl shadow-black/70 ring-1 ring-white/10 backdrop-blur-xl">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Escribí…"
          aria-label="Texto para la PC"
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 placeholder:text-white/25 focus:ring-cyan-300/40"
        />
        <button
          onClick={send}
          disabled={sending}
          aria-label="Enviar (Enter)"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/90 text-slate-900 transition-colors hover:bg-cyan-300 disabled:opacity-40"
        >
          <Icon name="send" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
