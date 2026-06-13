# Firebase Realtime Database Schema

This document describes the data layout used by Shadow Circuit. It must
stay in sync with `database.rules.json` and `src/types/index.ts`.

## Top-level trees

```
/rooms/{roomCode}
/games/{roomCode}
/chat/{roomCode}/{meetingId}/{messageId}
/presence/{roomCode}/{uid}
```

A room and its active game share the same `{roomCode}` key — this keeps
joins by room code simple while still letting us apply very different
read/write rules to lobby metadata vs. live match state.

---

## `/rooms/{roomCode}` — Lobby & room metadata

```ts
{
  code: string;            // == roomCode, redundant for convenience
  createdAt: number;        // server timestamp
  updatedAt: number;
  hostUid: string;
  status: 'lobby' | 'starting' | 'match' | 'ended';
  roundNumber: number;      // incremented each time a match starts
  activeGameId: string | null; // == roomCode while status === 'match'
  settings: RoomSettings;
  players: {
    [uid: string]: {
      uid: string;
      displayName: string;  // "Nawaf#42" if collision
      baseName: string;
      avatarId: string;
      colorId: string;
      isHost: boolean;
      isBot: boolean;
      botDifficulty?: 'easy' | 'medium' | 'hard';
      ready: boolean;
      connected: boolean;
      joinedAt: number;
      lastSeen: number;
    }
  }
}
```

**Lifecycle:**
- Created when a player taps "Create Room". `status = 'lobby'`.
- `status = 'starting'` briefly while the host generates the match
  (role assignment, map layout) — prevents joins mid-transition.
- `status = 'match'` while `/games/{roomCode}` is active. No new players
  may join (enforced client-side at the join screen + by checking status
  before writing a new player record).
- When the match resolves, `/games/{roomCode}.status` becomes `'ended'`
  (a separate field from `rooms/{roomCode}.status` — see the `/games`
  section below) and clients show the post-game screen. When the host
  taps "Return to Lobby" (`returnToLobby` in `roomService.ts`),
  `rooms/{roomCode}.status` goes directly from `'match'` back to
  `'lobby'` (with `roundNumber` having already been incremented at the
  *start* of that match, and `activeGameId` cleared) so a new round can
  begin without re-creating the room. The `'ended'` value of
  `RoomStatus` is part of the type for completeness but is not produced
  by this flow — `rooms/{roomCode}.status` only ever cycles through
  `'lobby' -> 'starting' -> 'match' -> 'lobby' -> ...`.
- A Cloud Function or scheduled cleanup (documented in SETUP.md) removes
  rooms where `updatedAt` is older than 60 minutes. Since this project
  uses RTDB without Cloud Functions per the chosen stack, Phase 1 ships a
  **client-side best-effort cleanup**: any client that reads a room older
  than 60 minutes with no connected players will delete it. This is a
  soft guarantee — see SETUP.md for optional Cloud Function upgrade.

---

## `/games/{roomCode}` — Live match state

