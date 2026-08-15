import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  label: string;
  icon: IconName;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  className?: string;
}

export default function SliderVolume({
  label,
  icon,
  value,
  min = 0,
  max = 100,
  disabled = false,
  onChange,
  onCommit,
  className = '',
}: Props) {
  const [local, setLocal] = useState(value);
  const lastCommit = useRef(0);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const update = (next: number) => {
    const clamped = Math.round(Math.max(min, Math.min(max, next)));
    setLocal(clamped);
    onChange(clamped);
    const now = Date.now();
    if (now - lastCommit.current > 200) {
      lastCommit.current = now;
      onCommit?.(clamped);
    }
  };

  const commit = () => {
    lastCommit.current = Date.now();
    onCommit?.(local);
  };

  const pct = ((local - min) / Math.max(1, max - min)) * 100;

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-white/80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-cyan-300 ring-1 ring-white/10">
            <Icon name={icon} className="h-4 w-4" />
          </span>
          {label}
        </span>
        <span className="font-mono text-xs text-white/40">{Math.round(local)}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={local}
        disabled={disabled}
        onChange={(e) => update(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        style={{ '--fill': `${pct}%` } as CSSProperties}
        className="glass-range disabled:opacity-40"
        aria-label={label}
      />
    </div>
  );
}
