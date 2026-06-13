// -----------------------------------------------------------------------
// Shadow Circuit — Core Domain Types
// -----------------------------------------------------------------------
// These types mirror the Firebase Realtime Database schema documented in
// docs/FIREBASE_SCHEMA.md. Keep them in sync with database.rules.json.
// -----------------------------------------------------------------------

export type RoomStatus = 'lobby' | 'starting' | 'match' | 'ended';

export type PlayerRole = 'citizen' | 'saboteur';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export type MovementSpeed = 'very_slow' | 'slow' | 'normal' | 'fast';

export const MOVEMENT_COOLDOWN_MS: Record<MovementSpeed, number> = {
  very_slow: 6000,
  slow: 4000,
  normal: 2500,
  fast: 1000,
};

export type VisibilityLevel = 'low' | 'medium' | 'high';

// Maps visibility settings to a node-hop radius used for witness/event
// visibility calculations (see src/lib/mapGenerator.ts#nodesWithinRadius).
export const VISIBILITY_RADIUS: Record<VisibilityLevel, number> = {
  low: 0, // only your own node
  medium: 1, // your node + direct neighbors
  high: 2, // your node + neighbors + their neighbors
};

// Visibility levels affect:
// - event visibility radius (how many node-hops away an event is reported)
// - neighbor-node visibility (whether you see who is in adjacent nodes)
// - player visibility (whether names are shown or just silhouettes/counts)
export interface VisibilityConfig {
  citizenVisibility: VisibilityLevel;
  saboteurVisibility: VisibilityLevel;
}

export type TaskLength = 'short' | 'medium' | 'long';

export interface TaskCounts {
  short: number;
  medium: number;
  long: number;
}

export interface RoomSettings {
  maxPlayers: number; // 4-12
  saboteurCount: number; // host-configurable, validated against player count
  movementSpeed: MovementSpeed;
  taskCounts: TaskCounts;
  killCooldownSec: number; // 10-60, default 25
  meetingCooldownSec: number;
  actionCooldownSec: number;
  visibility: VisibilityConfig;
  anonymousVoting: boolean; // always true per spec, kept configurable for future
  revealRoleOnElimination: boolean;
  discussionDurationSec: number;
  votingDurationSec: number;
  nodeCount: number; // 6-12
  botDifficulty: BotDifficulty;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  maxPlayers: 8,
  saboteurCount: 1,
  movementSpeed: 'normal',
  taskCounts: { short: 2, medium: 1, long: 1 },
  killCooldownSec: 25,
  meetingCooldownSec: 15,
  actionCooldownSec: 1,
  visibility: { citizenVisibility: 'medium', saboteurVisibility: 'medium' },
  anonymousVoting: true,
  revealRoleOnElimination: true,
  discussionDurationSec: 45,
  votingDurationSec: 30,
  nodeCount: 8,
  botDifficulty: 'medium',
};

// Valid saboteur count ranges by player count, per product spec.
export function saboteurRange(playerCount: number): { min: number; max: number } {
  if (playerCount <= 6) return { min: 1, max: 1 };
  if (playerCount <= 9) return { min: 1, max: 2 };
  return { min: 1, max: 3 };
}

export interface RoomPlayer {
  uid: string;
  displayName: string; // includes #suffix if duplicate, e.g. "Nawaf#42"
  baseName: string; // name without suffix
  avatarId: string; // index/id into avatar preset list
  colorId: string; // index/id into color preset list
  isHost: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  ready: boolean;
  connected: boolean;
  joinedAt: number; // server timestamp
  lastSeen: number; // server timestamp, used for stale-connection detection
}

export interface RoomData {
  code: string;
  createdAt: number;
  updatedAt: number;
  hostUid: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: Record<string, RoomPlayer>;
  // Incrementing token; bumped each time a new match starts, used so
  // clients can detect "new round" and reset local UI state.
  roundNumber: number;
  // Set when status transitions to 'match'; clients use this to know
  // which /games/{code} record is the "live" one (defensive against stale reads).
  activeGameId: string | null;
  // Updated periodically (~5s) by the current host's client. Other
  // clients monitor this for staleness (>15s) to trigger host migration.
  hostHeartbeatAt?: number;
}

// -----------------------------------------------------------------------
// Game (Match) State — /games/{roomCode}
// -----------------------------------------------------------------------

