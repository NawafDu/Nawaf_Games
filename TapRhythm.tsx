import { useEffect, useRef, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const REQUIRED_HITS = 3;
const SWEEP_PERIOD_MS = 1400;
const TARGET_WINDOW = 0.12; // fraction of the sweep considered "in zone"

/**
 * Tap Rhythm: a marker sweeps back and forth along a bar. Tapping while
 * the marker is within the highlighted target zone counts as a hit.
 * Three hits complete the task; missing has no penalty — keeps this a
 * low-friction "short" task.
 */
export default function TapRhythm({ onComplete, onProgress }: MinigameProps) {
  const [hits, setHits] = useState(0);
  const [position, setPosition] = useState(0); // 0..1
  const [feedback, setFeedback] = useState<'hit' | 'miss' | null>(null);
  const [targetCenter, setTargetCenter] = useState(0.3 + Math.random() * 0.4);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const phase = (elapsed % SWEEP_PERIOD_MS) / SWEEP_PERIOD_MS;
      const pos = phase < 0.5 ? phase * 2 : 2 - phase * 2; // triangle wave 0->1->0
      setPosition(pos);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    onProgress?.(Math.round((hits / REQUIRED_HITS) * 100));
    if (hits >= REQUIRED_HITS) {
      onComplete();
    }
  }, [hits, onComplete, onProgress]);

  const handleTap = () => {
    const inZone = Math.abs(position - targetCenter) < TARGET_WINDOW;
    if (inZone) {
      setHits((h) => h + 1);
      setFeedback('hit');
      setTargetCenter(0.2 + Math.random() * 0.6);
    } else {
      setFeedback('miss');
    }
    setTimeout(() => setFeedback(null), 200);
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-8">
      <p className="text-white/60 text-sm text-center">
        Tap the button when the marker passes through the highlighted zone. {REQUIRED_HITS} hits to finish.
      </p>

      <div className="relative w-full h-10 bg-ink-800 rounded-full overflow-hidden border border-ink-700">
        <div
          className="absolute top-0 h-full bg-signal/20 border-x-2 border-signal"
          style={{
            left: `${(targetCenter - TARGET_WINDOW) * 100}%`,
            width: `${TARGET_WINDOW * 2 * 100}%`,
          }}
        />
        <div
          className="absolute top-0 h-full w-2 bg-white rounded-full"
          style={{ left: `calc(${position * 100}% - 4px)` }}
        />
      </div>

      <button
        type="button"
        onClick={handleTap}
        className={[
          'w-32 h-32 rounded-full font-display text-lg transition-colors',
          feedback === 'hit'
            ? 'bg-signal text-ink-950'
            : feedback === 'miss'
              ? 'bg-alert text-ink-950'
              : 'bg-ink-800 text-white border-2 border-ink-700 active:bg-ink-700',
        ].join(' ')}
      >
        TAP
      </button>

      <div className="flex gap-2">
        {Array.from({ length: REQUIRED_HITS }).map((_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full ${i < hits ? 'bg-signal' : 'bg-ink-700'}`} />
        ))}
      </div>
    </div>
  );
}
