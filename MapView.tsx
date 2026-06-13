import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/common/Avatar';
import { MOVEMENT_COOLDOWN_MS } from '@/types';
import type { GameState, RoomPlayer } from '@/types';

interface MapViewProps {
  game: GameState;
  myUid: string;
  roomPlayers: Record<string, RoomPlayer>;
  onMove: (targetNodeId: string) => void;
  moving: boolean;
}

/**
 * Renders the station map as a set of tappable node cards arranged per
 * the layout's x/y hints. Shows which players (avatars) are at each
 * node, highlights the current player's node and its reachable
 * neighbors, and surfaces the movement cooldown as a countdown on the
 * player's own node.
 *
 * The map LAYOUT (nodes/connections) is always fully visible — players
 * always know the station's layout. Visibility settings instead govern
 * which *other players' positions* are shown as avatars on nodes other
 * than the viewer's own: under 'high' visibility, everyone's position is
 * shown; under 'low'/'medium', only the viewer's own node shows
 * occupants (matching the "you only know who's near you" feel — finer-
 * grained event-based witnessing is handled separately via
 * src/lib/visibility.ts).
 */
export default function MapView({ game, myUid, roomPlayers, onMove, moving }: MapViewProps) {
  const [now, setNow] = useState(Date.now());

  // Re-render periodically so the movement cooldown countdown updates.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const me = game.players[myUid];
  const myRole = me?.role;
  const myNodeId = me?.movement.currentNodeId;
  const currentNode = myNodeId ? game.map.nodes[myNodeId] : null;
  const reachable = new Set(currentNode?.neighbors ?? []);

  const cooldownMs = MOVEMENT_COOLDOWN_MS[game.settings.movementSpeed];
  const cooldownRemainingMs = me ? Math.max(0, cooldownMs - (now - me.movement.lastMovedAt)) : 0;
  const onCooldown = cooldownRemainingMs > 0;

  const visibilityKey = myRole === 'saboteur' ? 'saboteurVisibility' : 'citizenVisibility';
  const visibilityLevel = game.settings.visibility[visibilityKey];
  const showAllPlayers = visibilityLevel === 'high';

  const nodes = Object.values(game.map.nodes);

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return (
    <div className="relative w-full h-full min-h-[420px] bg-ink-950 rounded-2xl overflow-hidden border border-ink-800">
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {nodes.flatMap((node) =>
          node.neighbors
            .filter((neighborId) => neighborId > node.id) // draw each edge once
            .map((neighborId) => {
              const neighbor = game.map.nodes[neighborId];
              if (!neighbor) return null;
              const x1 = ((node.x - minX) / spanX) * 100;
              const y1 = ((node.y - minY) / spanY) * 100;
              const x2 = ((neighbor.x - minX) / spanX) * 100;
              const y2 = ((neighbor.y - minY) / spanY) * 100;
              return (
                <line
                  key={`${node.id}-${neighborId}`}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="rgb(51 65 85)"
                  strokeWidth={2}
                />
              );
            })
        )}
      </svg>

      {nodes.map((node) => {
        const x = ((node.x - minX) / spanX) * 100;
        const y = ((node.y - minY) / spanY) * 100;

        const isMine = node.id === myNodeId;
        const isReachable = reachable.has(node.id);
        const canTapToMove = isReachable && !onCooldown && !moving;

        const occupantsHere = Object.values(game.players).filter(
          (p) => p.alive && p.movement.currentNodeId === node.id
        );
        const visibleOccupants =
          isMine || showAllPlayers ? occupantsHere : occupantsHere.filter((p) => p.uid === myUid);

        return (
          <motion.button
            key={node.id}
            type="button"
            disabled={!canTapToMove}
            onClick={() => canTapToMove && onMove(node.id)}
            whileTap={canTapToMove ? { scale: 0.95 } : undefined}
            className={[
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 px-3 py-2 min-w-[88px] text-center transition-colors',
              isMine
                ? 'border-signal bg-signal/10'
                : isReachable
                  ? 'border-signal-dim/40 bg-ink-900 active:bg-ink-800'
                  : 'border-ink-700 bg-ink-900/60',
              !canTapToMove && !isMine ? 'opacity-60' : '',
            ].join(' ')}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className="text-xs font-medium text-white/90 truncate">{node.name}</div>

            {visibleOccupants.length > 0 && (
              <div className="flex justify-center gap-1 mt-1 flex-wrap">
                {visibleOccupants.map((occupant) => {
                  const rp = roomPlayers[occupant.uid];
                  return (
                    <Avatar
                      key={occupant.uid}
                      avatarId={rp?.avatarId ?? 'orb'}
                      colorId={rp?.colorId ?? 'teal'}
                      size={20}
                    />
                  );
                })}
              </div>
            )}

            {isMine && onCooldown && (
              <div className="text-[10px] text-white/40 mt-1 tabular-nums">
                {(cooldownRemainingMs / 1000).toFixed(1)}s
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
