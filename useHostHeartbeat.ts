import { useEffect } from 'react';
import { ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';

const HEARTBEAT_INTERVAL_MS = 5000;

/**
 * If the current user is the room's host, periodically writes a
 * heartbeat timestamp to `rooms/{code}/hostHeartbeatAt`. Other clients
 * use this to detect host loss (see useHostMigration).
 *
 * Safe to call unconditionally — it no-ops for non-hosts.
 */
export function useHostHeartbeat(roomCode: string | null, uid: string | null, isHost: boolean) {
  useEffect(() => {
    if (!roomCode || !uid || !isHost) return;

    const heartbeatRef = ref(db, `rooms/${roomCode}/hostHeartbeatAt`);

    // Write immediately, then on an interval.
    set(heartbeatRef, serverTimestamp()).catch(() => {});

    const interval = setInterval(() => {
      set(heartbeatRef, serverTimestamp()).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomCode, uid, isHost]);
}
