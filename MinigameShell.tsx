import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface MinigameShellProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Fullscreen modal shell shared by all 9 minigames. Provides a
 * consistent header (title + close button) and a centered content area.
 * Each minigame component calls the `onComplete` callback it receives
 * from MinigameLauncher when its objective is met; MinigameLauncher then
 * calls `completeTask` and closes this shell.
 *
 * Closing without completing (via the X button) leaves the task
 * incomplete — the player can return to it later from the task panel.
 */
export default function MinigameShell({ title, onClose, children }: MinigameShellProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-ink-950 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-700 safe-top">
        <h2 className="font-display text-base text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-11 h-11 flex items-center justify-center text-white/60 active:text-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">{children}</div>
    </motion.div>
  );
}
