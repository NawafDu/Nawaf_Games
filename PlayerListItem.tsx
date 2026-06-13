import { Avatar } from '@/components/common/Avatar';
import type { RoomPlayer } from '@/types';

interface PlayerListItemProps {
  player: RoomPlayer;
  isMe: boolean;
  isHostView: boolean;
  onKick?: () => void;
}

export function PlayerListItem({ player, isMe, isHostView, onKick }: PlayerListItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl2 bg-ink-800 px-3 py-2.5">
      <Avatar avatarId={player.avatarId} colorId={player.colorId} size={40} />

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <p className="truncate font-display text-sm font-semibold text-white">
            {player.displayName}
          </p>
          {player.isHost && (
            <span className="rounded-full bg-warn/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-warn">
              Host
            </span>
          )}
          {isMe && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/50">
              You
            </span>
          )}
        </div>
        {!player.connected && (
          <p className="text-[11px] text-white/40">Reconnecting…</p>
        )}
        {player.isBot && (
          <p className="text-[11px] text-white/40 capitalize">
            Bot · {player.botDifficulty}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {player.ready ? (
          <span className="rounded-full bg-signal/20 px-2.5 py-1 text-xs font-semibold text-signal">
            Ready
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-white/40">
            Waiting
          </span>
        )}

        {isHostView && !player.isHost && onKick && (
          <button
            onClick={onKick}
            className="tap-target -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-base text-white/30 active:scale-90 active:text-alert"
            aria-label={`Remove ${player.displayName}`}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
