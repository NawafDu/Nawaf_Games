import { ref, set, update, get, goOffline, goOnline } from 'firebase/database';
import { db } from '@/lib/firebase';
import { reportBody, callEmergencyMeeting, castVote } from '@/lib/gameActions/meetings';
import { completeTask } from '@/lib/gameActions/tasks';
import type { GameState, PlayerMovementState } from '@/types';

// -----------------------------------------------------------------------
// Dev-only simulation tools (Phase 3.5 QA).
//
// IMPORTANT — these tools operate WITHIN REAL PERMISSION BOUNDARIES.
// Nothing here weakens database.rules.json or adds backdoors: every
// write below is something the CURRENT tab's player (or host, if the
// current tab happens to be host) is already permitted to do under the
// production security rules. "Force X" mostly means "skip the normal UI
// flow / preconditions and do X directly for the current tab's own
// player", which is sufficient to exercise the multiplayer code paths
// in docs/TEST_CHECKLIST.md using only multiple browser tabs.
//
// Actions that genuinely require host privileges (force game end, force
// host migration/disconnect) are clearly host-gated and report a
// friendly SimulationError on non-host tabs — the QA workflow is to run
// them from whichever tab the debug panel shows as the current host.
//
// This module is only imported by DevPanel.tsx, which is only rendered
// when `import.meta.env.DEV`.
// -----------------------------------------------------------------------

export class SimulationError extends Error {}

/**
 * Force-disconnects the CURRENT tab from Firebase (`goOffline`), after
 * first writing `connected: false` to this player's room record so other
 * clients see the disconnect immediately rather than waiting for
 * `onDisconnect` (which is unreliable to test once we've already gone
 * offline ourselves).
 *
 * Use "Force Reconnect" to undo. While offline, all reads/writes from
 * this tab queue locally and replay on reconnect — useful for testing
 * how the UI behaves with a frozen/stale view of game state.
 */
export async function forceDisconnect(roomCode: string, uid: string): Promise<void> {
  await set(ref(db, `rooms/${roomCode}/players/${uid}/connected`), false).catch(() => {
    /* best-effort — may already be offline */
  });
  goOffline(db);
}

/**
 * Restores the CURRENT tab's connection (`goOnline`) and restores
 * `connected: true` for this player. Queued writes from while offline
 * (if any) replay automatically.
 */
export async function forceReconnect(roomCode: string, uid: string): Promise<void> {
  goOnline(db);
  await set(ref(db, `rooms/${roomCode}/players/${uid}/connected`), true).catch(() => {
    /* best-effort */
  });
  await set(ref(db, `rooms/${roomCode}/players/${uid}/lastSeen`), Date.now()).catch(() => {});
}

/**
 * Force-disconnects the host. Only meaningful (and only permitted) if
 * the CURRENT tab IS the current host — throws SimulationError
 * otherwise, since a non-host tab has no permission to make the host
 * appear disconnected.
 *
 * To test host migration: run this from the host's tab, then watch a
 * DIFFERENT tab's debug panel — after ~15s, `games/{code}.hostUid`
 * should update to that tab's uid (if it's the oldest connected human).
 */
export async function forceHostDisconnect(roomCode: string, uid: string, game: GameState | null): Promise<void> {
  if (!game || game.hostUid !== uid) {
    throw new SimulationError('This tab is not the current host. Switch to the host tab to use this.');
  }
  await forceDisconnect(roomCode, uid);
}

/**
 * "Force host migration" without waiting the full 15s stall window:
 * directly back-dates `games/{code}.hostHeartbeatAt` so it already looks
 * stale to other tabs' `useMatchHostMigration` (which polls every 4s and
 * checks for a >15s-old heartbeat). Only the current host can write
 * `hostHeartbeatAt`, so this is host-only — same gate as
 * `forceHostDisconnect`, but doesn't disconnect the host's tab (useful
 * for testing migration in isolation from reconnect behavior).
 *
 * Note: the host tab's own `useGameLoop` will likely overwrite
 * `hostHeartbeatAt` again on its next ~1s tick, "fixing" the staleness
 * before another tab's 4s-interval check notices. For a reliable test,
 * pair this with switching away from the host tab immediately, or use
 * `forceHostDisconnect` instead, which actually stops the ticks.
 */
export async function forceStaleHeartbeat(roomCode: string, uid: string, game: GameState | null): Promise<void> {
  if (!game || game.hostUid !== uid) {
    throw new SimulationError('This tab is not the current host. Switch to the host tab to use this.');
  }
  const STALE_MS = 20000; // > the 15s threshold useMatchHostMigration checks
  await update(ref(db, `games/${roomCode}`), {
    hostHeartbeatAt: Date.now() - STALE_MS,
  });
}

