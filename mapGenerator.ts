import type { MapLayout, MapNode } from '@/types';

// -----------------------------------------------------------------------
// Node name pools — original names for the node-based environment.
// A random subset is selected each round so layouts feel varied.
// -----------------------------------------------------------------------
const NODE_NAME_POOL = [
  'Reactor Bay',
  'Cargo Hold',
  'Med Bay',
  'Greenhouse',
  'Observation Deck',
  'Server Room',
  'Cafeteria',
  'Workshop',
  'Airlock',
  'Control Room',
  'Storage',
  'Engine Room',
  'Quarters',
  'Lab',
  'Comms Tower',
  'Docking Bay',
];

/**
 * Generates a random, connected, roughly-balanced map layout with the
 * given number of nodes (6-12). "Balanced" here means:
 * - Every node has between 2 and 4 neighbors (no isolated dead-ends with
 *   only 1 connection, and no single super-hub connected to everything).
 * - The graph is fully connected (every node reachable from every other).
 *
 * Approach: build a random spanning structure first (guarantees
 * connectivity), then add extra edges until each node has at least 2
 * connections, capping at 4 per node.
 */
export function generateMapLayout(nodeCount: number): MapLayout {
  const count = Math.max(6, Math.min(12, nodeCount));
  const names = shuffle(NODE_NAME_POOL).slice(0, count);
  const ids = names.map((_, i) => `n${i}`);

  const adjacency: Record<string, Set<string>> = {};
  ids.forEach((id) => (adjacency[id] = new Set()));

  // Step 1: random spanning tree via randomized Prim's-style growth.
  const connected = [ids[0]];
  const remaining = ids.slice(1);
  while (remaining.length > 0) {
    const from = connected[Math.floor(Math.random() * connected.length)];
    const toIndex = Math.floor(Math.random() * remaining.length);
    const to = remaining[toIndex];
    adjacency[from].add(to);
    adjacency[to].add(from);
    connected.push(to);
    remaining.splice(toIndex, 1);
  }

  // Step 2: add extra random edges so every node has >= 2 neighbors,
  // without exceeding 4 neighbors per node.
  let safetyCounter = 0;
  while (safetyCounter < 500) {
    safetyCounter++;
    const underconnected = ids.filter((id) => adjacency[id].size < 2);
    if (underconnected.length === 0) break;

    const a = underconnected[Math.floor(Math.random() * underconnected.length)];
    const candidates = ids.filter(
      (id) => id !== a && !adjacency[a].has(id) && adjacency[id].size < 4
    );
    if (candidates.length === 0) {
      // Allow temporarily exceeding 4 for `a`'s partner if truly stuck;
      // rare for nodeCount in [6,12].
      const fallback = ids.filter((id) => id !== a && !adjacency[a].has(id));
      if (fallback.length === 0) continue;
      const b = fallback[Math.floor(Math.random() * fallback.length)];
      adjacency[a].add(b);
      adjacency[b].add(a);
      continue;
    }
    const b = candidates[Math.floor(Math.random() * candidates.length)];
    adjacency[a].add(b);
    adjacency[b].add(a);
  }

  // Step 3: assign layout positions on a circle for simple, readable
  // rendering (exact pixel placement is handled responsively client-side;
  // these are normalized 0-1 hints).
  const positions = circularLayout(count);

  const nodes: Record<string, MapNode> = {};
  ids.forEach((id, i) => {
    nodes[id] = {
      id,
      name: names[i],
      neighbors: Array.from(adjacency[id]),
      x: positions[i].x,
      y: positions[i].y,
    };
  });

  const spawnNodeId = ids[Math.floor(Math.random() * ids.length)];

  return { nodes, spawnNodeId };
}

function circularLayout(count: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const center = 0.5;
  const radius = 0.38;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    positions.push({
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    });
  }
  return positions;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Returns the set of node IDs within `radius` hops of `nodeId`,
 * including the node itself. Used for visibility/witness calculations.
 */
export function nodesWithinRadius(
  layout: MapLayout,
  nodeId: string,
  radius: number
): Set<string> {
  const visited = new Set<string>([nodeId]);
  let frontier = [nodeId];
  for (let r = 0; r < radius; r++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = layout.nodes[id];
      if (!node) continue;
      for (const neighbor of node.neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return visited;
}