```ts
{
  id: string;
  roomCode: string;
  startedAt: number;
  status: 'active' | 'ended';
  hostUid: string;            // host-authoritative game loop driver
  hostHeartbeatAt: number;    // bumped periodically; used for host migration
  settings: RoomSettings;     // snapshot of settings at match start
  map: {
    nodes: { [nodeId: string]: MapNode };
    spawnNodeId: string;
  };
  players: {
    [uid: string]: {
      uid: string;
      role: 'citizen' | 'saboteur'; // mirrored, non-secret
      alive: boolean;
      movement: { currentNodeId: string; lastMovedAt: number };
      tasks: PlayerTask[];
      lastKillAt?: number;
      connected: boolean;
      eliminatedBy?: 'kill' | 'vote' | null;
    }
  };
  meeting: MeetingState | null;
  eventLog: { [eventId: string]: EventLogEntry };
  unreportedBodies: {
    [uid: string]: { uid: string; nodeId: string; killedAt: number }
  };
  winningTeam: 'citizens' | 'saboteurs' | null;
  endedAt?: number;
}

// MeetingState (nested at games/{roomCode}/meeting)
{
  id: string;
  type: 'body_report' | 'emergency';
  calledBy: string;          // uid
  reportedBody?: string;     // uid of victim, if type === 'body_report'
  phase: 'discussion' | 'voting' | 'results' | 'closed';
  startedAt: number;
  discussionEndsAt: number;
  votingEndsAt: number;
  votes: { [voterUid: string]: string }; // targetUid or 'skip'
  result?: {
    ejectedUid: string | null;
    tally: Record<string, number>;
    wasTie: boolean;
  };
  resultsAt?: number; // set when phase -> 'results'; the host's game
                       // loop uses this to time the brief results-display
                       // window (RESULTS_DISPLAY_MS, ~6s) before setting
                       // `meeting: null` to resume play.
}
```

`secrets/{uid}` is a SIBLING of the object above (i.e.
`/games/{roomCode}/secrets/{uid}`), not a nested field within it — it's
written as a separate path in the same multi-path operation at match
start so its independent read-restriction rule (`auth.uid === uid`)
applies cleanly:

```ts
// /games/{roomCode}/secrets/{uid}
{ role: 'citizen' | 'saboteur' } // read-restricted to owner
```

### Why `role` is mirrored *and* secret

`players/{uid}/role` exists for convenience (e.g. post-game reveal,
host-side validation) but is **not** how clients determine their own
role securely — a saboteur's client could otherwise just read every
player's role from the shared `players` map.

Instead:
- `secrets/{uid}/role` is the source of truth for "what is MY role" and is
  read-restricted via security rules to `auth.uid === uid`.
- `players/{uid}/role` is written by the host at game start (same value)
  and again at game end (for the reveal screen, controlled by
  `revealRoleOnElimination` / end-game reveal settings).

### Event log & visibility

Every meaningful action (movement, task completion, kill, body found,
meeting called, vote cast) is appended to `eventLog` with a
`visibilityRadius`. Clients compute, for their current node, the set of
nodes within their configured visibility radius
(`src/lib/mapGenerator.ts#nodesWithinRadius`) and filter the event log to
only those events — this drives "witnessing" a kill or seeing someone
enter/exit a nearby room.

---

## `/chat/{roomCode}/{meetingId}/{messageId}`

Chat is scoped per-meeting (`meetingId` from `MeetingState.id`) so old
discussion history doesn't carry over and clutter new meetings. Cleared
implicitly each round since `meetingId`s are freshly generated.

```ts
{
  id: string;
  senderUid: string;
  senderName: string;
  text: string;       // max 280 chars, enforced by rules
  timestamp: number;
}
```

---

## `/presence/{roomCode}/{uid}`

```ts
{
  online: boolean;
  lastChanged: number;
}
```

Populated via `onDisconnect()` handlers (Phase 2) to drive reconnect UI
and host migration triggers.

---

## Writes during a match: targeted paths, not whole-object transactions

Security rules for `/games/{roomCode}` grant write access on a
**per-field basis** (e.g. a player may write only their own
`players/{uid}/movement`; a saboteur may write any `players/{uid}/alive`
when eliminating; the host may write `meeting/result`, `hostHeartbeatAt`,
etc.). A `runTransaction` or `update()` call on the *whole* `/games/{roomCode}`
object would be validated against every field it touches — including
fields the caller isn't permitted to write — so all Phase 3+ gameplay
actions instead use **targeted multi-path `update()`** calls and
**transactions scoped to a single leaf path**. This keeps each write
validated against the one rule that's supposed to govern it.

