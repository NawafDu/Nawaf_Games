import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { returnToLobby } from '@/lib/roomService';

/**
 * Shown when `game.status === 'ended'`. Displays which team won, a full
 * role reveal for every player (the post-game reveal is always shown
 * regardless of `settings.revealRoleOnElimination`, which only governs
 * mid-match ejection reveals), and a "Return to Lobby" button.
 *
 * Only the host (room host, or current game host if migration occurred)
 * sees "Return to Lobby" — tapping it calls `returnToLobby`, which flips
 * `rooms/{code}.status` back to 'lobby' for everyone. Non-host players
 * see a "Waiting for host..." message and are moved to the lobby
 * automatically once `room.status` changes (handled by App.tsx's
 * screen-routing effect).
 */
export function PostGameScreen() {
  const uid = useAuthStore((s) => s.uid);
  const { room, roomCode } = useRoomStore();
  const { game, unsubscribeFromGame } = useGameStore();
  const showToast = useUIStore((s) => s.showToast);

  const [handleReturnToLobby, returnPending] = useAsyncAction(async () => {
    if (!roomCode || !game) return;
    try {
      await returnToLobby(roomCode, game.hostUid);
      unsubscribeFromGame();
    } catch {
      showToast('Could not return to lobby. Please try again.', 'error');
    }
  });

  if (!game || !room || !uid) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 safe-area-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-signal" />
      </div>
    );
  }

  const isHost = uid === game.hostUid;
  const winningTeam = game.winningTeam;

  const players = Object.values(game.players)
    .map((p) => ({ ...p, roomPlayer: room.players[p.uid] }))
    .filter((p) => !!p.roomPlayer)
    .sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return a.role.localeCompare(b.role);
    });

  return (
    <div className="flex h-full flex-col safe-area-screen bg-ink-950">
      <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center text-center gap-6">
        <div>
          <p className="text-sm text-white/50 uppercase tracking-widest mb-2">Match Over</p>
          <p
            className={[
              'font-display text-3xl',
              winningTeam === 'saboteurs' ? 'text-alert' : 'text-signal',
            ].join(' ')}
          >
            {winningTeam === 'saboteurs' ? 'Saboteurs Win' : 'Citizens Win'}
          </p>
          <p className="text-sm text-white/50 mt-2 max-w-xs">
            {winningTeam === 'saboteurs'
              ? 'The Saboteurs reduced the crew until they could no longer be stopped.'
              : 'The crew completed their tasks or rooted out every Saboteur.'}
          </p>
        </div>

        <div className="w-full max-w-sm space-y-2">
          {players.map((player) => (
            <div
              key={player.uid}
              className={[
                'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                player.alive ? 'border-ink-700 bg-ink-900' : 'border-ink-800 bg-ink-900/50 opacity-60',
              ].join(' ')}
            >
              <Avatar avatarId={player.roomPlayer.avatarId} colorId={player.roomPlayer.colorId} size={36} />
              <div className="flex-1 text-left">
                <p className="text-sm text-white/90">{player.roomPlayer.displayName}</p>
                <p className="text-xs text-white/40">
                  {player.alive ? 'Survived' : player.eliminatedBy === 'kill' ? 'Eliminated' : 'Ejected'}
                </p>
              </div>
              <span
                className={[
                  'text-xs font-medium px-2 py-1 rounded-full',
                  player.role === 'saboteur' ? 'bg-alert/10 text-alert' : 'bg-signal/10 text-signal',
                ].join(' ')}
              >
                {player.role === 'saboteur' ? 'Saboteur' : 'Citizen'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        {isHost ? (
          <Button onClick={handleReturnToLobby} pending={returnPending} className="w-full">
            Return to Lobby
          </Button>
        ) : (
          <p className="text-center text-sm text-white/40 py-4">Waiting for the host to return to the lobby…</p>
        )}
      </div>
    </div>
  );
}
