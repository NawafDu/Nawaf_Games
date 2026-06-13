import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useGameStore } from '@/store/gameStore';
import {
  forceDisconnect,
  forceReconnect,
  forceHostDisconnect,
  forceStaleHeartbeat,
  forceMeeting,
  forceBodyReport,
  forceTaskCompletion,
  forceVote,
  forceGameEnd,
  SimulationError,
} from '@/lib/devtools/simulationActions';

/**
 * Simulate tab: one-tap triggers for the QA scenarios in
 * docs/TEST_CHECKLIST.md. Every action operates on THIS TAB's own
 * player (or requires this tab to be host, for host-only actions) — see
 * simulationActions.ts for the full rationale. Results/errors show in a
 * small status line at the top.
 */
export default function DevSimulationSection() {
  const uid = useAuthStore((s) => s.uid);
  const { room, roomCode } = useRoomStore();
  const { game } = useGameStore();
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [voteTarget, setVoteTarget] = useState<string>('skip');

  if (!roomCode || !uid) {
    return <p className="text-white/40">Join a room first.</p>;
  }

  const isHost = !!(game && game.hostUid === uid);
  const me = room?.players[uid];
  const offline = me?.connected === false;

  const run = async (label: string, action: () => Promise<void>) => {
    setPending(label);
    setStatus(null);
    try {
      await action();
      setStatus({ text: `${label}: done`, tone: 'ok' });
    } catch (err) {
      const message = err instanceof SimulationError || err instanceof Error ? err.message : 'Unknown error';
      setStatus({ text: `${label}: ${message}`, tone: 'error' });
    } finally {
      setPending(null);
    }
  };

  const livingOthers = game ? Object.values(game.players).filter((p) => p.alive && p.uid !== uid) : [];

  return (
    <div className="space-y-4">
      {status && (
        <div
          className={[
            'rounded-lg px-3 py-2',
            status.tone === 'ok' ? 'bg-signal/10 text-signal' : 'bg-alert/10 text-alert',
          ].join(' ')}
        >
          {status.text}
        </div>
      )}

      <Section title="Connection (this tab)">
        <ActionButton
          label="Force Disconnect"
          pending={pending}
          disabled={offline}
          onClick={() => run('Force Disconnect', () => forceDisconnect(roomCode, uid))}
        />
        <ActionButton
          label="Force Reconnect"
          pending={pending}
          disabled={!offline}
          onClick={() => run('Force Reconnect', () => forceReconnect(roomCode, uid))}
        />
        {offline && (
          <p className="text-warn">
            This tab is now offline (goOffline). Live updates from other
            tabs are paused for this tab. Tap "Force Reconnect" to resume.
          </p>
        )}
      </Section>

      <Section title="Host">
        <p className="text-white/40">
          {isHost
            ? 'This tab IS the current match host.'
            : 'This tab is NOT host — switch to the host tab for these.'}
        </p>
        <ActionButton
          label="Force Host Disconnect"
          pending={pending}
          disabled={!isHost || offline}
          onClick={() => run('Force Host Disconnect', () => forceHostDisconnect(roomCode, uid, game))}
        />
        <ActionButton
          label="Force Stale Heartbeat (instant migration trigger)"
          pending={pending}
          disabled={!isHost}
          onClick={() => run('Force Stale Heartbeat', () => forceStaleHeartbeat(roomCode, uid, game))}
        />
      </Section>

      <Section title="Meetings & Voting">
        <ActionButton
          label="Force Emergency Meeting"
          pending={pending}
          disabled={!game || game.status !== 'active'}
          onClick={() => run('Force Meeting', () => forceMeeting(roomCode, uid))}
        />
        <ActionButton
          label="Force Body Report (teleport to nearest body)"
          pending={pending}
          disabled={!game}
          onClick={() => run('Force Body Report', () => forceBodyReport(roomCode, uid, game!))}
        />

        {game?.meeting?.phase === 'voting' && (
          <div className="flex items-center gap-2 pt-1">
            <select
              value={voteTarget}
              onChange={(e) => setVoteTarget(e.target.value)}
              className="flex-1 bg-ink-800 border border-ink-700 rounded px-2 py-1.5 text-white"
            >
              <option value="skip">Skip</option>
              {livingOthers.map((p) => (
                <option key={p.uid} value={p.uid}>
                  {p.uid === uid ? 'Myself' : p.uid.slice(0, 8)}
                </option>
              ))}
            </select>
            <ActionButton
              label="Force Vote"
              pending={pending}
              onClick={() => run('Force Vote', () => forceVote(roomCode, uid, voteTarget))}
            />
          </div>
        )}
      </Section>

      <Section title="Tasks">
        <ActionButton
          label="Force Task Completion (teleport to next pending task)"
          pending={pending}
          disabled={!game}
          onClick={() => run('Force Task Completion', () => forceTaskCompletion(roomCode, uid, game!))}
        />
      </Section>

      <Section title="Match Outcome">
        <p className="text-white/40">
          {isHost
            ? 'This tab IS the current match host.'
            : 'This tab is NOT host — switch to the host tab for these.'}
        </p>
        <div className="flex gap-2">
          <ActionButton
            label="Force Citizens Win"
            pending={pending}
            disabled={!isHost}
            onClick={() => run('Force Game End', () => forceGameEnd(roomCode, uid, game, 'citizens'))}
          />
          <ActionButton
            label="Force Saboteurs Win"
            pending={pending}
            disabled={!isHost}
            onClick={() => run('Force Game End', () => forceGameEnd(roomCode, uid, game, 'saboteurs'))}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-2">
      <h3 className="font-display text-warn">{title}</h3>
      {children}
    </section>
  );
}

function ActionButton({
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
      {pending === label ? 'Working…' : label}
    </button>
  );
}
