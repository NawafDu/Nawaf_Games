import {
  ref,
  runTransaction,
  serverTimestamp,
  get,
  set,
  remove,
  onDisconnect,
} from 'firebase/database';
import { db } from '@/lib/firebase';
import { generateRoomCode, makeUniqueDisplayName, normalizeRoomCode } from '@/utils/identifiers';
import { DEFAULT_ROOM_SETTINGS, saboteurRange, type RoomData, type RoomPlayer, type RoomSettings } from '@/types';
import { AVATAR_PRESETS, COLOR_PRESETS } from '@/lib/presets';

export class RoomServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function newPlayer(
  uid: string,
  displayName: string,
  baseName: string,
  avatarId: string,
  colorId: string,
  isHost: boolean
): RoomPlayer {
  const now = Date.now();
  return {
    uid,
    displayName,
    baseName,
    avatarId,
    colorId,
    isHost,
    isBot: false,
    ready: isHost, // host starts ready; can toggle off
    connected: true,
    joinedAt: now,
    lastSeen: now,
  };
}

/**
 * Creates a new room with a freshly generated unique code and the
 * creator as host. Retries on the rare chance of a code collision.
 */
export async function createRoom(
  uid: string,
  displayName: string,
  avatarId: string,
  colorId: string
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode(6);
    const roomRef = ref(db, `rooms/${code}`);
    const snapshot = await get(roomRef);
    if (snapshot.exists()) continue;

    const baseName = displayName.trim().slice(0, 16) || 'Player';
    const room: RoomData = {
      code,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      hostUid: uid,
      status: 'lobby',
      roundNumber: 0,
      activeGameId: null,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      players: {
        [uid]: newPlayer(uid, baseName, baseName, avatarId, colorId, true),
      },
    };

    try {
      await set(roomRef, room);
    } catch (err) {
      throw new RoomServiceError('write_failed', (err as Error).message);
    }

    setupDisconnectHandler(code, uid);
    return code;
  }

  throw new RoomServiceError('code_generation_failed', 'Could not generate a unique room code. Please try again.');
}

/**
 * Joins an existing room. Validates room exists, is joinable
 * (status === 'lobby'), and not full, then atomically reserves a player
 * slot with a unique display name.
 */
export async function joinRoom(
  roomCode: string,
  uid: string,
  displayName: string,
  avatarId: string,
  colorId: string
): Promise<string> {
  const code = normalizeRoomCode(roomCode);
  const roomRef = ref(db, `rooms/${code}`);

  const result = await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null) {
      // Abort transaction — handled below via committed flag.
      return room;
    }

    // If this uid is already a player (rejoin/reconnect case), just mark
    // them connected and return early without altering other state.
    if (room.players && room.players[uid]) {
      room.players[uid].connected = true;
      room.players[uid].lastSeen = Date.now();
      room.updatedAt = Date.now();
      return room;
    }

    if (room.status !== 'lobby') {
      // Reject join — abort by returning undefined signals "no change",
      // but we need to distinguish this case after the transaction, so
      // throw a sentinel via a marker field checked post-transaction.
      return room; // unchanged; checked below
    }

    const playerCount = room.players ? Object.keys(room.players).length : 0;
    if (playerCount >= room.settings.maxPlayers) {
      return room; // unchanged; full
    }

    const baseName = displayName.trim().slice(0, 16) || 'Player';
    const existingNames = Object.values(room.players ?? {}).map((p) => p.displayName);
    const unique = makeUniqueDisplayName(baseName, existingNames);

    room.players = room.players ?? {};
    room.players[uid] = newPlayer(uid, unique, baseName, avatarId, colorId, false);
    room.updatedAt = Date.now();
    return room;
  });

  if (!result.committed || result.snapshot.val() === null) {
    throw new RoomServiceError('room_not_found', 'Room not found. Check the code and try again.');
  }

  const room = result.snapshot.val() as RoomData;

  if (!room.players[uid]) {
    // Transaction completed but this uid wasn't added — distinguish why.
    if (room.status !== 'lobby') {
      throw new RoomServiceError('room_in_progress', 'This room already started a match. Try again once the round ends.');
    }
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= room.settings.maxPlayers) {
      throw new RoomServiceError('room_full', 'This room is full.');
    }
    throw new RoomServiceError('join_failed', 'Could not join the room. Please try again.');
  }

  setupDisconnectHandler(code, uid);
  return code;
}

