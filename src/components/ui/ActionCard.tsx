import { motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';

interface Props {
  icon: IconName;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  accent?: string;
  danger?: boolean;
  disabled?: boolean;
}

export default function ActionCard({
  icon,
  title,
  subtitle,
  onClick,
  accent = 'text-cyan-300',
  danger = false,
  disabled = false,
}: Props) {
  return (
    <motion.button
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`glass-card flex flex-col items-center justify-center gap-2 px-4 py-5 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        danger
          ? 'hover:border-red-400/40 hover:bg-red-500/10'
          : 'hover:border-cyan-300/30 hover:bg-cyan-400/10'
      }`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 ${accent} ${
          danger ? 'text-red-300' : ''
        }`}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <span className="text-sm font-semibold text-white/90">{title}</span>
      {subtitle && <span className="text-[11px] text-white/40">{subtitle}</span>}
    </motion.button>
  );
}
