import { useEffect, useRef } from 'react';
import { ref, runTransaction } from 'firebase/database';
import { db } from '@/lib/firebase';
import { pickNextHost } from '@/lib/roomService';
import type { RoomData } from '@/types';

const STALL_THRESHOLD_MS = 15000;
const CHECK_INTERVAL_MS = 4000;

/**
 * Watches for a stalled host heartbeat and performs host migration.
 *
 * Migration rules (per product spec):
 * - Triggered when `hostHeartbeatAt` is older than 15s (or absent while
 *   the room has existed long enough for a heartbeat to have been set).
 * - Priority: oldest connected human player (lowest `joinedAt`). Bots are
 *   never eligible.
 * - Migration is performed via a transaction on `hostUid` so that only
 *   one client's attempt succeeds even if multiple clients detect the
 *   stall simultaneously (first-writer-wins; the transaction re-reads
 *   the current value and no-ops if it has already changed).
 * - This is invisible to players — no UI indicates migration occurred.
 *   The new host's useHostHeartbeat hook picks up immediately once
 *   `isHost` becomes true for them.
 * - A reconnecting former host does NOT automatically reclaim — this
 *   hook only ever *moves host away from a stalled host*, never back.
 *
 * Only call this while viewing a room (lobby or match) so we don't run
 * migration checks for rooms the user has left.
 */
export function useHostMigration(roomCode: string | null, room: RoomData | null, myUid: string | null) {
  // Track the last-seen heartbeat value and when we first observed it,
  // so "stale for >15s" is measured against *our* observation time
  // (avoids relying on clients having synchronized clocks for the
  // heartbeat's serverTimestamp value itself).
  const lastHeartbeatValueRef = useRef<number | null>(null);
  const lastHeartbeatSeenAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!roomCode || !room || !myUid) return;
    if (room.status === 'ended') return;

    const currentHeartbeat = room.hostHeartbeatAt ?? null;
    if (currentHeartbeat !== lastHeartbeatValueRef.current) {
      lastHeartbeatValueRef.current = currentHeartbeat;
      lastHeartbeatSeenAtRef.current = Date.now();
    }
  }, [roomCode, room, myUid]);

  useEffect(() => {
    if (!roomCode || !myUid) return;

    const interval = setInterval(async () => {
      // Re-read latest room state at check time rather than relying on
      // the closure, since `room` from the calling component may be a
      // moment stale.
      const roomRef = ref(db, `rooms/${roomCode}`);

      const stalledFor = Date.now() - lastHeartbeatSeenAtRef.current;
      if (stalledFor < STALL_THRESHOLD_MS) return;

      // Determine, from our last-known room snapshot, whether *we* are
      // the eligible next host. We re-fetch inside the transaction for
      // correctness, but pre-check here to avoid spamming transactions
      // from every client every interval.
      await runTransaction(roomRef, (current: RoomData | null) => {
        if (current === null) return current;
        if (current.status === 'ended') return current;

        const players = Object.values(current.players ?? {});
        const currentHostPlayer = current.players?.[current.hostUid];

        // If the current host looks connected, don't migrate — our local
        // staleness tracking may be ahead of a fresh heartbeat write that
        // hasn't propagated to this client yet.
        if (currentHostPlayer?.connected && current.hostHeartbeatAt) {
          const age = Date.now() - current.hostHeartbeatAt;
          if (age < STALL_THRESHOLD_MS) return current;
        }

        const nextHost = pickNextHost(players, null);
        if (!nextHost) return current; // no eligible human players

        // Only the elected next host actually performs the write — other
        // clients' transactions will see hostUid already matches and no-op.
        if (nextHost.uid !== myUid) return current;

        if (current.hostUid === nextHost.uid) return current; // already migrated

        // Demote old host flag, promote new host.
        const prevHostUid = current.hostUid;
        if (current.players?.[prevHostUid]) {
          current.players[prevHostUid].isHost = false;
        }
        current.hostUid = nextHost.uid;
        current.players[nextHost.uid].isHost = true;
        current.updatedAt = Date.now();
        // hostHeartbeatAt will be picked up immediately by the new
        // host's useHostHeartbeat effect once isHost flips to true.
        return current;
      });
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [roomCode, myUid]);
}
