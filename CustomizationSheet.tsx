import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { AVATAR_PRESETS, COLOR_PRESETS } from '@/lib/presets';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { updatePlayerCustomization } from '@/lib/roomService';
import type { RoomPlayer } from '@/types';

interface CustomizationSheetProps {
  roomCode: string;
  uid: string;
  player: RoomPlayer;
  onClose: () => void;
}

export function CustomizationSheet({ roomCode, uid, player, onClose }: CustomizationSheetProps) {
  const [name, setName] = useState(player.baseName);
  const [avatarId, setAvatarId] = useState(player.avatarId);
  const [colorId, setColorId] = useState(player.colorId);

  const trimmedName = name.trim();
  const isValid = trimmedName.length >= 1 && trimmedName.length <= 16;

  const [handleSave, pending] = useAsyncAction(async () => {
    if (!isValid) return;
    await updatePlayerCustomization(roomCode, uid, trimmedName, avatarId, colorId);
    onClose();
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 flex items-end bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-t-xl2 bg-ink-900 px-4 pt-4 safe-area-screen"
          style={{ maxHeight: '85vh' }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />

          <div className="max-h-[70vh] overflow-y-auto pb-4 no-scrollbar">
            <div className="flex flex-col items-center gap-2 py-2">
              <Avatar avatarId={avatarId} colorId={colorId} size={72} />
              <p className="font-display text-base font-semibold text-white">
                {trimmedName || 'Player'}
              </p>
            </div>

            <label className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-white/40">
              Display Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              maxLength={16}
              autoCapitalize="words"
              autoComplete="off"
              spellCheck={false}
              className="mb-4 w-full rounded-xl2 bg-ink-800 px-4 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-signal"
            />

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              Avatar Shape
            </label>
            <div className="mb-4 grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAvatarId(a.id)}
                  className={`tap-target flex items-center justify-center rounded-xl2 p-1 transition ${
                    avatarId === a.id ? 'bg-signal/20 ring-2 ring-signal' : 'bg-ink-800'
                  }`}
                  aria-label={a.label}
                >
                  <Avatar avatarId={a.id} colorId={colorId} size={36} />
                </button>
              ))}
            </div>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-white/40">
              Color
            </label>
            <div className="mb-2 grid grid-cols-6 gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColorId(c.id)}
                  className={`tap-target flex items-center justify-center rounded-xl2 p-2 transition ${
                    colorId === c.id ? 'bg-white/10 ring-2 ring-white' : 'bg-ink-800'
                  }`}
                  aria-label={c.label}
                >
                  <span className="block h-6 w-6 rounded-full" style={{ backgroundColor: c.hex }} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pb-4 pt-2">
            <button
              onClick={onClose}
              className="tap-target flex-1 rounded-xl2 border border-white/10 font-display text-sm font-medium text-white/70 active:scale-95"
            >
              Cancel
            </button>
            <Button onClick={handleSave} pending={pending} disabled={!isValid} className="flex-1 py-3.5">
              Save
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
