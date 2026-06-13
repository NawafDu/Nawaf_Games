import { nodesWithinRadius } from '@/lib/mapGenerator';
import { VISIBILITY_RADIUS } from '@/types';
import type { EventLogEntry, GameState, PlayerRole } from '@/types';

/**
 * Returns the set of event log entries visible to a player at `nodeId`
 * with the given role, based on the room's visibility settings.
 *
 * - Each event has its own `visibilityRadius` (how far it can be seen
 *   from, set when the event was logged — e.g. a kill might be visible
 *   only adjacent, while "player entered/left" events might be visible
 *   at radius 1 under medium visibility).
 * - The viewer's effective radius is min(their role's configured
 *   visibility radius, the event's own visibilityRadius) — both must
 *   allow visibility.
 * - "Visibility radius 99" (used for system events like game_started)
 *   means "always visible to everyone" regardless of location.
 */
export function getVisibleEvents(
  game: GameState,
  viewerUid: string,
  viewerRole: PlayerRole
): EventLogEntry[] {
  const viewer = game.players[viewerUid];
  if (!viewer) return [];

  const settingKey = viewerRole === 'saboteur' ? 'saboteurVisibility' : 'citizenVisibility';
  const viewerRadius = VISIBILITY_RADIUS[game.settings.visibility[settingKey]];

  const visibleNodesByRadius = new Map<number, Set<string>>();
  function nodesForRadius(radius: number): Set<string> {
    const capped = Math.min(radius, viewerRadius);
    if (!visibleNodesByRadius.has(capped)) {
      visibleNodesByRadius.set(capped, nodesWithinRadius(game.map, viewer.movement.currentNodeId, capped));
    }
    return visibleNodesByRadius.get(capped)!;
  }

  return Object.values(game.eventLog).filter((event) => {
    if (event.visibilityRadius >= 99) return true;
    if (!event.nodeId) return false;
    const visibleNodes = nodesForRadius(event.visibilityRadius);
    return visibleNodes.has(event.nodeId);
  });
}

/**
 * Returns the set of player UIDs currently at the same node as
 * `viewerUid` (excluding the viewer themself), among players who are
 * still alive.
 */
export function getPlayersAtSameNode(game: GameState, viewerUid: string): string[] {
  const viewer = game.players[viewerUid];
  if (!viewer) return [];

  return Object.values(game.players)
    .filter(
      (p) =>
        p.uid !== viewerUid &&
        p.alive &&
        p.movement.currentNodeId === viewer.movement.currentNodeId
    )
    .map((p) => p.uid);
}

/**
 * A node is "isolated" (eligible for an elimination) if exactly two
 * living players — the saboteur and one target — are present, with no
 * other living players at that node.
 */
export function canKillAt(game: GameState, saboteurUid: string, targetUid: string): boolean {
  const saboteur = game.players[saboteurUid];
  const target = game.players[targetUid];
  if (!saboteur || !target) return false;
  if (!saboteur.alive || !target.alive) return false;
  if (saboteur.movement.currentNodeId !== target.movement.currentNodeId) return false;

  const occupants = Object.values(game.players).filter(
    (p) => p.alive && p.movement.currentNodeId === saboteur.movement.currentNodeId
  );

  return occupants.length === 2;
}
