import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const BAY_COLORS = ['#5eead4', '#fb7185', '#fbbf24'];
const CRATES_PER_BAY = 3;

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Cargo Sort: a queue of colored crates must be sent to the matching
 * colored bay, one at a time. Tapping the correct bay for the current
 * (front-of-queue) crate advances the queue. Completes when the queue is
 * empty.
 */
export default function CargoSort({ onComplete, onProgress }: MinigameProps) {
  const [queue, setQueue] = useState<string[]>(() =>
    shuffle(BAY_COLORS.flatMap((color) => Array.from({ length: CRATES_PER_BAY }, () => color)))
  );
  const totalCrates = BAY_COLORS.length * CRATES_PER_BAY;
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  useEffect(() => {
    const sorted = totalCrates - queue.length;
    onProgress?.(Math.round((sorted / totalCrates) * 100));
    if (queue.length === 0) {
      onComplete();
    }
  }, [queue, totalCrates, onComplete, onProgress]);

  const handleBayTap = (color: string) => {
    if (queue.length === 0) return;
    const current = queue[0];
    if (current === color) {
      setFeedback('correct');
      setQueue((q) => q.slice(1));
    } else {
      setFeedback('wrong');
    }
    setTimeout(() => setFeedback(null), 200);
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-8">
      <p className="text-white/60 text-sm text-center">
        Send each crate to the bay matching its color, in order.
      </p>

      <div className="flex gap-2 h-12">
        {queue.slice(0, 4).map((color, i) => (
          <div
            key={i}
            className="w-12 h-12 rounded-lg border-2"
            style={{
              backgroundColor: i === 0 ? color : `${color}33`,
              borderColor: color,
              opacity: i === 0 ? 1 : Math.max(0.2, 0.5 - i * 0.1),
            }}
          />
        ))}
        {queue.length === 0 && <p className="text-signal text-sm self-center">All sorted!</p>}
      </div>

      <div className="flex gap-4 w-full justify-center">
        {BAY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handleBayTap(color)}
            className={[
              'w-20 h-24 rounded-xl border-2 transition-transform active:scale-95',
              feedback === 'wrong' && queue[0] !== color ? 'animate-pulse' : '',
            ].join(' ')}
            style={{ backgroundColor: `${color}22`, borderColor: color }}
          />
        ))}
      </div>

      <p className="text-xs text-white/40">
        {totalCrates - queue.length} / {totalCrates} sorted
      </p>
    </div>
  );
}
