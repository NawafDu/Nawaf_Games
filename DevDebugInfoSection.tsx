import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore } from '@/store/roomStore';
import { useGameStore } from '@/store/gameStore';
import { RESULTS_DISPLAY_MS } from '@/lib/gameActions/gameLoop';
import type { GameState } from '@/types';

function ageLabel(timestampMs: number | undefined, now: number): string {
  if (!timestampMs) return '—';
  const ageMs = now - timestampMs;
  if (ageMs < 0) return '0s';
  return `${(ageMs / 1000).toFixed(1)}s ago`;
}

function countdownLabel(endsAtMs: number | undefined, now: number): string {
  if (!endsAtMs) return '—';
  const remaining = endsAtMs - now;
  if (remaining <= 0) return 'elapsed';
  return `${(remaining / 1000).toFixed(1)}s left`;
}

/** Shortens a uid for display, marking "(you)" if it matches the current tab. */
function shortUid(targetUid: string, myUid: string | null): string {
  const short = targetUid.length > 10 ? `${targetUid.slice(0, 8)}…` : targetUid;
  return targetUid === myUid ? `${short} (you)` : short;
}

/**
 * Debug tab: at-a-glance live state, refreshed every 250ms for timers.
 * Pulls from the same `useRoomStore`/`useGameStore` subscriptions the
 * rest of the app uses — no separate reads, so this always reflects
 * exactly what this tab's client sees (useful for spotting desync
 * between tabs).
 */
export default function DevDebugInfoSection() {
  const uid = useAuthStore((s) => s.uid);
  const { room } = useRoomStore();
  const { game } = useGameStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!room) {
    return <p className="text-white/40">Not currently in a room.</p>;
  }

  const players = Object.values(room.players);
  const humans = players.filter((p) => !p.isBot);
  const bots = players.filter((p) => p.isBot);
  const connectedHumans = humans.filter((p) => p.connected);

  const meeting = game?.meeting ?? null;

  return (
    <div className="space-y-4">
      <Section title="Room">
        <Row label="Code" value={room.code} mono />
        <Row label="Status" value={room.status} />
        <Row label="Round" value={String(room.roundNumber)} />
        <Row label="Room host (lobby)" value={shortUid(room.hostUid, uid)} mono />
        <Row label="Active game id" value={room.activeGameId ?? '—'} mono />
      </Section>

      <Section title="Players">
        <Row label="Total" value={String(players.length)} />
        <Row label="Humans (connected / total)" value={`${connectedHumans.length} / ${humans.length}`} />
        <Row label="Bots" value={String(bots.length)} />
        <div className="mt-1 space-y-1">
          {players.map((p) => (
            <div key={p.uid} className="flex items-center justify-between gap-2 bg-ink-800 rounded px-2 py-1">
              <span className="truncate">
                {p.displayName}
                {p.uid === uid && <span className="text-warn"> (this tab)</span>}
                {p.isBot && <span className="text-white/30"> [bot]</span>}
                {p.isHost && <span className="text-signal"> [host]</span>}
              </span>
              <span className={p.connected ? 'text-signal' : 'text-alert'}>
                {p.connected ? 'online' : 'offline'}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {!game && (
        <Section title="Match">
          <p className="text-white/40">No active game (room is in the lobby).</p>
        </Section>
      )}

      {game && (
        <>
          <Section title="Match">
            <Row label="Status" value={game.status} />
            <Row label="Game host" value={shortUid(game.hostUid, uid)} mono />
            <Row
              label="Host heartbeat age"
              value={ageLabel(game.hostHeartbeatAt, now)}
              warn={!!game.hostHeartbeatAt && now - game.hostHeartbeatAt > 15000}
            />
            <Row label="Winning team" value={game.winningTeam ?? '—'} />
            <Row label="Map nodes" value={String(Object.keys(game.map.nodes).length)} />
            <Row label="Unreported bodies" value={String(Object.keys(game.unreportedBodies ?? {}).length)} />
            <Row label="Event log size" value={String(Object.keys(game.eventLog ?? {}).length)} />
          </Section>

          <Section title="Meeting">
            {!meeting || meeting.phase === 'closed' ? (
              <p className="text-white/40">No active meeting.</p>
            ) : (
              <>
                <Row label="Type" value={meeting.type} />
                <Row label="Phase" value={meeting.phase} />
                <Row label="Called by" value={shortUid(meeting.calledBy, uid)} mono />
                {meeting.reportedBody && (
                  <Row label="Reported body" value={shortUid(meeting.reportedBody, uid)} mono />
                )}
                {meeting.phase === 'discussion' && (
                  <Row label="Discussion timer" value={countdownLabel(meeting.discussionEndsAt, now)} />
                )}
                {meeting.phase === 'voting' && (
                  <Row label="Voting timer" value={countdownLabel(meeting.votingEndsAt, now)} />
                )}
                {meeting.phase === 'results' && meeting.resultsAt && (
                  <Row label="Results timer" value={countdownLabel(meeting.resultsAt + RESULTS_DISPLAY_MS, now)} />
                )}
                <VoteCounts game={game} uid={uid} />
              </>
            )}
          </Section>

          <Section title="Reconnect State (this tab)">
            <Row label="My connected flag" value={String(room.players[uid ?? '']?.connected ?? '—')} />
            <Row label="My last seen" value={ageLabel(room.players[uid ?? '']?.lastSeen, now)} />
          </Section>
        </>
      )}
    </div>
  );
}

function VoteCounts({ game, uid }: { game: GameState; uid: string | null }) {
  const meeting = game.meeting;
  if (!meeting || (meeting.phase !== 'voting' && meeting.phase !== 'results')) return null;

  const votes = meeting.votes ?? {};
  const livingPlayers = Object.values(game.players).filter((p) => p.alive);
  const voted = Object.keys(votes).length;

  const tally: Record<string, number> = {};
  for (const choice of Object.values(votes)) {
    tally[choice] = (tally[choice] ?? 0) + 1;
  }

  return (
    <div className="mt-1 space-y-1">
      <Row label="Votes cast" value={`${voted} / ${livingPlayers.length}`} />
      {Object.entries(tally).map(([target, count]) => (
        <div key={target} className="flex items-center justify-between text-white/60 pl-2">
          <span className="truncate">{target === 'skip' ? 'Skip' : shortUid(target, uid)}</span>
          <span>{count}</span>
        </div>
      ))}
      <p className="text-white/30 pt-1">
        DEV ONLY: vote choices are shown here for debugging. The normal UI
        never reveals individual votes (anonymous voting).
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-ink-900 border border-ink-700 rounded-xl p-3 space-y-1.5">
      <h3 className="font-display text-warn">{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, value, mono, warn }: { label: string; value: string; mono?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-white/40">{label}</span>
      <span
        className={['text-right truncate', mono ? 'font-mono' : '', warn ? 'text-alert' : 'text-white/90'].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