/**
 * Force an emergency meeting from the current player. Subject to the
 * same real preconditions as the normal "Emergency Meeting" button
 * (player must be alive, no meeting in progress, meeting cooldown
 * elapsed) — this just skips the UI button/confirmation. Useful for
 * quickly entering the meeting flow to test discussion/voting/results
 * without waiting for a kill or task setup.
 */
export async function forceMeeting(roomCode: string, uid: string): Promise<void> {
  await callEmergencyMeeting(roomCode, uid);
}

/**
 * Teleports the current player directly to the node containing an
 * unreported body (if any), then reports it. "Teleport" here is a
 * direct write to `players/{uid}/movement` — permitted by the security
 * rules for self (`auth.uid === $uid`), which validate shape but not
 * neighbor-adjacency (adjacency is a client-side check in moveToNode,
 * not a rule). This lets a single tester trigger a body-report meeting
 * without needing a saboteur tab to have actually walked a victim into
 * isolation first... though a body must still exist (i.e. at least one
 * elimination must have happened, by a human or bot saboteur).
 *
 * Throws SimulationError if there are no unreported bodies.
 */
export async function forceBodyReport(roomCode: string, uid: string, game: GameState): Promise<void> {
  const bodies = Object.values(game.unreportedBodies ?? {});
  if (bodies.length === 0) {
    throw new SimulationError('No unreported bodies exist right now.');
  }

  const target = bodies[0];
  await teleportSelf(roomCode, uid, target.nodeId);
  await reportBody(roomCode, uid);
}

/**
 * Teleports the current player to the node containing one of their own
 * pending (non-completed) tasks, then completes it directly via
 * `completeTask` (bypassing the minigame UI — this tests the
 * task-completion data flow and win-condition checks, not the minigames
 * themselves, which are covered by manual play-testing).
 *
 * Throws SimulationError if the player has no pending tasks (or doesn't
 * exist / isn't alive).
 */
export async function forceTaskCompletion(roomCode: string, uid: string, game: GameState): Promise<void> {
  const player = game.players[uid];
  if (!player || !player.alive) {
    throw new SimulationError('You are not an active player in this match.');
  }

  const pendingTask = player.tasks.find((t) => t.status !== 'completed');
  if (!pendingTask) {
    throw new SimulationError('All of your tasks are already complete.');
  }

  await teleportSelf(roomCode, uid, pendingTask.nodeId);
  await completeTask(roomCode, uid, pendingTask.id);
}

/**
 * Casts a vote for the current player during an active voting phase.
 * `targetUid` is another living player's uid or 'skip'. Thin wrapper
 * around `castVote` — provided so the dev panel can offer a compact
 * "vote for..." control alongside the other simulation buttons without
 * duplicating MeetingOverlay's voting UI.
 */
export async function forceVote(roomCode: string, uid: string, targetUid: string): Promise<void> {
  await castVote(roomCode, uid, targetUid);
}

/**
 * Force-ends the match immediately with the given winning team. Writes
 * `games/{code}.{status,winningTeam,endedAt}` directly — these fields
 * are host-only per the security rules (`hostUid === auth.uid`), so this
 * throws SimulationError on non-host tabs.
 *
 * Useful for jumping straight to PostGameScreen / return-to-lobby
 * testing without playing out a full round.
 */
export async function forceGameEnd(
  roomCode: string,
  uid: string,
  game: GameState | null,
  winningTeam: 'citizens' | 'saboteurs'
): Promise<void> {
  if (!game || game.hostUid !== uid) {
    throw new SimulationError('This tab is not the current host. Switch to the host tab to use this.');
  }

  await update(ref(db, `games/${roomCode}`), {
    status: 'ended',
    winningTeam,
    endedAt: Date.now(),
  });
}

/**
 * Internal helper: directly sets `players/{uid}/movement` to put the
 * player at `nodeId` with `lastMovedAt: 0` (so a subsequent real move
 * isn't blocked by a cooldown from this teleport). Self-write, permitted
 * by the security rules' movement field (`auth.uid === $uid`).
 */
async function teleportSelf(roomCode: string, uid: string, nodeId: string): Promise<void> {
  const movement: PlayerMovementState = { currentNodeId: nodeId, lastMovedAt: 0 };
  await set(ref(db, `games/${roomCode}/players/${uid}/movement`), movement);
}

/**
 * One-shot read of the full game state — used by the debug panel's
 * State Inspector "refresh" action for a point-in-time raw JSON view,
 * independent of the live subscription.
 */
export async function fetchRawGameState(roomCode: string): Promise<GameState | null> {
  const snapshot = await get(ref(db, `games/${roomCode}`));
  return snapshot.val() as GameState | null;
}