| Operation | Mechanism | Path(s) | Why |
|---|---|---|---|
| Movement | One-shot `get()` to validate (status/meeting/neighbor), then `runTransaction` scoped to one path | `games/{code}/players/{uid}/movement` | Enforce the movement cooldown atomically; only this leaf is racy. |
| Elimination | One-shot `get()` to validate (role/proximity/isolation), `runTransaction` on `lastKillAt`, then multi-path `update()` | `games/{code}/players/{saboteurUid}/lastKillAt`, `players/{victimUid}/{alive,eliminatedBy}`, `unreportedBodies/{victimUid}`, `eventLog/{eventId}` | Cooldown is the only racy field; the rest is a single atomic multi-path write once the cooldown is claimed. |
| Task completion | `runTransaction` scoped to one path | `games/{code}/players/{uid}/tasks` | The player owns their whole `tasks` array; transaction finds-and-updates the matching task by id. |
| Reporting a body / calling a meeting | One-shot `get()` to validate, then multi-path `update()` | `games/{code}/meeting` (whole new object), `unreportedBodies/{victimUid}` (body_report only), `eventLog/{eventId}` | Starting a meeting is permitted by the rules only when the new `meeting.phase === 'discussion'`. |
| Casting a vote | One-shot `get()` to check phase, then `runTransaction` scoped to one path | `games/{code}/meeting/votes/{uid}` | Each voter writes only their own vote entry. |
| Host game-loop tick | One-shot `get()`, then a single multi-path `update()` | `games/{code}/meeting/*`, `games/{code}/players/*` (bot-driven and vote-ejection fields), `games/{code}/{status,winningTeam,endedAt,hostHeartbeatAt}` | All paths written here are host-permitted; see `src/lib/gameActions/gameLoop.ts`. |
| Joining a room | `runTransaction` on the whole room object | `rooms/{code}` | Prevent two players claiming the same display-name suffix simultaneously, and enforce `maxPlayers`. The `rooms/{code}` root rules are permissive enough (any current player may write the whole object) that whole-object transactions remain safe here, unlike `/games/{roomCode}`. |
| Host migration (match phase) | `runTransaction` scoped to one path | `games/{code}/hostUid` | First-writer-wins; any room player may migrate hostUid to a valid non-bot player (see rules). |

### Bots

Bots have no client of their own. `src/lib/gameActions/bots.ts`'s
`computeBotUpdates(game)` runs against a read-only working copy of the
game state (from the host's `get()`) and returns a flat
`{ path: value }` map. The host's game-loop tick merges this into its
single `update()` call. Security rules grant the host write access to
any `players/{uid}/*` field where `uid` begins with `bot_` (see
`database.rules.json`), scoped precisely so this can't be used to bypass
per-field restrictions for human players.

---

## Host-authoritative game loop

Because this stack has no Cloud Functions, certain logic that would
normally run server-side runs on the **current host's client**, via
`runGameLoopTick` (`src/lib/gameActions/gameLoop.ts`), ticking every ~1s
(`useGameLoop`):

- Advancing meeting phases (discussion → voting → results → closed) based
  on elapsed time vs. `discussionEndsAt`/`votingEndsAt`/`resultsAt`.
- Tallying votes and resolving ejections when voting ends.
- Driving all bot behavior (movement, tasks, kills, body reports, voting)
  via `computeBotUpdates`.
- Checking win conditions after meeting resolution and bot actions.
- Updating `games/{roomCode}/hostHeartbeatAt` every tick (~1s).

Map generation and role/task assignment happen once, at match start, via
`startMatch` (`src/lib/matchService.ts`) — run by whoever is the **room**
host at that moment (from the Lobby screen).

If other clients observe `games/{roomCode}/hostHeartbeatAt` stalled for
>15s, they initiate **match-phase host migration**
(`useMatchHostMigration`): the connected, non-bot player with the lowest
`joinedAt` claims `games/{roomCode}/hostUid` via a transaction
(first-writer-wins). This is independent of `rooms/{roomCode}/hostUid`
(lobby-phase host), though `returnToLobby` syncs them back together when
the match ends.