/**
 * Registers an onDisconnect handler so that if this client disconnects
 * uncleanly (closed tab, lost connection, app backgrounded and killed),
 * the server marks them as disconnected. Also writes presence info.
 */
export function setupDisconnectHandler(roomCode: string, uid: string) {
  const playerConnectedRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`);
  const playerLastSeenRef = ref(db, `rooms/${roomCode}/players/${uid}/lastSeen`);
  const presenceRef = ref(db, `presence/${roomCode}/${uid}`);

  onDisconnect(playerConnectedRef).set(false);
  onDisconnect(playerLastSeenRef).set(serverTimestamp());
  onDisconnect(presenceRef).set({ online: false, lastChanged: serverTimestamp() });

  set(presenceRef, { online: true, lastChanged: Date.now() }).catch(() => {
    /* non-critical */
  });
}

/**
 * Leaves a room cleanly (explicit "Leave Lobby" action). Removes the
 * player and, if they were host, hands host to the next-oldest connected
 * human (mirrors host migration priority rules). Removes the room
 * entirely if no players remain.
 */
export async function leaveRoom(roomCode: string, uid: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null || !room.players || !room.players[uid]) return room;

    const wasHost = room.hostUid === uid;
    delete room.players[uid];

    const remaining = Object.values(room.players);
    if (remaining.length === 0) {
      // Signal deletion by returning null.
      return null;
    }

    if (wasHost) {
      const nextHost = pickNextHost(remaining, null);
      if (nextHost) {
        room.hostUid = nextHost.uid;
        room.players[nextHost.uid].isHost = true;
      }
    }

    room.updatedAt = Date.now();
    return room;
  });

  // Clean up presence record.
  try {
    await remove(ref(db, `presence/${roomCode}/${uid}`));
  } catch {
    /* non-critical */
  }
}

/**
 * Picks the next host from a list of remaining players, per migration
 * rules: oldest connected human (lowest joinedAt). Bots are never
 * eligible. `excludeUid` (if provided) is also excluded — used so the
 * disconnecting/leaving host isn't re-selected.
 */
export function pickNextHost(players: RoomPlayer[], excludeUid: string | null): RoomPlayer | null {
  const eligible = players.filter(
    (p) => !p.isBot && p.connected && p.uid !== excludeUid
  );
  if (eligible.length === 0) return null;
  return eligible.reduce((oldest, p) => (p.joinedAt < oldest.joinedAt ? p : oldest));
}

/**
 * Toggles the current player's ready state.
 */
export async function setReady(roomCode: string, uid: string, ready: boolean): Promise<void> {
  await set(ref(db, `rooms/${roomCode}/players/${uid}/ready`), ready);
  await set(ref(db, `rooms/${roomCode}/updatedAt`), Date.now());
}

/**
 * Updates the current player's customization (name/avatar/color).
 * Re-derives a unique display name if the base name collides.
 */
export async function updatePlayerCustomization(
  roomCode: string,
  uid: string,
  baseName: string,
  avatarId: string,
  colorId: string
): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null || !room.players || !room.players[uid]) return room;

    const trimmed = baseName.trim().slice(0, 16) || 'Player';
    const others = Object.entries(room.players)
      .filter(([otherUid]) => otherUid !== uid)
      .map(([, p]) => p.displayName);

    const unique = makeUniqueDisplayName(trimmed, others);

    room.players[uid].baseName = trimmed;
    room.players[uid].displayName = unique;
    room.players[uid].avatarId = avatarId;
    room.players[uid].colorId = colorId;
    room.updatedAt = Date.now();
    return room;
  });
}

/**
 * Host-only: updates room settings, clamping saboteurCount to the valid
 * range for the current maxPlayers.
 */
export async function updateRoomSettings(roomCode: string, settings: RoomSettings): Promise<void> {
  const range = saboteurRange(settings.maxPlayers);
  const clamped: RoomSettings = {
    ...settings,
    saboteurCount: Math.min(Math.max(settings.saboteurCount, range.min), range.max),
  };
  await set(ref(db, `rooms/${roomCode}/settings`), clamped);
  await set(ref(db, `rooms/${roomCode}/updatedAt`), Date.now());
}

/**
 * Host-only: kicks a player from the lobby.
 */
export async function kickPlayer(roomCode: string, targetUid: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null || !room.players || !room.players[targetUid]) return room;
    if (room.players[targetUid].isHost) return room; // can't kick host (shouldn't happen)
    delete room.players[targetUid];
    room.updatedAt = Date.now();
    return room;
  });
}

const BOT_NAME_POOL = [
  'Vex', 'Ryx', 'Quill', 'Nyx', 'Zeph', 'Korra', 'Pixl', 'Tane',
  'Orin', 'Vasq', 'Lumen', 'Drex', 'Sable', 'Quinn', 'Brix', 'Talo',
];

/**
 * Host-only: fills empty slots (up to maxPlayers) with bots of the
 * given difficulty, using random avatar/color presets and bot name pool.
 */
export async function fillWithBots(roomCode: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null) return room;

    const existingNames = Object.values(room.players ?? {}).map((p) => p.displayName);
    const slotsOpen = room.settings.maxPlayers - Object.keys(room.players ?? {}).length;
    if (slotsOpen <= 0) return room;

    room.players = room.players ?? {};
    const shuffledNames = [...BOT_NAME_POOL].sort(() => Math.random() - 0.5);
    const namesSet = new Set(existingNames);

    for (let i = 0; i < slotsOpen; i++) {
      const botUid = `bot_${Math.random().toString(36).slice(2, 10)}`;
      const baseName = shuffledNames[i % shuffledNames.length];
      const unique = makeUniqueDisplayName(baseName, namesSet);
      namesSet.add(unique);

      const avatar = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
      const color = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];

      const now = Date.now();
      room.players[botUid] = {
        uid: botUid,
        displayName: unique,
        baseName,
        avatarId: avatar.id,
        colorId: color.id,
        isHost: false,
        isBot: true,
        botDifficulty: difficulty,
        ready: true,
        connected: true,
        joinedAt: now,
        lastSeen: now,
      };
    }

    room.updatedAt = Date.now();
    return room;
  });
}

/**
 * Host-only: removes all bots from the room.
 */
export async function removeAllBots(roomCode: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);
  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null || !room.players) return room;
    for (const [uid, player] of Object.entries(room.players)) {
      if (player.isBot) delete room.players[uid];
    }
    room.updatedAt = Date.now();
    return room;
  });
}

/**
 * Called from PostGameScreen by the host (room host or, if migration
 * occurred mid-match, the current game host — both are permitted to
 * write `rooms/{code}/status` per database.rules.json) to return the
 * room to the lobby for another round:
 * - Sets `rooms/{code}.status = 'lobby'`.
 * - Clears `activeGameId` (writable by either host per the rules).
 * - If the game host differs from the room host (migration happened
 *   mid-match), syncs `rooms/{code}.hostUid` to the game host so the
 *   same person remains host going into the next lobby.
 * - Resets every human player's `ready` flag to false (bots remain
 *   `ready: true`, matching fillWithBots) so everyone must re-ready.
 *
 * Does NOT delete `/games/{code}` or `/chat/{code}` — the security rules
 * grant no bulk-delete permission on either path (only per-field/
 * per-message writes), so any such call would silently fail. This is
 * harmless: `startMatch` overwrites `/games/{code}` via `set()` for the
 * next round, and stale chat under old (unique) meeting IDs is never
 * read again.
 */
export async function returnToLobby(roomCode: string, currentGameHostUid: string): Promise<void> {
  const roomRef = ref(db, `rooms/${roomCode}`);

  await runTransaction(roomRef, (room: RoomData | null) => {
    if (room === null) return room;
    if (room.status !== 'match' && room.status !== 'starting') return room;

    room.status = 'lobby';
    room.activeGameId = null;

    if (room.hostUid !== currentGameHostUid && room.players[currentGameHostUid]) {
      // Demote the previous host, promote the current game host.
      if (room.players[room.hostUid]) {
        room.players[room.hostUid].isHost = false;
      }
      room.hostUid = currentGameHostUid;
      room.players[currentGameHostUid].isHost = true;
    }

    for (const player of Object.values(room.players)) {
      player.ready = player.isBot ? true : false;
    }

    room.updatedAt = Date.now();
    return room;
  });
}

/**
 * Removes a room entirely. Used by cleanup logic for stale rooms.
 */
export async function deleteRoom(roomCode: string): Promise<void> {
  await remove(ref(db, `rooms/${roomCode}`));
  await remove(ref(db, `games/${roomCode}`));
  await remove(ref(db, `chat/${roomCode}`));
  await remove(ref(db, `presence/${roomCode}`));
}
