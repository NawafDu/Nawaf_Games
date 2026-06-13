import { saboteurRange, type RoomData } from '@/types';

export interface StartValidation {
  canStart: boolean;
  reasons: string[];
}

const MIN_PLAYERS = 4;

/**
 * Determines whether the host can start a match, and if not, why —
 * surfaced in the lobby UI so hosts aren't left guessing why the
 * "Start Match" button is disabled.
 */
export function validateStart(room: RoomData): StartValidation {
  const reasons: string[] = [];
  const players = Object.values(room.players ?? {});
  const playerCount = players.length;

  if (playerCount < MIN_PLAYERS) {
    reasons.push(`Need at least ${MIN_PLAYERS} players (currently ${playerCount}).`);
  }

  const notReady = players.filter((p) => !p.ready);
  if (notReady.length > 0) {
    reasons.push(
      `${notReady.length} player${notReady.length === 1 ? '' : 's'} not ready: ${notReady
        .map((p) => p.displayName)
        .join(', ')}.`
    );
  }

  const range = saboteurRange(playerCount);
  if (room.settings.saboteurCount < range.min || room.settings.saboteurCount > range.max) {
    reasons.push(
      `Saboteur count (${room.settings.saboteurCount}) is out of range for ${playerCount} players (${range.min}–${range.max}).`
    );
  }

  return { canStart: reasons.length === 0, reasons };
}
