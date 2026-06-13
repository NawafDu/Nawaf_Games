import type { TaskLength } from '@/types';

// -----------------------------------------------------------------------
// Minigame registry. Each entry maps a minigame ID to its display name,
// length category, and the component used to render it (resolved in
// MinigameLauncher to avoid a large eager import graph).
//
// All 9 minigames are original designs — simple, self-contained
// activities themed around a generic "station maintenance" setting,
// not derived from any existing game's specific puzzles or art.
// -----------------------------------------------------------------------

export interface MinigameDefinition {
  id: string;
  name: string;
  length: TaskLength;
  description: string;
}

export const MINIGAMES: MinigameDefinition[] = [
  // Short (quick, low-friction)
  { id: 'tap_rhythm', name: 'Tap Rhythm', length: 'short', description: 'Tap exactly when the marker lines up.' },
  { id: 'wire_match', name: 'Wire Match', length: 'short', description: 'Match each wire to its colored port.' },
  { id: 'gauge_hold', name: 'Gauge Hold', length: 'short', description: 'Keep the gauge needle in the green zone.' },

  // Medium
  { id: 'memory_pairs', name: 'Memory Pairs', length: 'medium', description: 'Find all matching pairs of symbols.' },
  { id: 'sequence_recall', name: 'Sequence Recall', length: 'medium', description: 'Repeat the flashing sequence in order.' },
  { id: 'logic_dials', name: 'Logic Dials', length: 'medium', description: 'Set each dial to satisfy all the clues.' },

  // Long
  { id: 'circuit_repair', name: 'Circuit Repair', length: 'long', description: 'Reconnect every node on the repair grid.' },
  { id: 'cargo_sort', name: 'Cargo Sort', length: 'long', description: 'Sort each crate into its matching bay.' },
  { id: 'progress_calibration', name: 'Calibration', length: 'long', description: 'Fill the calibration meter completely.' },
];

export function getMinigame(id: string): MinigameDefinition {
  const found = MINIGAMES.find((m) => m.id === id);
  if (!found) {
    // Defensive fallback — should never happen since task generation only
    // ever picks from this list, but avoids a hard crash if data drifts.
    return MINIGAMES[0];
  }
  return found;
}

export function getMinigamesByLength(length: TaskLength): MinigameDefinition[] {
  return MINIGAMES.filter((m) => m.length === length);
}
