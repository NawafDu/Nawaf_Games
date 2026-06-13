import { ref, runTransaction, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateId } from '@/utils/identifiers';
import { GameActionError } from './movement';
import type { GameState } from '@/types';

/**
 * Attempts to eliminate `targetUid`.
 *
 * As with movement, this avoids whole-object transactions in favor of:
 * 1. A one-shot read to validate game/meeting status, roles, proximity,
 *    and isolation (exactly saboteur + target at the node, no one else).
 * 2. A TRANSACTION scoped to `games/{code}/players/{saboteurUid}/lastKillAt`
 *    to atomically enforce the kill cooldown (the only field genuinely
 *    racy — e.g. a double-tap).
 * 3. A multi-path `update()` (atomic across paths, but not a
 *    read-modify-write transaction) that sets the victim's `alive` and
 *    `eliminatedBy`, removes them from `unreportedBodies`... actually
 *    ADDS them to `unreportedBodies` (their body is now present), and
 *    appends a `kill` event. The security rules permit a saboteur to
 *    write `alive`/`eliminatedBy` on any player's record and to write
 *    `unreportedBodies/{anyUid}`.
 *
 * If step 2 succeeds but step 3 fails (e.g. connection drop), the
 * saboteur's cooldown has still been consumed — an acceptable tradeoff
 * (the alternative, doing the cooldown write last, would let a player
 * exploit failed/retried requests to bypass the cooldown).
 */
export async function eliminatePlayer(roomCode: string, saboteurUid: string, targetUid: string): Promise<void> {
  const gameSnapshot = await get(ref(db, `games/${roomCode}`));
  const game = gameSnapshot.val() as GameState | null;
  if (!game) throw new GameActionError('not_found', 'Game not found.');
  if (game.status !== 'active') throw new GameActionError('inactive', 'The match has ended.');
  if (game.meeting && game.meeting.phase !== 'closed') {
    throw new GameActionError('meeting_active', 'You cannot do this during a meeting.');
  }

  const saboteur = game.players[saboteurUid];
  const target = game.players[targetUid];
  if (!saboteur || !target) throw new GameActionError('not_found', 'Player not found.');
  if (saboteur.role !== 'saboteur') throw new GameActionError('not_saboteur', 'Only Saboteurs can do this.');
  if (!saboteur.alive || !target.alive) throw new GameActionError('not_alive', 'This player is not in the match.');
  if (saboteurUid === targetUid) throw new GameActionError('invalid_target', 'Invalid target.');
  if (saboteur.movement.currentNodeId !== target.movement.currentNodeId) {
    throw new GameActionError('not_colocated', 'You must be in the same location.');
  }

  const occupants = Object.values(game.players).filter(
    (p) => p.alive && p.movement.currentNodeId === saboteur.movement.currentNodeId
  );
  if (occupants.length !== 2) {
    throw new GameActionError('not_isolated', 'You can only act when alone with your target.');
  }

  const cooldownMs = game.settings.killCooldownSec * 1000;

  const lastKillRef = ref(db, `games/${roomCode}/players/${saboteurUid}/lastKillAt`);
  const cooldownResult = await runTransaction(lastKillRef, (current: number | null) => {
    const now = Date.now();
    if (current && now - current < cooldownMs) {
      return; // abort — cooldown not elapsed
    }
    return now;
  });

  if (!cooldownResult.committed) {
    throw new GameActionError('cooldown', 'Your ability is still on cooldown.');
  }

  const now = Date.now();
  const eventId = generateId('evt_');

  await update(ref(db, `games/${roomCode}`), {
    [`players/${targetUid}/alive`]: false,
    [`players/${targetUid}/eliminatedBy`]: 'kill',
    [`unreportedBodies/${targetUid}`]: {
      uid: targetUid,
      nodeId: target.movement.currentNodeId,
      killedAt: now,
    },
    [`eventLog/${eventId}`]: {
      id: eventId,
      type: 'kill',
      actorUid: saboteurUid,
      targetUid,
      nodeId: target.movement.currentNodeId,
      timestamp: now,
      visibilityRadius: 0,
    },
  });
}
