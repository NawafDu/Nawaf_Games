import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { checkWinConditions } from './winConditions';
import { computeBotUpdates, type PathUpdates } from './bots';
import type { GameState } from '@/types';

// How long the results phase (post-vote tally/ejection reveal) stays
// visible before the meeting is automatically closed and movement
// resumes. Not host-configurable — kept short and fixed since it's a
// brief "reveal" beat, not a gameplay-affecting duration like discussion
// or voting time.
export const RESULTS_DISPLAY_MS = 6000;

// Maximum number of entries kept in `eventLog`. Every move, task
// completion, kill, body report, and meeting call appends an entry, and
// every client subscribes to the whole `/games/{code}` object — without
// pruning, eventLog grows unboundedly over a long match (especially with
// many players/bots moving every 1-2.5s), increasing payload size and
// per-tick read/write cost. Pruned here (host-only, every tick) rather
// than per-action, since this is the one place that already does a
// read + single multi-path write per tick.
const MAX_EVENT_LOG_ENTRIES = 200;

/**
 * One tick of the host-authoritative game loop. Called periodically
 * (every ~1s) by the current host's client via useGameLoop.
 *
 * Design note: rather than a whole-object transaction (which would
 * require every field to be writable by the host under the security
 * rules — including fields whose rules intentionally restrict writes to
 * specific players for OTHER write paths), this function:
 *   1. Reads the current game state once.
 *   2. Computes a flat map of `path -> newValue` updates for: meeting
 *      phase transitions + vote tallying/ejection, bot decisions
 *      (delegated to computeBotUpdates), and win-condition resolution.
 *   3. Performs a single multi-path `update()` — atomic across all
 *      included paths, and each path is validated against its own rule,
 *      all of which permit the host to write (see database.rules.json).
 *   4. Always refreshes `hostHeartbeatAt`.
 */
export async function runGameLoopTick(roomCode: string): Promise<void> {
  const snapshot = await get(ref(db, `games/${roomCode}`));
  const game = snapshot.val() as GameState | null;
  if (!game || game.status !== 'active') {
    if (game) {
      await update(ref(db, `games/${roomCode}`), { hostHeartbeatAt: Date.now() }).catch(() => {});
    }
    return;
  }

  const now = Date.now();
  const updates: PathUpdates = {};

  if (game.meeting) {
    if (game.meeting.phase === 'discussion' && now >= game.meeting.discussionEndsAt) {
      const votingEndsAt = now + game.settings.votingDurationSec * 1000;
      game.meeting.phase = 'voting';
      game.meeting.votingEndsAt = votingEndsAt;
      updates['meeting/phase'] = 'voting';
      updates['meeting/votingEndsAt'] = votingEndsAt;
    } else if (game.meeting.phase === 'voting' && now >= game.meeting.votingEndsAt) {
      const tally: Record<string, number> = {};
      for (const choice of Object.values(game.meeting.votes)) {
        tally[choice] = (tally[choice] ?? 0) + 1;
      }

      let topCount = -1;
      let topCandidates: string[] = [];
      for (const [candidate, count] of Object.entries(tally)) {
        if (count > topCount) {
          topCount = count;
          topCandidates = [candidate];
        } else if (count === topCount) {
          topCandidates.push(candidate);
        }
      }

      const wasTie = topCandidates.length !== 1;
      const winner = !wasTie ? topCandidates[0] : null;
      const ejectedUid = winner && winner !== 'skip' ? winner : null;

      if (ejectedUid && game.players[ejectedUid]) {
        game.players[ejectedUid].alive = false;
        game.players[ejectedUid].eliminatedBy = 'vote';
        updates[`players/${ejectedUid}/alive`] = false;
        updates[`players/${ejectedUid}/eliminatedBy`] = 'vote';
      }

      game.meeting.phase = 'results';
      game.meeting.result = { ejectedUid, tally, wasTie };
      game.meeting.resultsAt = now;
      updates['meeting/phase'] = 'results';
      updates['meeting/result'] = game.meeting.result;
      updates['meeting/resultsAt'] = now;
    } else if (
      game.meeting.phase === 'results' &&
      game.meeting.resultsAt &&
      now - game.meeting.resultsAt >= RESULTS_DISPLAY_MS
    ) {
      // Close the meeting: movement/actions resume on the next tick once
      // clients see `meeting: null`.
      game.meeting = null;
      updates.meeting = null;
    }
  }

  // Bot decisions (movement, tasks, kills, voting, meeting calls).
  Object.assign(updates, computeBotUpdates(game));

  // Win condition check, after meeting resolution and bot actions.
  if (game.status === 'active') {
    const winner = checkWinConditions(game);
    if (winner) {
      updates.status = 'ended';
      updates.winningTeam = winner;
      updates.endedAt = now;
    }
  }

  updates.hostHeartbeatAt = now;

  // Prune eventLog to the most recent MAX_EVENT_LOG_ENTRIES, accounting
  // for any new entries this tick added via `updates` (from bot actions
  // — player-driven actions like movement/elimination/tasks/meetings
  // write their own events directly via separate calls and aren't
  // reflected in `game.eventLog` until the next read, but those are
  // included in the NEXT tick's prune pass, so nothing is missed long-
  // term).
  const newEventEntries = Object.entries(updates)
    .filter(([path, value]) => path.startsWith('eventLog/') && value !== null)
    .map(([path, value]) => [path.slice('eventLog/'.length), value as { timestamp: number }] as const);

  const allEvents: ReadonlyArray<readonly [string, { timestamp: number }]> = [
    ...Object.entries(game.eventLog ?? {}),
    ...newEventEntries,
  ];

  if (allEvents.length > MAX_EVENT_LOG_ENTRIES) {
    [...allEvents]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, allEvents.length - MAX_EVENT_LOG_ENTRIES)
      .forEach(([id]) => {
        updates[`eventLog/${id}`] = null;
      });
  }

  await update(ref(db, `games/${roomCode}`), updates);
}

/**
 * Reads the current game state once (non-subscribing).
 */
export async function fetchGameState(roomCode: string): Promise<GameState | null> {
  const snapshot = await get(ref(db, `games/${roomCode}`));
  return snapshot.val() as GameState | null;
}
