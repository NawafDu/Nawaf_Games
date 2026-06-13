import { useState } from 'react';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { RoomCodeCard } from '@/components/lobby/RoomCodeCard';
import { PlayerListItem } from '@/components/lobby/PlayerListItem';
import { CustomizationSheet } from '@/components/lobby/CustomizationSheet';
import { SettingsSheet } from '@/components/lobby/SettingsSheet';
import { BotControls } from '@/components/lobby/BotControls';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useUIStore } from '@/store/uiStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useHostHeartbeat } from '@/hooks/useHostHeartbeat';
import { useHostMigration } from '@/hooks/useHostMigration';
import { useReconnectHandlers } from '@/hooks/useReconnectHandlers';
import { setReady, leaveRoom, kickPlayer } from '@/lib/roomService';
import { startMatch, MatchStartError } from '@/lib/matchService';
import { validateStart } from '@/lib/lobbyValidation';
import { clearActiveRoom } from '@/lib/sessionPersistence';

export function LobbyScreen() {
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const uid = useAuthStore((s) => s.uid);
  const { room, roomCode, loading, unsubscribeFromRoom } = useRoomStore();

  const [showCustomization, setShowCustomization] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const me = room && uid ? room.players?.[uid] : null;
  const isHost = me?.isHost ?? false;

  useHostHeartbeat(roomCode, uid, isHost);
  useHostMigration(roomCode, room, uid);
  useReconnectHandlers(roomCode, uid);

  const [handleToggleReady, readyPending] = useAsyncAction(async () => {
    if (!roomCode || !uid || !me) return;
    await setReady(roomCode, uid, !me.ready);
  });

  const [handleLeave, leavePending] = useAsyncAction(async () => {
    if (!roomCode || !uid) return;
    await leaveRoom(roomCode, uid);
    clearActiveRoom();
    unsubscribeFromRoom();
    setScreen('home');
  });

  function handleKick(targetUid: string) {
    if (!roomCode) return;
    kickPlayer(roomCode, targetUid).catch(() => {
      showToast('Could not remove player.', 'error');
    });
  }

  const [handleStartMatch, startPending] = useAsyncAction(async () => {
    if (!roomCode || !uid) return;
    try {
      await startMatch(roomCode, uid);
      // Screen transition to 'match' happens for all players via the
      // room.status subscription watched in App.tsx.
    } catch (err) {
      if (err instanceof MatchStartError) {
        showToast(err.message, 'error');
      } else {
        showToast('Could not start the match. Please try again.', 'error');
      }
    }
  });

  if (loading || !room) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 safe-area-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-signal" />
        <p className="text-sm text-white/50">Loading room…</p>
      </div>
    );
  }

  if (!me || !uid) {
    // Two distinct cases:
    // 1. Room genuinely doesn't exist (deleted/expired) — `room` is null.
    // 2. Room exists, but our uid isn't a player in it. This can happen
    //    if local auth persistence was cleared (e.g. private browsing,
    //    or the user cleared site data) and a fresh anonymous identity
    //    was issued — we can't "preserve identity" in that case, but we
    //    can offer to rejoin the same room as a new player.
    const roomStillExists = room !== null;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center safe-area-screen">
        <p className="text-sm text-white/60">
          {roomStillExists
            ? "This room no longer recognizes your device. You can rejoin as a new player."
            : "This room is no longer available — it may have ended or expired."}
        </p>
        <div className="flex w-full max-w-xs flex-col gap-3">
          {roomStillExists && room && (
            <Button
              onClick={() => {
                unsubscribeFromRoom();
                clearActiveRoom();
                useUIStore.getState().setPrefillJoinCode(room.code);
                setScreen('join_room');
              }}
            >
              Rejoin Room {room.code}
            </Button>
          )}
          <button
            onClick={() => {
              unsubscribeFromRoom();
              clearActiveRoom();
              setScreen('home');
            }}
            className="tap-target rounded-xl2 border border-white/10 py-4 font-display text-sm font-medium text-white/70 active:scale-95"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const players = Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt);
  const slotsOpen = room.settings.maxPlayers - players.length;
  const hasBots = players.some((p) => p.isBot);
  const validation = validateStart(room);

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        title="Lobby"
        onBack={handleLeave}
        right={
          isHost ? (
            <button
              onClick={() => setShowSettings(true)}
              className="tap-target -mr-2 flex items-center justify-center rounded-full text-xl text-white/70 active:scale-90"
              aria-label="Room settings"
            >
              ⚙️
            </button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-y-auto px-4 pb-4 no-scrollbar">
        <RoomCodeCard code={room.code} />

        {/* My character — tap to edit */}
        <button
          onClick={() => setShowCustomization(true)}
          className="mt-3 flex w-full items-center gap-3 rounded-xl2 bg-ink-800 px-3 py-2.5 text-left active:scale-[0.99]"
        >
          <Avatar avatarId={me.avatarId} colorId={me.colorId} size={44} />
          <div className="flex-1">
            <p className="font-display text-sm font-semibold text-white">{me.displayName}</p>
            <p className="text-xs text-white/40">Tap to edit your look</p>
          </div>
          <span className="text-white/30">✏️</span>
        </button>

        {/* Quick settings summary */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <SummaryStat label="Players" value={`${players.length}/${room.settings.maxPlayers}`} />
          <SummaryStat label="Saboteurs" value={`${room.settings.saboteurCount}`} />
          <SummaryStat label="Locations" value={`${room.settings.nodeCount}`} />
        </div>

        {/* Player list */}
        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-white/40">
          Players ({players.length}/{room.settings.maxPlayers})
        </p>
        <div className="flex flex-col gap-2">
          {players.map((p) => (
            <PlayerListItem
              key={p.uid}
              player={p}
              isMe={p.uid === uid}
              isHostView={isHost}
              onKick={() => handleKick(p.uid)}
            />
          ))}
        </div>

        {/* Host: bot controls */}
        {isHost && (
          <div className="mt-4">
            <BotControls
              roomCode={room.code}
              botDifficulty={room.settings.botDifficulty}
              hasBots={hasBots}
              slotsOpen={slotsOpen}
            />
          </div>
        )}

        {/* Start validation messages */}
        {isHost && !validation.canStart && (
          <div className="mt-4 rounded-xl2 border border-warn/20 bg-warn/5 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-warn">
              Not ready to start
            </p>
            <ul className="flex flex-col gap-1 text-xs text-white/60">
              {validation.reasons.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="flex gap-3 px-4 pb-4">
        {!me.isBot && (
          <button
            onClick={handleToggleReady}
            disabled={readyPending}
            className={`tap-target flex-1 rounded-xl2 py-4 font-display text-sm font-semibold transition active:scale-95 disabled:opacity-60 ${
              me.ready ? 'bg-ink-700 text-white' : 'bg-signal text-ink-950'
            }`}
          >
            {me.ready ? 'Not Ready' : "I'm Ready"}
          </button>
        )}
        {isHost && (
          <Button
            onClick={handleStartMatch}
            pending={startPending}
            disabled={!validation.canStart}
            className="flex-1"
          >
            Start Match
          </Button>
        )}
      </div>

      {leavePending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-signal" />
        </div>
      )}

      {showCustomization && me && (
        <CustomizationSheet
          roomCode={room.code}
          uid={uid}
          player={me}
          onClose={() => setShowCustomization(false)}
        />
      )}

      {showSettings && (
        <SettingsSheet
          roomCode={room.code}
          settings={room.settings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl2 bg-ink-800 px-2 py-2 text-center">
      <p className="font-display text-base font-bold text-white">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}
