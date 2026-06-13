import { useEffect } from 'react';
import { onValue, ref, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { setupDisconnectHandler } from '@/lib/roomService';

/**
 * Firebase's `onDisconnect()` registrations are tied to a specific
 * websocket connection. If that connection drops and a new one is
 * established (reconnect after airplane mode, network switch, etc.),
 * previously-registered onDisconnect operations for the OLD connection
 * are irrelevant to the NEW one — the SDK does re-send queued
 * onDisconnect ops on reconnect for handlers registered via the same
 * SDK instance, but to be defensive (especially across iOS Safari
 * backgrounding, which can fully suspend the JS runtime and drop the
 * socket), we re-register on every `.info/connected` transition to
 * `true` while in a room.
 *
 * This guarantees that however the player reconnects — and however long
 * they were away — the server will correctly mark them as disconnected
 * if they go away again.
 */
export function useReconnectHandlers(roomCode: string | null, uid: string | null) {
  useEffect(() => {
    if (!roomCode || !uid) return;

    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      if (snapshot.val() === true) {
        setupDisconnectHandler(roomCode, uid);

        // Restore "connected" status — if a previous disconnect fired
        // (or this is a fresh session after the app was fully closed),
        // the player's record may still show connected: false.
        set(ref(db, `rooms/${roomCode}/players/${uid}/connected`), true).catch(() => {});
        set(ref(db, `rooms/${roomCode}/players/${uid}/lastSeen`), serverTimestamp()).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [roomCode, uid]);
}
