import { ref, runTransaction, get, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateId } from '@/utils/identifiers';
import { GameActionError } from './movement';
import type { GameState, MeetingState } from '@/types';

function buildMeeting(
  settings: GameState['settings'],
  type: MeetingState['type'],
  calledBy: string,
  reportedBody?: string
): MeetingState {
  const now = Date.now();
  return {
    id: generateId('mtg_'),
    type,
    calledBy,
    ...(reportedBody ? { reportedBody } : {}),
    phase: 'discussion',
    startedAt: now,
    discussionEndsAt: now + settings.discussionDurationSec * 1000,
    votingEndsAt: 0,
    votes: {},
  };
}

/**
 * Attempts to atomically "claim" the right to start a new meeting by
 * transitioning `games/{code}/meeting` from `null`/`phase: 'closed'` to
 * a freshly-built meeting object.
 *
 * This is the crux of the race-condition fix: `runTransaction` on
 * `games/{code}/meeting` is a true read-modify-write — Firebase resolves
 * concurrent transactions on the same path sequentially, replaying the
 * updater with the latest value if another write landed first. So if two
 * players call `reportBody`/`callEmergencyMeeting` at the same instant:
 *
 * - Whichever transaction's updater runs first against a `null`/`closed`
 *   `meeting` commits successfully, writing its new meeting object.
 * - The other transaction's updater is then re-invoked (Firebase retries
 *   automatically) against the now-non-null, non-`closed` `meeting` —
 *   our updater detects this and ABORTS (returns `undefined`), so
 *   `result.committed === false` for the loser.
 *
 * Returns the committed `MeetingState` on success, or `null` if another
 * meeting was claimed first (the caller should treat this as a clean,
 * recoverable failure — NOT an error to surface destructively, since the
 * player's situation, e.g. a body at their feet, is unchanged).
 */
async function claimMeeting(
  roomCode: string,
  settings: GameState['settings'],
  type: MeetingState['type'],
  calledBy: string,
  reportedBody?: string
): Promise<MeetingState | null> {
  const meetingRef = ref(db, `games/${roomCode}/meeting`);

  const newMeeting = buildMeeting(settings, type, calledBy, reportedBody);

  const result = await runTransaction(meetingRef, (current: MeetingState | null) => {
    if (current !== null && current.phase !== 'closed') {
      return; // abort — a meeting is already in progress; don't overwrite it
    }
    return newMeeting;
  });

  if (!result.committed) return null;
  return result.snapshot.val() as MeetingState;
}

/**
 * Reports a body found at the reporting player's current location.
 *
 * Sequence:
 * 1. One-shot `get()` validates preconditions (game active, reporter
 *    alive, an unreported body exists at the reporter's node). This is
 *    a fast-path check — it can be stale by the time step 2 runs, but
 *    step 2 is the actual source of truth.
 * 2. `claimMeeting` atomically claims `games/{code}/meeting`. If this
 *    fails (another meeting was just claimed — by an emergency meeting
 *    OR another body report), throw `meeting_active` and DO NOT touch
 *    `unreportedBodies` or `eventLog` — the body remains reportable and
 *    the player can retry once the in-progress meeting ends.
 * 3. Only after the claim succeeds, remove the reported body from
 *    `unreportedBodies` and append a `body_found` event via a multi-path
 *    `update()`. If the body was *already* removed by the time this runs
 *    (e.g. another report somehow targeted the same body — not possible
 *    today since each body has a unique key, but defensive nonetheless),
 *    the `null` write is simply a no-op.
 *
 * This guarantees: only one meeting exists at a time, the losing caller
 * gets a clean `GameActionError('meeting_active', ...)` instead of
 * silently overwriting the winner's meeting, and a body is only ever
 * removed from `unreportedBodies` once a meeting representing it has
 * been successfully created.
 */
export async function reportBody(roomCode: string, uid: string): Promise<void> {
  const gameSnapshot = await get(ref(db, `games/${roomCode}`));
  const game = gameSnapshot.val() as GameState | null;
  if (!game) throw new GameActionError('not_found', 'Game not found.');
  if (game.status !== 'active') throw new GameActionError('inactive', 'The match has ended.');
  if (game.meeting && game.meeting.phase !== 'closed') {
    throw new GameActionError('meeting_active', 'A meeting is already in progress.');
  }

  const reporter = game.players[uid];
  if (!reporter || !reporter.alive) throw new GameActionError('not_alive', 'You are not in this match.');

  const bodyEntry = Object.values(game.unreportedBodies ?? {}).find(
    (b) => b.nodeId === reporter.movement.currentNodeId
  );
  if (!bodyEntry) throw new GameActionError('no_body', 'There is no body to report here.');

  const claimed = await claimMeeting(roomCode, game.settings, 'body_report', uid, bodyEntry.uid);
  if (!claimed) {
    throw new GameActionError(
      'meeting_active',
      'Someone else just started a meeting. Try reporting again once it ends.'
    );
  }

  const eventId = generateId('evt_');
  await update(ref(db, `games/${roomCode}`), {
    [`unreportedBodies/${bodyEntry.uid}`]: null,
    [`eventLog/${eventId}`]: {
      id: eventId,
      type: 'body_found',
      actorUid: uid,
      targetUid: bodyEntry.uid,
      timestamp: Date.now(),
      visibilityRadius: 99,
    },
  });
}

