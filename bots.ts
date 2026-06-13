import { generateId } from '@/utils/identifiers';
import { MOVEMENT_COOLDOWN_MS } from '@/types';
import { checkWinConditions } from './winConditions';
import type { GameState, PlayerMatchState } from '@/types';

// -----------------------------------------------------------------------
// Baseline bot behavior for Phase 3, so matches with bots are fully
// playable. Phase 4 will expand this with richer suspicion-tracking,
// alibi-building, and difficulty-tuned decision-making.
//
// Design note: bots have no client of their own, so the host's client
// computes bot actions. Because security rules validate writes per
// targeted path (see database.rules.json), this module does NOT mutate
// `game` in place and return it for a whole-object write. Instead, each
// step function:
//   - reads from a local *working copy* of `game` (so later bots in the
//     same tick see earlier bots' decisions, e.g. two bots won't both
//     "claim" the same kill), and
//   - APPENDS entries to the `updates` map (RTDB multi-path update
//     format: relative path -> new value), which the caller passes to a
//     single `update(ref(db, 'games/{code}'), updates)` call.
// -----------------------------------------------------------------------

export type PathUpdates = Record<string, unknown>;

function randomChoice<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Runs one decision step for a single bot player. Mutates `game`
 * (working copy) and `updates` (output map) in place.
 */
function stepBot(game: GameState, updates: PathUpdates, bot: PlayerMatchState, now: number): void {
  if (!bot.alive) return;
  if (game.meeting && game.meeting.phase !== 'closed') return;

  const currentNode = game.map.nodes[bot.movement.currentNodeId];
  if (!currentNode) return;

  // --- Saboteur bots: look for an isolated target to eliminate. ---
  if (bot.role === 'saboteur') {
    const cooldownMs = game.settings.killCooldownSec * 1000;
    const canKillNow = !bot.lastKillAt || now - bot.lastKillAt >= cooldownMs;

    if (canKillNow) {
      const occupants = Object.values(game.players).filter(
        (p) => p.alive && p.movement.currentNodeId === bot.movement.currentNodeId
      );
      if (occupants.length === 2) {
        const target = occupants.find((p) => p.uid !== bot.uid);
        if (target) {
          target.alive = false;
          target.eliminatedBy = 'kill';
          bot.lastKillAt = now;
          game.unreportedBodies[target.uid] = {
            uid: target.uid,
            nodeId: target.movement.currentNodeId,
            killedAt: now,
          };
          const eventId = generateId('evt_');
          game.eventLog[eventId] = {
            id: eventId,
            type: 'kill',
            actorUid: bot.uid,
            targetUid: target.uid,
            nodeId: target.movement.currentNodeId,
            timestamp: now,
            visibilityRadius: 0,
          };

          updates[`players/${target.uid}/alive`] = false;
          updates[`players/${target.uid}/eliminatedBy`] = 'kill';
          updates[`players/${bot.uid}/lastKillAt`] = now;
          updates[`unreportedBodies/${target.uid}`] = game.unreportedBodies[target.uid];
          updates[`eventLog/${eventId}`] = game.eventLog[eventId];
          return; // acted this tick
        }
      }
    }
  }

  // --- All bots: report a body if one is here and unreported. ---
  const bodyHere = Object.values(game.unreportedBodies).find(
    (b) => b.nodeId === bot.movement.currentNodeId
  );
  if (bodyHere) {
    const shouldReport = bot.role === 'citizen' || Math.random() < 0.5;
    if (shouldReport) {
      delete game.unreportedBodies[bodyHere.uid];
      const meetingId = generateId('mtg_');
      const meeting = {
        id: meetingId,
        type: 'body_report' as const,
        calledBy: bot.uid,
        reportedBody: bodyHere.uid,
        phase: 'discussion' as const,
        startedAt: now,
        discussionEndsAt: now + game.settings.discussionDurationSec * 1000,
        votingEndsAt: 0,
        votes: {},
      };
      game.meeting = meeting;

      const eventId = generateId('evt_');
      game.eventLog[eventId] = {
        id: eventId,
        type: 'body_found',
        actorUid: bot.uid,
        targetUid: bodyHere.uid,
        timestamp: now,
        visibilityRadius: 99,
      };

      updates[`unreportedBodies/${bodyHere.uid}`] = null;
      updates.meeting = meeting;
      updates[`eventLog/${eventId}`] = game.eventLog[eventId];
      return; // acted this tick
    }
  }

  // --- All bots: try to complete a task at the current location. ---
  const taskHere = bot.tasks.find((t) => t.nodeId === bot.movement.currentNodeId && t.status !== 'completed');
  if (taskHere) {
    if (Math.random() < 0.35) {
      taskHere.status = 'completed';
      taskHere.progress = 100;
      const eventId = generateId('evt_');
      game.eventLog[eventId] = {
        id: eventId,
        type: 'task_completed',
        actorUid: bot.uid,
        nodeId: taskHere.nodeId,
        timestamp: now,
        visibilityRadius: 1,
      };

      updates[`players/${bot.uid}/tasks`] = bot.tasks;
      updates[`eventLog/${eventId}`] = game.eventLog[eventId];
    }
    return; // stay here this tick whether or not the task finished
  }

  // --- Movement: respect cooldown, then move toward a node with a
  // pending task (if any), otherwise wander randomly. ---
  const cooldownMs = MOVEMENT_COOLDOWN_MS[game.settings.movementSpeed];
  if (now - bot.movement.lastMovedAt < cooldownMs) return;

  const pendingTaskNodes = new Set(bot.tasks.filter((t) => t.status !== 'completed').map((t) => t.nodeId));
  let destination = currentNode.neighbors.find((n) => pendingTaskNodes.has(n));
  if (!destination) {
    destination = randomChoice(currentNode.neighbors);
  }

  if (destination) {
    bot.movement.currentNodeId = destination;
    bot.movement.lastMovedAt = now;

    const eventId = generateId('evt_');
    game.eventLog[eventId] = {
      id: eventId,
      type: 'player_moved',
      actorUid: bot.uid,
      nodeId: destination,
      timestamp: now,
      visibilityRadius: 1,
    };

    updates[`players/${bot.uid}/movement`] = { ...bot.movement };
    updates[`eventLog/${eventId}`] = game.eventLog[eventId];
  }
}

