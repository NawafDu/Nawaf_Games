const KEY = 'shadowcircuit.activeRoom';

// Matches the room inactivity TTL documented in FIREBASE_SCHEMA.md.
// If a saved room reference is older than this, don't bother attempting
// to rejoin — the room has very likely been cleaned up server-side.
const MAX_AGE_MS = 60 * 60 * 1000;

interface ActiveRoomRecord {
  code: string;
  savedAt: number;
}

/**
 * Persists the active room code so the player can be automatically
 * reconnected after a page reload, closing/reopening Safari, or a brief
 * connectivity loss.
 *
 * Uses `localStorage` rather than `sessionStorage`: sessionStorage is
 * cleared when Safari fully closes (not just backgrounded), which would
 * break "closed Safari" reconnection. localStorage persists until
 * explicitly cleared.
 */
export function saveActiveRoom(roomCode: string) {
  try {
    const record: ActiveRoomRecord = { code: roomCode, savedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* localStorage unavailable (e.g. private mode) — reconnection will
       simply not be offered; the rest of the app still functions. */
  }
}

/**
 * Returns the saved room code if one exists and isn't older than
 * MAX_AGE_MS, otherwise null (and clears the stale entry).
 */
export function readActiveRoom(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const record = JSON.parse(raw) as ActiveRoomRecord;
    if (!record.code || typeof record.savedAt !== 'number') {
      clearActiveRoom();
      return null;
    }

    if (Date.now() - record.savedAt > MAX_AGE_MS) {
      clearActiveRoom();
      return null;
    }

    return record.code;
  } catch {
    return null;
  }
}

/**
 * Refreshes the saved timestamp without changing the code — call this
 * periodically while in a room so a long-running session doesn't expire
 * the saved reference while still actively in use.
 */
export function touchActiveRoom() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const record = JSON.parse(raw) as ActiveRoomRecord;
    if (!record.code) return;
    saveActiveRoom(record.code);
  } catch {
    /* ignore */
  }
}

export function clearActiveRoom() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
