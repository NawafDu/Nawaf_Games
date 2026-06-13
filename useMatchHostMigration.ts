import { useEffect, useRef } from 'react';
import { ref, runTransaction, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { pickNextHost } from '@/lib/roomService';
import { generateId } from '@/utils/identifiers';
import type { GameState, RoomPlayer } from '@/types';

const STALL_THRESHOLD_MS = 15000;
const CHECK_INTERVAL_MS = 4000;

/**
 * Match-phase equivalent of useHostMigration (lobby). Watches
 * `games/{code}/hostHeartbeatAt` for staleness and migrates
 * `games/{code}/hostUid` to the oldest connected human player (per
 * `rooms/{code}/players`, which tracks `connected`/`joinedAt`/`isBot` —
 * `games/{code}/players` doesn't duplicate these fields).
 *
 * Mirrors the lobby version's rules: bots never become host, migration
 * is invisible (the new host's useGameLoop picks up automatically once
 * `isHost` becomes true), and a reconnecting former host does not
 * reclaim — this only ever moves host away from a stalled host.
 */
export function useMatchHostMigration(roomCode: string | null, game: GameState | null, myUid: string | null) {
  const lastHeartbeatValueRef = useRef<number | null>(null);
  const lastHeartbeatSeenAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!roomCode || !game || !myUid) return;
    if (game.status !== 'active') return;

    const currentHeartbeat = game.hostHeartbeatAt ?? null;
    if (currentHeartbeat !== lastHeartbeatValueRef.current) {
      lastHeartbeatValueRef.current = currentHeartbeat;
      lastHeartbeatSeenAtRef.current = Date.now();
    }
  }, [roomCode, game, myUid]);

  useEffect(() => {
    if (!roomCode || !myUid) return;

    const interval = setInterval(async () => {
      const stalledFor = Date.now() - lastHeartbeatSeenAtRef.current;
      if (stalledFor < STALL_THRESHOLD_MS) return;

      // Re-check the live heartbeat before migrating — our local
      // staleness tracking may be ahead of a fresh write that hasn't
      // propagated yet.
      const [heartbeatSnap, playersSnap] = await Promise.all([
        get(ref(db, `games/${roomCode}/hostHeartbeatAt`)),
        get(ref(db, `rooms/${roomCode}/players`)),
      ]);

      const heartbeat = heartbeatSnap.val() as number | null;
      if (heartbeat) {
        const age = Date.now() - heartbeat;
        if (age < STALL_THRESHOLD_MS) {
          lastHeartbeatValueRef.current = heartbeat;
          lastHeartbeatSeenAtRef.current = Date.now();
          return;
        }
      }

      const players = Object.values((playersSnap.val() ?? {}) as Record<string, RoomPlayer>);
      const nextHost = pickNextHost(players, null);
      if (!nextHost || nextHost.uid !== myUid) return; // not our turn to claim

      const gameHostRef = ref(db, `games/${roomCode}/hostUid`);
      const previousHostUid = game?.hostUid ?? null;
      const result = await runTransaction(gameHostRef, (currentHostUid: string | null) => {
        if (currentHostUid === null) return currentHostUid;
        if (currentHostUid === nextHost.uid) return currentHostUid; // already migrated
        return nextHost.uid;
      });

      // Log a host_migration event (best-effort) so the Event Log Viewer
      // can show migration history. Only the player who WON the
      // migration logs it, and only if the value actually changed (the
      // `currentHostUid === nextHost.uid` no-op case above still
      // "commits" with an unchanged value, which we don't want to log
      // repeatedly).
      if (result.committed && previousHostUid && result.snapshot.val() === nextHost.uid && previousHostUid !== nextHost.uid) {
        const eventId = generateId('evt_');
        await set(ref(db, `games/${roomCode}/eventLog/${eventId}`), {
          id: eventId,
          type: 'host_migration',
          actorUid: nextHost.uid,
          targetUid: previousHostUid,
          timestamp: Date.now(),
          visibilityRadius: 99,
        }).catch(() => {
          /* non-critical */
        });
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [roomCode, myUid]);
}
