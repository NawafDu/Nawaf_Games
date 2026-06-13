import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const TARGET_FILL = 100;
const PER_TAP = 4;
const DECAY_PER_TICK = 1;
const TICK_MS = 200;

/**
 * Progress Calibration: tapping fills a meter; the meter slowly decays
 * over time, so steady, repeated tapping is needed to make net progress.
 * Completes when the meter reaches 100%.
 */
export default function ProgressCalibration({ onComplete, onProgress }: MinigameProps) {
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFill((f) => Math.max(0, f - DECAY_PER_TICK));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    onProgress?.(Math.round(fill));
    if (fill >= TARGET_FILL) {
      onComplete();
    }
  }, [fill, onComplete, onProgress]);

  const handleTap = () => {
    setFill((f) => Math.min(TARGET_FILL, f + PER_TAP));
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-8">
      <p className="text-white/60 text-sm text-center">
        Tap repeatedly to fill the calibration meter. It drains slowly, so keep going!
      </p>

      <div className="w-full h-6 bg-ink-800 rounded-full overflow-hidden border border-ink-700">
        <div className="h-full bg-signal transition-all" style={{ width: `${fill}%`, transitionDuration: '150ms' }} />
      </div>

      <button
        type="button"
        onClick={handleTap}
        className="w-40 h-40 rounded-full font-display text-lg bg-ink-800 border-2 border-ink-700 text-white active:bg-ink-700 active:scale-95 transition-transform select-none"
      >
        CALIBRATE
      </button>

      <p className="text-xs text-white/40 tabular-nums">{Math.round(fill)}%</p>
    </div>
  );
}
