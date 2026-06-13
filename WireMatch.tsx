import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const COLORS = ['#5eead4', '#fb7185', '#fbbf24', '#a78bfa'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Wire Match: tap a wire on the left, then tap the port on the right with
 * the matching color. Both sides shuffled independently so matching
 * isn't positionally trivial. Completes when all wires are connected.
 */
export default function WireMatch({ onComplete, onProgress }: MinigameProps) {
  const [leftOrder] = useState(() => shuffle(COLORS));
  const [rightOrder] = useState(() => shuffle(COLORS));
  const [selectedWire, setSelectedWire] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState<string | null>(null);

  useEffect(() => {
    onProgress?.(Math.round((matched.size / COLORS.length) * 100));
    if (matched.size === COLORS.length) {
      onComplete();
    }
  }, [matched, onComplete, onProgress]);

  const handleLeftTap = (color: string) => {
    if (matched.has(color)) return;
    setSelectedWire(color);
  };

  const handleRightTap = (color: string) => {
    if (matched.has(color)) return;
    if (!selectedWire) return;

    if (selectedWire === color) {
      setMatched((prev) => new Set(prev).add(color));
      setSelectedWire(null);
    } else {
      setShake(color);
      setTimeout(() => setShake(null), 300);
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <p className="text-white/60 text-sm text-center">
        Tap a wire, then tap the port with the matching color to connect it.
      </p>

      <div className="flex w-full justify-between gap-8">
        <div className="flex flex-col gap-3">
          {leftOrder.map((color) => (
            <button
              key={`left-${color}`}
              type="button"
              onClick={() => handleLeftTap(color)}
              disabled={matched.has(color)}
              className={[
                'w-16 h-12 rounded-lg border-2 transition-all',
                matched.has(color)
                  ? 'opacity-30 border-ink-700'
                  : selectedWire === color
                    ? 'border-white scale-105'
                    : 'border-ink-700',
              ].join(' ')}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {rightOrder.map((color) => (
            <button
              key={`right-${color}`}
              type="button"
              onClick={() => handleRightTap(color)}
              disabled={matched.has(color)}
              className={[
                'w-16 h-12 rounded-lg border-2 border-dashed transition-all flex items-center justify-center',
                matched.has(color) ? 'opacity-30' : shake === color ? 'animate-pulse border-alert' : 'border-white/40',
              ].join(' ')}
              style={{ backgroundColor: matched.has(color) ? color : `${color}33`, borderColor: matched.has(color) ? color : undefined }}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-white/40">{matched.size} / {COLORS.length} connected</p>
    </div>
  );
}
