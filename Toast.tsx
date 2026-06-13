import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '@/store/uiStore';
import { useEffect } from 'react';

/**
 * Renders the global toast (from useUIStore) and auto-dismisses it.
 */
export function Toast() {
  const toast = useUIStore((s) => s.toast);
  const clearToast = useUIStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => clearToast(), 3200);
    return () => clearTimeout(timeout);
  }, [toast, clearToast]);

  const toneStyles: Record<string, string> = {
    info: 'bg-ink-700 text-white',
    error: 'bg-alert text-ink-950',
    success: 'bg-signal text-ink-950',
  };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          className="pointer-events-none absolute bottom-6 left-0 right-0 z-50 flex justify-center px-6"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <div
            className={`rounded-xl2 px-4 py-3 text-sm font-medium shadow-lg ${toneStyles[toast.tone]}`}
          >
            {toast.message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