/**
 * Calls an emergency meeting from the calling player's current location.
 *
 * Validates the room-wide meeting cooldown by checking the most recent
 * `meeting_called`/`body_found` event timestamp in the (one-shot-read)
 * event log, then atomically claims `games/{code}/meeting` via
 * `claimMeeting` — see `reportBody` for the full race-condition
 * explanation. If another meeting (emergency or body report) is claimed
 * first, this throws `meeting_active` cleanly with no partial writes.
 */
export async function callEmergencyMeeting(roomCode: string, uid: string): Promise<void> {
  const gameSnapshot = await get(ref(db, `games/${roomCode}`));
  const game = gameSnapshot.val() as GameState | null;
  if (!game) throw new GameActionError('not_found', 'Game not found.');
  if (game.status !== 'active') throw new GameActionError('inactive', 'The match has ended.');
  if (game.meeting && game.meeting.phase !== 'closed') {
    throw new GameActionError('meeting_active', 'A meeting is already in progress.');
  }

  const caller = game.players[uid];
  if (!caller || !caller.alive) throw new GameActionError('not_alive', 'You are not in this match.');

  const cooldownMs = game.settings.meetingCooldownSec * 1000;
  const now = Date.now();
  const lastMeetingEvents = Object.values(game.eventLog ?? {}).filter(
    (e) => e.type === 'meeting_called' || e.type === 'body_found'
  );
  if (lastMeetingEvents.length > 0) {
    const mostRecent = Math.max(...lastMeetingEvents.map((e) => e.timestamp));
    if (now - mostRecent < cooldownMs) {
      throw new GameActionError('cooldown', 'Emergency meetings are on cooldown.');
    }
  }

  const claimed = await claimMeeting(roomCode, game.settings, 'emergency', uid);
  if (!claimed) {
    throw new GameActionError(
      'meeting_active',
      'Someone else just started a meeting. Try again once it ends.'
    );
  }

  const eventId = generateId('evt_');
  await update(ref(db, `games/${roomCode}`), {
    [`eventLog/${eventId}`]: {
      id: eventId,
      type: 'meeting_called',
      actorUid: uid,
      timestamp: now,
      visibilityRadius: 99,
    },
  });
}

/**
 * Casts (or changes) the current player's vote. `targetUid` is either
 * another living player's uid, or the literal string 'skip'.
 *
 * Writes directly to `meeting/votes/{uid}` — security rules restrict
 * this to the voter themself. A transaction is used to confirm the
 * meeting is still in the voting phase at write time (re-reads the
 * sibling `meeting/phase` via a one-shot get before transacting, since
 * the transaction itself is scoped to the vote leaf only).
 */
export async function castVote(roomCode: string, uid: string, targetUid: string): Promise<void> {
  const phaseSnapshot = await get(ref(db, `games/${roomCode}/meeting/phase`));
  if (phaseSnapshot.val() !== 'voting') {
    throw new GameActionError('not_voting', 'Voting is not currently open.');
  }

  if (targetUid !== 'skip') {
    const targetSnapshot = await get(ref(db, `games/${roomCode}/players/${targetUid}`));
    const target = targetSnapshot.val();
    if (!target || !target.alive) {
      throw new GameActionError('invalid_target', 'Invalid vote target.');
    }
  }

  const voteRef = ref(db, `games/${roomCode}/meeting/votes/${uid}`);
  await runTransaction(voteRef, () => targetUid);
}

/**
 * Host-only: clears a finished meeting's data back to `null`, advancing
 * the room to a state where movement/actions resume.
 *
 * Note: the automatic close-after-results-display flow is handled
 * inline within `runGameLoopTick` (gameLoop.ts), which times the
 * RESULTS_DISPLAY_MS window itself. This standalone export remains
 * available for an explicit "dismiss now" host action if added later.
 */
export async function closeMeeting(roomCode: string): Promise<void> {
  await update(ref(db, `games/${roomCode}`), { meeting: null });
}

/**
 * Removes the chat history for a meeting once it's closed. Best-effort.
 */
export async function clearMeetingChat(roomCode: string, meetingId: string): Promise<void> {
  try {
    await remove(ref(db, `chat/${roomCode}/${meetingId}`));
  } catch {
    /* non-critical cleanup */
  }
}
