import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const PAD_COLORS = ['#5eead4', '#fb7185', '#fbbf24', '#a78bfa'];
const SEQUENCE_LENGTH = 5;
const FLASH_MS = 500;
const GAP_MS = 250;

/**
 * Sequence Recall: four colored pads flash in a random order; the player
 * must tap them back in the same order. On a mistake, the sequence
 * replays from the start (same sequence, not regenerated) — keeps this
 * "medium" length without being punishingly random.
 */
export default function SequenceRecall({ onComplete, onProgress }: MinigameProps) {
  const [sequence] = useState<number[]>(() =>
    Array.from({ length: SEQUENCE_LENGTH }, () => Math.floor(Math.random() * PAD_COLORS.length))
  );
  const [phase, setPhase] = useState<'showing' | 'input'>('showing');
  const [activePad, setActivePad] = useState<number | null>(null);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [flashFeedback, setFlashFeedback] = useState<{ pad: number; correct: boolean } | null>(null);

  useEffect(() => {
    if (phase !== 'showing') return;

    let cancelled = false;
    let i = 0;

    const step = () => {
      if (cancelled) return;
      if (i >= sequence.length) {
        setActivePad(null);
        setPhase('input');
        return;
      }
      setActivePad(sequence[i]);
      setTimeout(() => {
        if (cancelled) return;
        setActivePad(null);
        setTimeout(() => {
          if (cancelled) return;
          i += 1;
          step();
        }, GAP_MS);
      }, FLASH_MS);
    };

    const startTimeout = setTimeout(step, 500);
    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
    };
  }, [phase, sequence]);

  useEffect(() => {
    onProgress?.(Math.round((playerIndex / sequence.length) * 100));
    if (playerIndex >= sequence.length) {
      onComplete();
    }
  }, [playerIndex, sequence.length, onComplete, onProgress]);

  const handleTap = (pad: number) => {
    if (phase !== 'input') return;

    const expected = sequence[playerIndex];
    const correct = pad === expected;
    setFlashFeedback({ pad, correct });
    setTimeout(() => setFlashFeedback(null), 200);

    if (correct) {
      setPlayerIndex((i) => i + 1);
    } else {
      setPlayerIndex(0);
      setPhase('showing');
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <p className="text-white/60 text-sm text-center">
        {phase === 'showing' ? 'Watch the sequence...' : 'Now repeat it in order.'}
      </p>

      <div className="grid grid-cols-2 gap-3 w-full">
        {PAD_COLORS.map((color, i) => {
          const isActive = activePad === i;
          const feedback = flashFeedback?.pad === i ? flashFeedback.correct : null;
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleTap(i)}
              disabled={phase !== 'input'}
              className="aspect-square rounded-xl border-2 transition-all"
              style={{
                backgroundColor: isActive || feedback === true ? color : `${color}33`,
                borderColor: feedback === false ? '#fb7185' : color,
                opacity: phase === 'input' ? 1 : 0.7,
              }}
            />
          );
        })}
      </div>

      <p className="text-xs text-white/40">
        {playerIndex} / {sequence.length}
      </p>
    </div>
  );
}
