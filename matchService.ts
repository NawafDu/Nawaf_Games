import { ref, set, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateMapLayout } from '@/lib/mapGenerator';
import { getMinigamesByLength } from '@/lib/minigames/registry';
import { generateId } from '@/utils/identifiers';
import type {
  GameState,
  MapLayout,
  PlayerMatchState,
  PlayerRole,
  PlayerTask,
  RoomData,
  RoomSettings,
  TaskLength,
} from '@/types';

/**
 * Shuffles an array using Fisher-Yates. Returns a new array.
 */
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Assigns roles to players: `saboteurCount` random players become
 * Saboteurs, the rest Citizens.
 */
function assignRoles(playerUids: string[], saboteurCount: number): Record<string, PlayerRole> {
  const shuffled = shuffle(playerUids);
  const roles: Record<string, PlayerRole> = {};
  shuffled.forEach((uid, i) => {
    roles[uid] = i < saboteurCount ? 'saboteur' : 'citizen';
  });
  return roles;
}

/**
 * Generates a personal task list for one player: for each task length
 * (short/medium/long), pick `taskCounts[length]` tasks, each assigned a
 * random minigame of that length and a random map node as its location.
 * Citizens and Saboteurs both get task lists of identical shape — the
 * distinction (real vs. fake) is purely in how completion is scored, not
 * in the data structure.
 */
function generatePlayerTasks(settings: RoomSettings, map: MapLayout): PlayerTask[] {
  const nodeIds = Object.keys(map.nodes);
  const tasks: PlayerTask[] = [];

  const lengths: TaskLength[] = ['short', 'medium', 'long'];
  for (const length of lengths) {
    const count = settings.taskCounts[length];
    const pool = getMinigamesByLength(length);
    for (let i = 0; i < count; i++) {
      const minigame = pool[Math.floor(Math.random() * pool.length)];
      const nodeId = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      tasks.push({
        id: generateId('task_'),
        minigameId: minigame.id,
        length,
        nodeId,
        status: 'pending',
        progress: 0,
      });
    }
  }

  return tasks;
}

export class MatchStartError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Host-only: generates a new match (map, roles, tasks), writes
 * `/games/{roomCode}`, and transitions `/rooms/{roomCode}` to status
 * 'match'. Uses a transaction on the room to ensure only one client can
 * start the match (e.g. if the host double-taps "Start Match" or two
 * clients race).
 */
export async function startMatch(roomCode: string, hostUid: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);

  // Step 1: transactionally claim the "starting" transition. This
  // prevents double-starts (duplicate-click protection at the data
  // layer, on top of the UI-level useAsyncAction guard).
  const claim = await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null) return room;
    if (room.status !== 'lobby') return room; // already starting/started
    if (room.hostUid !== hostUid) return room; // only host can start

    room.status = 'starting';
    room.updatedAt = Date.now();
    return room;
  });

  if (!claim.committed || claim.snapshot.val() === null) {
    throw new MatchStartError('room_not_found', 'Room not found.');
  }

  const room = claim.snapshot.val() as RoomData;
  if (room.status !== 'starting') {
    // We didn't win the claim (someone else started, or it's mid-match).
    throw new MatchStartError('already_starting', 'A match is already starting or in progress.');
  }

  // Step 2: generate match content.
  const players = Object.values(room.players);
  const playerUids = players.map((p) => p.uid);
  const map = generateMapLayout(room.settings.nodeCount);
  const roles = assignRoles(playerUids, room.settings.saboteurCount);

  const matchPlayers: Record<string, PlayerMatchState> = {};
  const secrets: Record<string, { role: PlayerRole }> = {};
  const startEventId = generateId('evt_');

  for (const uid of playerUids) {
    matchPlayers[uid] = {
      uid,
      role: roles[uid],
      alive: true,
      movement: { currentNodeId: map.spawnNodeId, lastMovedAt: 0 },
      tasks: generatePlayerTasks(room.settings, map),
      connected: true,
    };
    secrets[uid] = { role: roles[uid] };
  }

  const game: GameState = {
    id: roomCode,
    roomCode,
    startedAt: Date.now(),
    status: 'active',
    settings: room.settings,
    map,
    players: matchPlayers,
    meeting: null,
    eventLog: {
      [startEventId]: {
        id: startEventId,
        type: 'game_started',
        actorUid: hostUid,
        timestamp: Date.now(),
        visibilityRadius: 99,
      },
    },
    unreportedBodies: {},
    winningTeam: null,
    hostHeartbeatAt: Date.now(),
    hostUid,
  };

  await set(ref(db, `games/${roomCode}`), game);
  await set(ref(db, `games/${roomCode}/secrets`), secrets);

  // Step 3: flip room status to 'match'.
  await runTransaction(roomRef, (current: RoomData | null) => {
    if (current === null) return current;
    current.status = 'match';
    current.activeGameId = roomCode;
    current.roundNumber = (current.roundNumber ?? 0) + 1;
    current.updatedAt = Date.now();
    return current;
  });
}
