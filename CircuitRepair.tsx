import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const GRID_SIZE = 4;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
// Require activating most (not all) cells to keep "long" length
// reasonable on mobile.
const REQUIRED_ACTIVE = Math.ceil(TOTAL_CELLS * 0.7);

/**
 * Circuit Repair: a grid of disconnected nodes. Tapping a node "repairs"
 * it (with a chance to also repair one adjacent node, simulating a
 * cascading circuit effect). Completes once REQUIRED_ACTIVE nodes are
 * repaired.
 */
export default function CircuitRepair({ onComplete, onProgress }: MinigameProps) {
  const [active, setActive] = useState<Set<number>>(new Set());

  useEffect(() => {
    const pct = Math.round((Math.min(active.size, REQUIRED_ACTIVE) / REQUIRED_ACTIVE) * 100);
    onProgress?.(pct);
    if (active.size >= REQUIRED_ACTIVE) {
      onComplete();
    }
  }, [active, onComplete, onProgress]);

  const handleTap = (index: number) => {
    if (active.has(index)) return;

    setActive((prev) => {
      const next = new Set(prev);
      next.add(index);

      if (Math.random() < 0.3) {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        const neighbors: number[] = [];
        if (row > 0) neighbors.push(index - GRID_SIZE);
        if (row < GRID_SIZE - 1) neighbors.push(index + GRID_SIZE);
        if (col > 0) neighbors.push(index - 1);
        if (col < GRID_SIZE - 1) neighbors.push(index + 1);
        const candidates = neighbors.filter((n) => !next.has(n));
        if (candidates.length > 0) {
          next.add(candidates[Math.floor(Math.random() * candidates.length)]);
        }
      }

      return next;
    });
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <p className="text-white/60 text-sm text-center">
        Tap each node to repair the circuit grid. Repairing one node sometimes repairs a neighbor too.
      </p>

      <div className="grid grid-cols-4 gap-2 w-full">
        {Array.from({ length: TOTAL_CELLS }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleTap(i)}
            className={[
              'aspect-square rounded-lg border-2 transition-colors',
              active.has(i) ? 'bg-signal/20 border-signal' : 'bg-ink-800 border-ink-700 active:bg-ink-700',
            ].join(' ')}
          />
        ))}
      </div>

      <p className="text-xs text-white/40">
        {Math.min(active.size, REQUIRED_ACTIVE)} / {REQUIRED_ACTIVE} repaired
      </p>
    </div>
  );
}
