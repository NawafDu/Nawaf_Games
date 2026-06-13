import { useState } from 'react';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { fillWithBots, removeAllBots } from '@/lib/roomService';
import type { BotDifficulty } from '@/types';

interface BotControlsProps {
  roomCode: string;
  botDifficulty: BotDifficulty;
  hasBots: boolean;
  slotsOpen: number;
}

const DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
];

export function BotControls({ roomCode, botDifficulty, hasBots, slotsOpen }: BotControlsProps) {
  const [difficulty, setDifficulty] = useState<BotDifficulty>(botDifficulty);

  const [handleFill, fillPending] = useAsyncAction(async () => {
    await fillWithBots(roomCode, difficulty);
  });

  const [handleRemove, removePending] = useAsyncAction(async () => {
    await removeAllBots(roomCode);
  });

  return (
    <div className="rounded-xl2 bg-ink-800 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
        Bots
      </p>

      <div className="mb-3 flex gap-1.5">
        {DIFFICULTY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setDifficulty(opt.id)}
            className={`tap-target flex-1 rounded-xl2 py-2 text-xs font-semibold transition ${
              difficulty === opt.id ? 'bg-signal text-ink-950' : 'bg-ink-700 text-white/60'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleFill}
          disabled={fillPending || slotsOpen <= 0}
          className="tap-target flex-1 rounded-xl2 bg-ink-700 py-2.5 text-xs font-semibold text-white/80 active:scale-95 disabled:opacity-40"
        >
          {slotsOpen > 0 ? `Fill ${slotsOpen} Slot${slotsOpen === 1 ? '' : 's'}` : 'Room Full'}
        </button>
        {hasBots && (
          <button
            onClick={handleRemove}
            disabled={removePending}
            className="tap-target flex-1 rounded-xl2 border border-white/10 py-2.5 text-xs font-semibold text-white/60 active:scale-95 disabled:opacity-40"
          >
            Remove Bots
          </button>
        )}
      </div>
    </div>
  );
}
