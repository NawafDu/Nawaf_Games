import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { useGameLoop } from '@/hooks/useGameLoop';
import { useMatchHostMigration } from '@/hooks/useMatchHostMigration';
import { useReconnectHandlers } from '@/hooks/useReconnectHandlers';
import { Avatar } from '@/components/common/Avatar';
import MapView from '@/components/match/MapView';
import TaskPanel from '@/components/match/TaskPanel';
import ActionBar from '@/components/match/ActionBar';
import MinigameLauncher from '@/components/minigames/MinigameLauncher';
import MeetingOverlay from '@/components/meeting/MeetingOverlay';
import { moveToNode, GameActionError } from '@/lib/gameActions/movement';
import { withDevLatency } from '@/lib/devtools/devToolsStore';
import type { PlayerTask } from '@/types';

/**
 * Top-level screen for an active match. Subscribes to `/games/{code}`
 * (via useGameStore) and renders:
 * - A brief role-reveal banner the first time the match loads.
 * - The station map (MapView) with movement.
 * - The task panel (TaskPanel) + minigame launcher.
 * - The action bar (eliminate / report body / call meeting).
 * - The meeting overlay, shown fullscreen whenever `game.meeting` is set.
 *
 * Also runs the host-only game loop (useGameLoop) and match-phase host
 * migration (useMatchHostMigration). When `game.status === 'ended'`,
 * App.tsx's screen-routing effect (watching `game.status`) navigates to
 * PostGameScreen — this component doesn't navigate itself.
 */
export function MatchScreen() {
  const uid = useAuthStore((s) => s.uid);
  const { room, roomCode } = useRoomStore();
  const { game, myRole, subscribeToGame } = useGameStore();
  const showToast = useUIStore((s) => s.showToast);

  const [showRoleReveal, setShowRoleReveal] = useState(true);
  const [activeTask, setActiveTask] = useState<PlayerTask | null>(null);
  const [moving, setMoving] = useState(false);

  // Ensure we're subscribed to the game (App.tsx also subscribes on the
  // status transition, but this guards against a direct screen mount,
  // e.g. after a reload while status is already 'match').
  useEffect(() => {
    if (!roomCode || !uid) return;
    if (!game) {
      subscribeToGame(roomCode, uid);
    }
  }, [roomCode, uid, game, subscribeToGame]);

  const isHost = !!(uid && game && game.hostUid === uid);
  useGameLoop(roomCode, isHost, game?.status === 'active');
  useMatchHostMigration(roomCode, game, uid);
  // Re-registers onDisconnect and restores `connected: true` on
  // reconnect — previously only mounted in LobbyScreen, which meant a
  // mid-match disconnect/reconnect left rooms/{code}/players/{uid}.connected
  // stuck at false (used by useMatchHostMigration's pickNextHost).
  useReconnectHandlers(roomCode, uid);

  // Auto-dismiss the role reveal after a few seconds.
  useEffect(() => {
    if (!showRoleReveal) return;
    const timeout = setTimeout(() => setShowRoleReveal(false), 3500);
    return () => clearTimeout(timeout);
  }, [showRoleReveal]);

  if (!game || !uid || !roomCode || !room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 safe-area-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-signal" />
        <p className="text-sm text-white/50">Loading match…</p>
      </div>
    );
  }

  const me = game.players[uid];
  const myRoomPlayer = room.players[uid];

  const handleMove = async (targetNodeId: string) => {
    if (moving) return;
    setMoving(true);
    try {
      await withDevLatency(() => moveToNode(roomCode, uid, targetNodeId));
    } catch (err) {
      if (err instanceof GameActionError && err.code !== 'cooldown') {
        showToast(err.message, 'error');
      }
    } finally {
      setMoving(false);
    }
  };

  const meetingActive = !!game.meeting && game.meeting.phase !== 'closed';

  return (
    <div className="relative h-full w-full flex flex-col safe-area-screen bg-ink-950">
      {/* Status bar: role + alive state */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-ink-800">
        <div className="flex items-center gap-2">
          {myRoomPlayer && <Avatar avatarId={myRoomPlayer.avatarId} colorId={myRoomPlayer.colorId} size={28} />}
          <span className="text-sm text-white/80">{myRoomPlayer?.displayName ?? 'You'}</span>
        </div>
        <div className="flex items-center gap-2">
          {myRole && (
            <span
              className={[
                'text-xs font-medium px-2 py-1 rounded-full',
                myRole === 'saboteur' ? 'bg-alert/10 text-alert' : 'bg-signal/10 text-signal',
              ].join(' ')}
            >
              {myRole === 'saboteur' ? 'Saboteur' : 'Citizen'}
            </span>
          )}
          {me && !me.alive && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-ink-700 text-white/50">Eliminated</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {me && (
          <MapView game={game} myUid={uid} roomPlayers={room.players} onMove={handleMove} moving={moving} />
        )}

        {me && me.alive && (
          <TaskPanel tasks={me.tasks} currentNodeId={me.movement.currentNodeId} onLaunchTask={setActiveTask} />
        )}

        {me && !me.alive && (
          <div className="bg-ink-900 border border-ink-700 rounded-2xl p-4 text-center">
            <p className="text-sm text-white/60">
              You were eliminated. You can keep watching, but can no longer act.
            </p>
          </div>
        )}
      </div>

      {/* Action bar (hidden during meetings) */}
      {!meetingActive && me && (
        <ActionBar
          roomCode={roomCode}
          game={game}
          myUid={uid}
          roomPlayers={room.players}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Minigame overlay */}
      <MinigameLauncher roomCode={roomCode} uid={uid} task={activeTask} onClose={() => setActiveTask(null)} />

      {/* Meeting overlay */}
      <AnimatePresence>
        {meetingActive && (
          <MeetingOverlay roomCode={roomCode} game={game} myUid={uid} roomPlayers={room.players} />
        )}
      </AnimatePresence>

      {/* Role reveal */}
      <AnimatePresence>
        {showRoleReveal && myRole && (
          <div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-ink-950 px-6 text-center"
            onClick={() => setShowRoleReveal(false)}
          >
            <p className="text-sm text-white/50 uppercase tracking-widest">Your Role</p>
            <p className={['font-display text-3xl', myRole === 'saboteur' ? 'text-alert' : 'text-signal'].join(' ')}>
              {myRole === 'saboteur' ? 'Saboteur' : 'Citizen'}
            </p>
            <p className="text-sm text-white/50 max-w-xs">
              {myRole === 'saboteur'
                ? 'Eliminate citizens without getting caught. Blend in during meetings.'
                : "Complete your tasks and identify the Saboteur(s) before it's too late."}
            </p>
            <p className="text-xs text-white/30 mt-4">Tap anywhere to continue</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