/**
 * Casts votes for all bots during the voting phase. Difficulty affects
 * how often a bot acts on a "who was near the scene" signal vs. voting
 * randomly/skipping.
 */
function stepBotVoting(game: GameState, updates: PathUpdates, bot: PlayerMatchState): void {
  if (!bot.alive || !game.meeting || game.meeting.phase !== 'voting') return;
  if (game.meeting.votes[bot.uid]) return; // already voted

  const difficulty = game.settings.botDifficulty;
  const suspicionChance = difficulty === 'hard' ? 0.7 : difficulty === 'medium' ? 0.45 : 0.2;

  const livingOthers = Object.values(game.players).filter((p) => p.alive && p.uid !== bot.uid);

  let suspect: string | undefined;
  if (game.meeting.reportedBody) {
    const victim = game.players[game.meeting.reportedBody];
    const bodyNodeId = victim?.movement.currentNodeId;

    if (bodyNodeId) {
      const moveEvents = Object.values(game.eventLog)
        .filter((e) => e.type === 'player_moved' && e.nodeId === bodyNodeId)
        .sort((a, b) => b.timestamp - a.timestamp);
      const candidate = moveEvents.find((e) => livingOthers.some((p) => p.uid === e.actorUid));
      suspect = candidate?.actorUid;
    }
  }

  let choice: string;
  if (suspect && Math.random() < suspicionChance) {
    choice = suspect;
  } else if (Math.random() < 0.4 && livingOthers.length > 0) {
    choice = randomChoice(livingOthers)!.uid;
  } else {
    choice = 'skip';
  }

  game.meeting.votes[bot.uid] = choice;
  updates[`meeting/votes/${bot.uid}`] = choice;
}

/**
 * Runs one game-loop tick's worth of bot decisions against a working
 * copy of `game`, returning the set of targeted path updates to merge
 * into the host's `update()` call.
 */
export function computeBotUpdates(game: GameState): PathUpdates {
  if (game.status !== 'active') return {};

  const updates: PathUpdates = {};
  const bots = Object.values(game.players).filter((p) => p.uid.startsWith('bot_'));

  if (game.meeting && game.meeting.phase === 'voting') {
    for (const bot of bots) stepBotVoting(game, updates, bot);
    return updates;
  }

  if (game.meeting && game.meeting.phase !== 'closed') return updates;

  const now = Date.now();
  for (const bot of bots) {
    stepBot(game, updates, bot, now);
    if (checkWinConditions(game)) break;
  }

  return updates;
}