export interface MapNode {
  id: string;
  name: string; // generated/randomized display name
  // Adjacency list of node IDs reachable directly from this node.
  neighbors: string[];
  // Layout hint for rendering (grid position, not pixel-precise).
  x: number;
  y: number;
}

export interface MapLayout {
  nodes: Record<string, MapNode>;
  // Node where players initially spawn.
  spawnNodeId: string;
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface PlayerTask {
  id: string;
  minigameId: string; // see src/lib/minigames/registry.ts
  length: TaskLength;
  nodeId: string; // location where this task must be performed
  status: TaskStatus;
  // Progress 0-100, used for "common task progress" style aggregation.
  progress: number;
}

export interface PlayerMovementState {
  currentNodeId: string;
  lastMovedAt: number; // server timestamp; used to enforce movement cooldown
}

export interface PlayerMatchState {
  uid: string;
  role: PlayerRole; // mirrored here for non-secret aggregate use (see secretRole)
  alive: boolean;
  movement: PlayerMovementState;
  tasks: PlayerTask[];
  // Saboteur-only; null/absent for citizens. Server-side rule restricts
  // writes; clients only ever read their own via /games/{code}/secrets/{uid}.
  lastKillAt?: number;
  connected: boolean;
  eliminatedBy?: 'kill' | 'vote' | null;
}

// Secret role assignment — stored separately so security rules can
// restrict read access to `auth.uid === uid` only.
export interface PlayerSecret {
  role: PlayerRole;
}

export type MeetingType = 'body_report' | 'emergency';

export type MeetingPhase = 'discussion' | 'voting' | 'results' | 'closed';

export interface VoteRecord {
  // Anonymous voting: this map is only readable by the host/system during
  // tallying. Individual voters cannot read other players' choices.
  // targetUid === 'skip' represents a skip vote.
  [voterUid: string]: string;
}

export interface MeetingState {
  id: string;
  type: MeetingType;
  calledBy: string; // uid
  reportedBody?: string; // uid of eliminated player, if body_report
  phase: MeetingPhase;
  startedAt: number;
  discussionEndsAt: number;
  votingEndsAt: number;
  votes: VoteRecord;
  // Populated only after phase === 'results'
  result?: {
    ejectedUid: string | null; // null if tie/skip-majority
    tally: Record<string, number>;
    wasTie: boolean;
  };
  // Server timestamp when phase transitioned to 'results' — used by the
  // host's game loop to time the brief results-display window before
  // automatically closing the meeting (see gameLoop.ts).
  resultsAt?: number;
}

export interface EventLogEntry {
  id: string;
  type:
    | 'kill'
    | 'body_found'
    | 'meeting_called'
    | 'vote_cast'
    | 'player_moved'
    | 'task_completed'
    | 'game_started'
    | 'game_ended'
    | 'host_migration';
  actorUid: string;
  nodeId?: string;
  targetUid?: string;
  timestamp: number;
  // Which node-distance this event is visible from, used for witness logic.
  visibilityRadius: number;
}

export type WinningTeam = 'citizens' | 'saboteurs' | null;

export interface GameState {
  id: string;
  roomCode: string;
  startedAt: number;
  status: 'active' | 'ended';
  settings: RoomSettings;
  map: MapLayout;
  players: Record<string, PlayerMatchState>;
  meeting: MeetingState | null;
  eventLog: Record<string, EventLogEntry>;
  // Bodies that have been killed but not yet reported.
  unreportedBodies: Record<string, { uid: string; nodeId: string; killedAt: number }>;
  winningTeam: WinningTeam;
  endedAt?: number;
  // Host-authoritative "tick" — bumped periodically by the host client to
  // drive timers (kill cooldown expiry checks, meeting timers, etc.)
  // and to provide a heartbeat that other clients can use to detect host loss.
  hostHeartbeatAt: number;
  hostUid: string;
}

// -----------------------------------------------------------------------
// Chat — /chat/{roomCode}/{meetingId}
// -----------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  text: string;
  timestamp: number;
}

// -----------------------------------------------------------------------
// Presence — /presence/{roomCode}/{uid}
// -----------------------------------------------------------------------

export interface PresenceRecord {
  online: boolean;
  lastChanged: number;
}
