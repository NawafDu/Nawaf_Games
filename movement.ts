import { ref, runTransaction, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { MOVEMENT_COOLDOWN_MS } from '@/types';
import { generateId } from '@/utils/identifiers';
import type { GameState, PlayerMovementState } from '@/types';

export class GameActionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Attempts to move the current player to `targetNodeId`.
 *
 * Design note: writes are TARGETED to specific sub-paths rather than the
 * whole `/games/{code}` object, so that the per-field security rules
 * (each player can write only their own `movement`, etc.) apply cleanly:
 *
 * 1. Read the current game state once to validate the game is active, no
 *    meeting is in progress, and the target node is a direct neighbor of
 *    the player's current node.
 * 2. Run a TRANSACTION scoped to `games/{code}/players/{uid}/movement`
 *    only — the one field genuinely subject to a race (rapid
 *    double-taps) — enforcing the movement cooldown atomically.
 * 3. Append a `player_moved` event via a targeted push-id write to
 *    `eventLog`.
 *
 * The step-1 checks use a snapshot that could be a moment stale; the
 * worst case (e.g. a meeting starts in the few ms between steps 1 and 2)
 * is cosmetic in this cooperative-trust, Cloud-Functions-free design.
 */
export async function moveToNode(roomCode: string, uid: string, targetNodeId: string): Promise<void> {
  const gameSnapshot = await get(ref(db, `games/${roomCode}`));
  const game = gameSnapshot.val() as GameState | null;
  if (!game) throw new GameActionError('not_found', 'Game not found.');
  if (game.status !== 'active') throw new GameActionError('inactive', 'The match has ended.');

  const player = game.players[uid];
  if (!player || !player.alive) throw new GameActionError('not_alive', 'You are not in this match.');

  if (game.meeting && game.meeting.phase !== 'closed') {
    throw new GameActionError('meeting_active', 'You cannot move during a meeting.');
  }

  const currentNode = game.map.nodes[player.movement.currentNodeId];
  if (!currentNode || !currentNode.neighbors.includes(targetNodeId)) {
    throw new GameActionError('invalid_target', 'You cannot move there from here.');
  }

  const cooldownMs = MOVEMENT_COOLDOWN_MS[game.settings.movementSpeed];

  const movementRef = ref(db, `games/${roomCode}/players/${uid}/movement`);
  const result = await runTransaction(movementRef, (current: PlayerMovementState | null) => {
    if (current === null) return current;
    const now = Date.now();
    if (now - current.lastMovedAt < cooldownMs) {
      return; // abort — cooldown not elapsed
    }
    return { currentNodeId: targetNodeId, lastMovedAt: now };
  });

  if (!result.committed) {
    throw new GameActionError('cooldown', 'Movement cooldown not finished yet.');
  }

  // Best-effort witness event — failure here shouldn't undo the move.
  try {
    const eventId = generateId('evt_');
    await set(ref(db, `games/${roomCode}/eventLog/${eventId}`), {
      id: eventId,
      type: 'player_moved',
      actorUid: uid,
      nodeId: targetNodeId,
      timestamp: Date.now(),
      visibilityRadius: 1,
    });
  } catch {
    /* non-critical */
  }
}
