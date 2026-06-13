import { useEffect, useMemo, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const DIAL_COUNT = 3;
const DIAL_MAX = 5; // dial values are 0..DIAL_MAX

/**
 * Logic Dials: three dials, each showing a number 0-5. A target
 * combination is generated; clues show the required total and an
 * above/below/at-midpoint hint per dial — enough information to deduce
 * the target through adjustment without it being pure guesswork.
 * Completes when all dials match the target.
 */
export default function LogicDials({ onComplete, onProgress }: MinigameProps) {
  const target = useMemo(
    () => Array.from({ length: DIAL_COUNT }, () => Math.floor(Math.random() * (DIAL_MAX + 1))),
    []
  );
  const [values, setValues] = useState<number[]>(() => Array.from({ length: DIAL_COUNT }, () => 0));

  const targetSum = target.reduce((a, b) => a + b, 0);
  const currentSum = values.reduce((a, b) => a + b, 0);
  const matchCount = values.filter((v, i) => v === target[i]).length;

  useEffect(() => {
    onProgress?.(Math.round((matchCount / DIAL_COUNT) * 100));
    if (matchCount === DIAL_COUNT) {
      onComplete();
    }
  }, [matchCount, onComplete, onProgress]);

  const adjust = (index: number, delta: number) => {
    setValues((prev) => {
      const next = [...prev];
      next[index] = Math.max(0, Math.min(DIAL_MAX, next[index] + delta));
      return next;
    });
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <p className="text-white/60 text-sm text-center">
        Set the dials so their total equals <span className="text-signal font-semibold">{targetSum}</span> and
        each dial's hint matches.
      </p>

      <div className="flex gap-6">
        {values.map((value, i) => {
          const isCorrect = value === target[i];
          const hint = target[i] > 2 ? 'high' : target[i] < 2 ? 'low' : 'mid';
          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-wide text-white/30">{hint}</span>
              <button
                type="button"
                onClick={() => adjust(i, 1)}
                className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-white active:bg-ink-700"
              >
                +
              </button>
              <div
                className={[
                  'w-12 h-12 rounded-lg border-2 flex items-center justify-center font-display text-lg',
                  isCorrect ? 'border-signal text-signal bg-signal/10' : 'border-ink-700 text-white',
                ].join(' ')}
              >
                {value}
              </div>
              <button
                type="button"
                onClick={() => adjust(i, -1)}
                className="w-10 h-10 rounded-full bg-ink-800 border border-ink-700 text-white active:bg-ink-700"
              >
                −
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-white/40">
        Current total: {currentSum} {currentSum === targetSum ? '✓' : ''}
      </p>
    </div>
  );
}
