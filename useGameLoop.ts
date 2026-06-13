import { useEffect, useRef } from 'react';
import { runGameLoopTick } from '@/lib/gameActions/gameLoop';

const TICK_INTERVAL_MS = 1000;

/**
 * If the current user is the match host, runs `runGameLoopTick`
 * periodically. No-ops for non-hosts.
 *
 * Ticks run sequentially (a tick won't start while the previous one is
 * still in flight) to avoid overlapping reads/writes if a tick is slow
 * due to network latency.
 */
export function useGameLoop(roomCode: string | null, isHost: boolean, active: boolean) {
  const runningRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !isHost || !active) return;

    const interval = setInterval(() => {
      if (runningRef.current) return;
      runningRef.current = true;
      runGameLoopTick(roomCode)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[gameLoop] tick failed', err);
        })
        .finally(() => {
          runningRef.current = false;
        });
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomCode, isHost, active]);
}
