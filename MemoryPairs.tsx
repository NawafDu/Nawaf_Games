import { useEffect, useState } from 'react';

interface MinigameProps {
  onComplete: () => void;
  onProgress?: (pct: number) => void;
}

const SYMBOLS = ['◆', '●', '▲', '■', '★', '✦'];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface Card {
  id: number;
  symbol: string;
}

/**
 * Memory Pairs: a grid of face-down cards, two of each symbol. Tap two
 * cards to flip them; matching pairs stay revealed, mismatches flip back
 * after a short delay. Completes when all pairs are found.
 */
export default function MemoryPairs({ onComplete, onProgress }: MinigameProps) {
  const [cards] = useState<Card[]>(() =>
    shuffle(SYMBOLS.flatMap((symbol, i) => [{ id: i * 2, symbol }, { id: i * 2 + 1, symbol }]))
  );
  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    onProgress?.(Math.round((matched.size / cards.length) * 100));
    if (matched.size === cards.length) {
      onComplete();
    }
  }, [matched, cards.length, onComplete, onProgress]);

  const handleTap = (index: number) => {
    if (busy || revealed.includes(index) || matched.has(index)) return;

    const next = [...revealed, index];
    setRevealed(next);

    if (next.length === 2) {
      const [a, b] = next;
      if (cards[a].symbol === cards[b].symbol) {
        setMatched((prev) => new Set(prev).add(a).add(b));
        setRevealed([]);
      } else {
        setBusy(true);
        setTimeout(() => {
          setRevealed([]);
          setBusy(false);
        }, 600);
      }
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-6">
      <p className="text-white/60 text-sm text-center">Find all matching pairs.</p>

      <div className="grid grid-cols-4 gap-2 w-full">
        {cards.map((card, index) => {
          const isVisible = revealed.includes(index) || matched.has(index);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => handleTap(index)}
              className={[
                'aspect-square rounded-lg border-2 flex items-center justify-center text-2xl transition-colors',
                matched.has(index)
                  ? 'bg-signal/20 border-signal text-signal'
                  : isVisible
                    ? 'bg-ink-700 border-white/40 text-white'
                    : 'bg-ink-800 border-ink-700 text-transparent active:bg-ink-700',
              ].join(' ')}
            >
              {card.symbol}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-white/40">
        {matched.size / 2} / {SYMBOLS.length} pairs found
      </p>
    </div>
  );
}
