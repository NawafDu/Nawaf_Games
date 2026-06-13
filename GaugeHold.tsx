import { useEffect, useRef, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const HOLD_DURATION_MS = 2500;
const DRIFT_SPEED = 0.012; // value change per tick when not pressing
const PRESS_SPEED = 0.022; // value change per tick when pressing
const ZONE_MIN = 0.4;
const ZONE_MAX = 0.6;

/**
 * Gauge Hold: a needle drifts downward on its own; holding the button
 * pushes it upward. Keep it within the green zone continuously for
 * HOLD_DURATION_MS to complete. Leaving the zone resets the hold timer
 * (but not overall progress shown to the player as a fraction of the
 * required hold).
 */
export default function GaugeHold({ onComplete, onProgress }: MinigameProps) {
  const [value, setValue] = useState(0.5);
  const [pressing, setPressing] = useState(false);
  const [heldMs, setHeldMs] = useState(0);
  const valueRef = useRef(value);
  const pressingRef = useRef(pressing);

  valueRef.current = value;
  pressingRef.current = pressing;

  useEffect(() => {
    let raf: number;
    let last = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = now - last;
      last = now;

      let next = valueRef.current + (pressingRef.current ? PRESS_SPEED : -DRIFT_SPEED) * (dt / 16.67);
      next = Math.max(0, Math.min(1, next));
      setValue(next);

      const inZone = next >= ZONE_MIN && next <= ZONE_MAX;
      setHeldMs((prev) => {
        const updated = inZone ? prev + dt : 0;
        const pct = Math.round((Math.min(updated, HOLD_DURATION_MS) / HOLD_DURATION_MS) * 100);
        onProgress?.(pct);
        if (updated >= HOLD_DURATION_MS) {
          onComplete();
        }
        return updated;
      });

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inZone = value >= ZONE_MIN && value <= ZONE_MAX;

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-8">
      <p className="text-white/60 text-sm text-center">
        Hold the button to raise the needle. Keep it in the green zone until the gauge fills.
      </p>

      <div className="relative w-16 h-64 bg-ink-800 rounded-full border border-ink-700 overflow-hidden">
        <div
          className="absolute left-0 right-0 bg-signal/20 border-y-2 border-signal"
          style={{
            bottom: `${ZONE_MIN * 100}%`,
            height: `${(ZONE_MAX - ZONE_MIN) * 100}%`,
          }}
        />
        <div
          className={`absolute left-0 right-0 h-1.5 rounded-full ${inZone ? 'bg-signal' : 'bg-white'}`}
          style={{ bottom: `${value * 100}%` }}
        />
      </div>

      <p className="text-xs text-white/40 tabular-nums">
        {Math.round((heldMs / HOLD_DURATION_MS) * 100)}%
      </p>

      <button
        type="button"
        onPointerDown={() => setPressing(true)}
        onPointerUp={() => setPressing(false)}
        onPointerLeave={() => setPressing(false)}
        className={[
          'w-32 h-32 rounded-full font-display text-lg border-2 transition-colors select-none touch-none',
          pressing ? 'bg-signal text-ink-950 border-signal' : 'bg-ink-800 text-white border-ink-700',
        ].join(' ')}
      >
        HOLD
      </button>
    </div>
  );
}
