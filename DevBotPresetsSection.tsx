import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { updateRoomSettings, fillWithBots, removeAllBots } from '@/lib/roomService';
import { saboteurRange } from '@/types';

/**
 * Bots tab: quick presets for the bot-stress-testing scenarios in
 * docs/TEST_CHECKLIST.md ("3 humans + bots", "1 human + bots", "bots
 * only"). Only usable from the LOBBY (room.status === 'lobby') by the
 * room host — `rooms/{code}/settings` writes are host-only per the
 * security rules, same as the normal Settings sheet.
 *
 * Workflow: open the desired number of human tabs (see Identity tab for
 * multi-tab setup) and join them all to the room FIRST, then tap a
 * preset here — it sets `maxPlayers` to cover both the connected humans
 * and the bot count, then fills the remaining slots with bots.
 */
export default function DevBotPresetsSection() {
  const uid = useAuthStore((s) => s.uid);
  const { room, roomCode } = useRoomStore();
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (!room || !roomCode || !uid) {
    return <p className="text-white/40">Join a room first.</p>;
  }

  const isHost = room.hostUid === uid;
  const humanCount = Object.values(room.players).filter((p) => !p.isBot).length;
  const botCount = Object.values(room.players).filter((p) => p.isBot).length;
  const inLobby = room.status === 'lobby';

  const applyPreset = async (label: string, totalPlayers: number) => {
    setPending(label);
    setStatus(null);
    try {
      const range = saboteurRange(totalPlayers);
      await updateRoomSettings(roomCode, {
        ...room.settings,
        maxPlayers: totalPlayers,
        saboteurCount: Math.min(Math.max(room.settings.saboteurCount, range.min), range.max),
      });
      await fillWithBots(roomCode, room.settings.botDifficulty);
      setStatus(`${label}: room set to ${totalPlayers} players and filled with bots.`);
    } catch (err) {
      setStatus(`${label}: ${err instanceof Error ? err.message : 'failed'}`);
    } finally {
      setPending(null);
    }
  };

  const handleRemoveBots = async () => {
    setPending('remove');
    setStatus(null);
    try {
      await removeAllBots(roomCode);
      setStatus('Bots removed.');
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-1.5">
        <h3 className="font-display text-warn">Current Room</h3>
        <Row label="Status" value={room.status} />
        <Row label="Humans joined" value={String(humanCount)} />
        <Row label="Bots" value={String(botCount)} />
        <Row label="Max players" value={String(room.settings.maxPlayers)} />
        <Row label="You are host" value={isHost ? 'yes' : 'no'} />
      </section>

      {!inLobby && (
        <p className="text-warn">
          Presets only apply in the lobby. Return to the lobby before
          applying a preset.
        </p>
      )}
      {!isHost && <p className="text-warn">Only the room host can change settings/fill bots from this tab.</p>}

      <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-2">
        <h3 className="font-display text-warn">Presets</h3>
        <p className="text-white/50 leading-relaxed">
          Join the target number of human tabs to this room FIRST (see
          Identity tab), then tap a preset. Each preset sets{' '}
          <code className="text-white/80">maxPlayers</code> and fills
          remaining slots with bots at the configured difficulty.
        </p>

        <PresetButton
          label="3 humans + bots (max 8)"
          pending={pending}
          disabled={!isHost || !inLobby}
          onClick={() => applyPreset('3 humans + bots', 8)}
        />
        <PresetButton
          label="1 human + bots (max 8)"
          pending={pending}
          disabled={!isHost || !inLobby}
          onClick={() => applyPreset('1 human + bots', 8)}
        />
        <PresetButton
          label="1 human + bots (max 12, max bots)"
          pending={pending}
          disabled={!isHost || !inLobby}
          onClick={() => applyPreset('1 human + bots (12)', 12)}
        />
        <PresetButton
          label="Bots only (max 8) — Practice mode recommended instead"
          pending={pending}
          disabled={!isHost || !inLobby}
          onClick={() => applyPreset('Bots only', 8)}
        />

        <p className="text-white/30">
          "Bots only" still requires at least one human (this tab) to
          remain in the room as host — a room with zero humans has no
          client to run the game loop. For a true solo bots-only
          playthrough, use Practice mode from the Home screen instead,
          which is built for exactly this.
        </p>

        <PresetButton label="Remove all bots" pending={pending} disabled={!isHost} onClick={handleRemoveBots} />
      </section>

      {status && <p className="text-signal">{status}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span className="text-white/90 text-right truncate">{value}</span>
    </div>
  );
}

function PresetButton({
  label,
  onClick,
  pending,
  disabled,
}: {
  label: string;
  onClick: () => void;
  pending: string | null;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending !== null}
      className="w-full rounded-lg bg-ink-800 border border-ink-700 text-white/90 px-3 py-2 text-left active:bg-ink-700 disabled:opacity-40"
    >
      {pending !== null ? 'Working…' : label}
    </button>
  );
}
