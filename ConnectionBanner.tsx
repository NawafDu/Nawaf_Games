import { AnimatePresence, motion } from 'framer-motion';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

/**
 * Persistent banner shown when the realtime connection drops, so players
 * understand why state might appear frozen and know reconnection is
 * automatic.
 */
export function ConnectionBanner() {
  const status = useConnectionStatus();

  return (
    <AnimatePresence>
      {status === 'disconnected' && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="absolute left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 bg-alert/90 px-4 py-2 text-xs font-semibold text-ink-950 safe-area-screen"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-ink-950" />
          Reconnecting…
        </motion.div>
      )}
    </AnimatePresence>
  );
}
