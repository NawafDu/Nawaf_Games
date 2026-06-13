import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

/**
 * Subscribes to Firebase's special `.info/connected` path, which reflects
 * the actual websocket connection state to the RTDB backend (not just
 * browser online/offline). This is the foundation for connection-recovery
 * UI and for onDisconnect()-based presence handling elsewhere.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      setStatus(snapshot.val() === true ? 'connected' : 'disconnected');
    });
    return () => unsubscribe();
  }, []);

  return status;
}
