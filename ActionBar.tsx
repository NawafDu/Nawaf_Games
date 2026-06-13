import { useEffect, useState } from 'react';
import { Button } from '@/components/common/Button';
import { getPlayersAtSameNode, canKillAt } from '@/lib/visibility';
import { eliminatePlayer } from '@/lib/gameActions/eliminate';
import { GameActionError } from '@/lib/gameActions/movement';
import { reportBody, callEmergencyMeeting } from '@/lib/gameActions/meetings';
import { withDevLatency } from '@/lib/devtools/devToolsStore';
import type { GameState, RoomPlayer } from '@/types';

interface ActionBarProps {
  roomCode: string;
  game: GameState;
  myUid: string;
  roomPlayers: Record<string, RoomPlayer>;
  onError: (message: string) => void;
}

/**
 * Bottom action bar shown during active gameplay (no meeting). Surfaces
 * the actions available to the current player based on their role and
 * situation:
 * - Saboteurs see an "Eliminate" button when `canKillAt` is true for
 *   exactly one other player at their node, with a cooldown countdown.
 * - Any living player sees "Report Body" if an unreported body is at
 *   their current node (takes priority over the meeting button).
 * - Otherwise, any living player can call an "Emergency Meeting",
 *   subject to the room-wide meeting cooldown (also enforced
 *   server-side; this UI reflects it via the most recent
 *   meeting/body-found event timestamp).
 *
 * Renders nothing if the player is dead or a meeting is in progress.
 */
export default function ActionBar({ roomCode, game, myUid, roomPlayers, onError }: ActionBarProps) {
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState<'kill' | 'report' | 'meeting' | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const me = game.players[myUid];
  if (!me || !me.alive) return null;
  if (game.meeting && game.meeting.phase !== 'closed') return null;

  // --- Eliminate ---
  const others = getPlayersAtSameNode(game, myUid);
  const killTarget = me.role === 'saboteur' && others.length === 1 ? others[0] : null;
  const canKill = killTarget ? canKillAt(game, myUid, killTarget) : false;

  const killCooldownMs = game.settings.killCooldownSec * 1000;
  const killCooldownRemaining = me.lastKillAt ? Math.max(0, killCooldownMs - (now - me.lastKillAt)) : 0;
  const killReady = killCooldownRemaining <= 0;

  const handleEliminate = async () => {
    if (!killTarget || pending) return;
    setPending('kill');
    try {
      await withDevLatency(() => eliminatePlayer(roomCode, myUid, killTarget));
    } catch (err) {
      if (err instanceof GameActionError) onError(err.message);
    } finally {
      setPending(null);
    }
  };

  // --- Report body ---
  const bodyHere = Object.values(game.unreportedBodies ?? {}).find(
    (b) => b.nodeId === me.movement.currentNodeId
  );

  const handleReport = async () => {
    if (pending) return;
    setPending('report');
    try {
      await withDevLatency(() => reportBody(roomCode, myUid));
    } catch (err) {
      if (err instanceof GameActionError) onError(err.message);
    } finally {
      setPending(null);
    }
  };

  // --- Emergency meeting ---
  const lastMeetingEvent = Object.values(game.eventLog ?? {})
    .filter((e) => e.type === 'meeting_called' || e.type === 'body_found')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const meetingCooldownMs = game.settings.meetingCooldownSec * 1000;
  const meetingCooldownRemaining = lastMeetingEvent
    ? Math.max(0, meetingCooldownMs - (now - lastMeetingEvent.timestamp))
    : 0;
  const meetingReady = meetingCooldownRemaining <= 0;

  const handleEmergencyMeeting = async () => {
    if (pending) return;
    setPending('meeting');
    try {
      await withDevLatency(() => callEmergencyMeeting(roomCode, myUid));
    } catch (err) {
      if (err instanceof GameActionError) onError(err.message);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-ink-700 bg-ink-950 flex gap-2">
      {canKill && killTarget && (
        <Button
          variant="danger"
          onClick={handleEliminate}
          pending={pending === 'kill'}
          disabled={!killReady}
          className="flex-1"
        >
          {killReady
            ? `Eliminate ${roomPlayers[killTarget]?.displayName ?? 'Target'}`
            : `Cooldown ${Math.ceil(killCooldownRemaining / 1000)}s`}
        </Button>
      )}

      {bodyHere ? (
        <Button variant="primary" onClick={handleReport} pending={pending === 'report'} className="flex-1">
          Report Body
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={handleEmergencyMeeting}
          pending={pending === 'meeting'}
          disabled={!meetingReady}
          className="flex-1"
        >
          {meetingReady ? 'Emergency Meeting' : `Meeting Cooldown ${Math.ceil(meetingCooldownRemaining / 1000)}s`}
        </Button>
      )}
    </div>
  );
}
