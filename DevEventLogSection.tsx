import { useGameStore } from '@/store/gameStore';
import { useAuthStore } from '@/store/authStore';
import { useDevToolsStore, type EventLogFilter } from '@/lib/devtools/devToolsStore';
import type { EventLogEntry } from '@/types';

const FILTERS: { id: EventLogFilter; label: string; types: EventLogEntry['type'][] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'movement', label: 'Movement', types: ['player_moved'] },
  { id: 'tasks', label: 'Tasks', types: ['task_completed'] },
  { id: 'kills', label: 'Kills', types: ['kill'] },
  { id: 'reports', label: 'Reports', types: ['body_found'] },
  { id: 'meetings', label: 'Meetings', types: ['meeting_called', 'game_started', 'game_ended'] },
  { id: 'votes', label: 'Votes', types: ['vote_cast'] },
  { id: 'host_migration', label: 'Host Migration', types: ['host_migration'] },
];

function shortUid(uid: string, myUid: string | null): string {
  const short = uid.length > 10 ? `${uid.slice(0, 8)}…` : uid;
  return uid === myUid ? `${short} (you)` : short;
}

/**
 * Events tab: chronological view of `games/{code}/eventLog`, filterable
 * by category. Note on the "Votes" filter: individual vote casts
 * (`castVote`/`forceVote`) write directly to `meeting/votes/{uid}`, NOT
 * to `eventLog` — there is currently no `vote_cast` eventLog entry ever
 * produced anywhere in the codebase. This filter is included per the
 * spec and will simply show "no events" until/unless vote casts are
 * additionally logged to eventLog. Live vote counts during an active
 * meeting are available in the Debug tab instead (reading
 * `meeting.votes` directly).
 */
export default function DevEventLogSection() {
  const game = useGameStore((s) => s.game);
  const uid = useAuthStore((s) => s.uid);
  const filter = useDevToolsStore((s) => s.eventLogFilter);
  const setFilter = useDevToolsStore((s) => s.setEventLogFilter);

  if (!game) {
    return <p className="text-white/40">No active game.</p>;
  }

  const allEvents = Object.values(game.eventLog ?? {}).sort((a, b) => b.timestamp - a.timestamp);

  const activeFilter = FILTERS.find((f) => f.id === filter) ?? FILTERS[0];
  const events =
    activeFilter.id === 'all' ? allEvents : allEvents.filter((e) => activeFilter.types.includes(e.type));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              'rounded-full px-2.5 py-1 text-[11px] font-medium border',
              filter === f.id ? 'bg-warn text-ink-950 border-warn' : 'bg-ink-800 text-white/60 border-ink-700',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === 'votes' && (
        <p className="text-white/30">
          Vote casts aren't written to eventLog (they live in
          meeting.votes). This filter will stay empty — see the Debug tab
          for live vote counts.
        </p>
      )}

      <p className="text-white/40">
        {events.length} event{events.length !== 1 ? 's' : ''}
        {activeFilter.id !== 'all' ? ` (of ${allEvents.length} total)` : ''}
      </p>

      <div className="space-y-1">
        {events.map((event) => (
          <div key={event.id} className="bg-ink-900 border border-ink-700 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-white/90 font-medium">{event.type}</span>
              <span className="text-white/30 text-[11px]">{new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-white/50 text-[11px] mt-0.5 flex flex-wrap gap-x-3">
              <span>actor: {shortUid(event.actorUid, uid)}</span>
              {event.targetUid && <span>target: {shortUid(event.targetUid, uid)}</span>}
              {event.nodeId && <span>node: {event.nodeId}</span>}
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-white/30">No events match this filter.</p>}
      </div>
    </div>
  );
}
