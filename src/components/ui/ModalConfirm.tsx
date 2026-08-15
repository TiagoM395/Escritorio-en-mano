import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from './Icon';

interface Props {
  open: boolean;
  title: string;
  message: string;
  icon: IconName;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ModalConfirm({
  open,
  title,
  message,
  icon,
  confirmLabel = 'Confirmar',
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card w-full max-w-sm p-6"
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${
                danger
                  ? 'bg-red-500/15 text-red-300 ring-red-400/30'
                  : 'bg-amber-400/15 text-amber-300 ring-amber-300/30'
              }`}
            >
              <Icon name={icon} className="h-7 w-7" />
            </div>
            <h3 className="text-center text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-center text-sm text-white/50">{message}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/15"
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                  danger
                    ? 'bg-red-500/80 hover:bg-red-500'
                    : 'bg-cyan-400/80 text-slate-900 hover:bg-cyan-400'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
