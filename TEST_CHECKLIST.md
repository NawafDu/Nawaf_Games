# Test Checklist

This checklist grows with each phase. Phase 1 items focus on
infrastructure — there's no gameplay to test yet.

## Phase 1 — Infrastructure

- [ ] `npm install` completes with no errors
- [ ] `npm run dev` starts and the Home screen renders
- [ ] Browser console shows no Firebase config errors (after `.env.local`
      is set up per `docs/SETUP.md`)
- [ ] Anonymous auth succeeds (no auth errors in console; `useAuthStore`
      `uid` becomes non-null)
- [ ] `firebase deploy --only database` succeeds with `database.rules.json`
- [ ] On iPhone Safari (or responsive mode at 390×844): layout fills
      screen, no horizontal scroll, safe-area padding visible on
      notch/Dynamic Island devices
- [ ] Disabling network (airplane mode / devtools offline) shows the
      "Reconnecting…" banner; re-enabling clears it
- [ ] Throwing a test error inside a component shows the ErrorBoundary
      recovery screen, not a blank page

## Phase 2 — Lobby (to be expanded)

- [ ] Create room generates a unique 6-char code
- [ ] Join room with valid/invalid codes
- [ ] Duplicate display names get auto-suffixed (`Name#NN`)
- [ ] Ready toggle syncs across clients in real time
- [ ] Host controls (kick, settings, bot fill) restricted to host
- [ ] Host migration when host disconnects
- [ ] Room settings validation (saboteur count vs. player count ranges)
- [ ] Reload the page mid-lobby — player auto-rejoins same room, same
      identity, same name/avatar
- [ ] Fully close and reopen Safari (not just background) — player still
      auto-rejoins with preserved identity
- [ ] Toggle airplane mode for 30s+ — "Reconnecting…" banner shows, then
      clears; player's `connected` status returns to true for others
- [ ] Clear site data, then reopen a saved room link/code — app offers
      "rejoin as new player" rather than getting stuck

## Phase 3 — Gameplay

- [ ] Starting a match (host, "Start Match") generates a map (6-12 nodes,
      connected, 2-4 neighbors each), assigns roles per
      `saboteurRange()`, and gives every player a personal task list per
      `settings.taskCounts`
- [ ] Map layout is connected and within node-degree bounds for all
      node counts 6–12 (re-test across several round starts, since the
      layout is randomized each round)
- [ ] Role reveal screen shows the correct role and dismisses after ~3.5s
      or on tap
- [ ] Movement: tapping a reachable (neighboring) node moves the player;
      tapping a non-neighbor does nothing; movement cooldown matches the
      configured `movementSpeed` (Very Slow=6s / Slow=4s / Normal=2.5s /
      Fast=1s) and is shown as a countdown on the player's node
- [ ] Movement is blocked while a meeting is active
- [ ] Task panel shows a "Start" button only for tasks at the player's
      current node; all 9 minigames launch correctly via
      MinigameLauncher and call `completeTask` on success:
  - [ ] Tap Rhythm (3 hits in the target zone)
  - [ ] Wire Match (all 4 wires connected)
  - [ ] Gauge Hold (hold needle in zone for the full duration)
  - [ ] Memory Pairs (all 6 pairs found)
  - [ ] Sequence Recall (5-step sequence repeated correctly)
  - [ ] Logic Dials (all 3 dials match target)
  - [ ] Circuit Repair (70% of grid repaired)
  - [ ] Cargo Sort (all 9 crates sorted to correct bays)
  - [ ] Progress Calibration (meter filled to 100% despite decay)
- [ ] Closing a minigame without finishing leaves the task incomplete and
      re-launchable later
- [ ] Saboteur "Eliminate" button appears only when isolated with exactly
      one other living player at the same node, respects
      `killCooldownSec`, and is hidden/disabled otherwise
- [ ] Eliminating a player: victim's `alive` becomes false, a body is
      added to `unreportedBodies`, and a `kill` event is logged
- [ ] "Report Body" appears only when an unreported body is at the
      player's current node; reporting starts a `body_report` meeting
      and clears the body
- [ ] "Emergency Meeting" respects `meetingCooldownSec` (tracked via the
      most recent `meeting_called`/`body_found` event) and starts an
      `emergency` meeting
- [ ] Meeting flow: discussion (chat works, countdown to voting) ->
      voting (tap-avatar or Skip, countdown to results) -> results
      (tally + ejection reveal, or "no one was ejected" on tie/skip) ->
      auto-closes after ~6s and movement/actions resume
- [ ] Anonymous voting: a player cannot see another player's vote choice
      in the UI; tie in vote tally results in no ejection
- [ ] `revealRoleOnElimination` setting controls whether the ejected
      player's role is shown in the results phase
- [ ] Witness/visibility radius behaves per `citizenVisibility` /
      `saboteurVisibility` settings — at 'high', other players' avatars
      are shown on all nodes; at 'low'/'medium', only the viewer's own
      node shows occupants
- [ ] Win conditions trigger correctly:
  - [ ] All living citizens complete all tasks -> Citizens win
  - [ ] All saboteurs eliminated/ejected -> Citizens win
  - [ ] Living saboteurs >= living citizens (with >=1 saboteur alive) ->
        Saboteurs win
- [ ] Post-game screen shows the correct winning team, a full role
      reveal for every player, and survived/eliminated/ejected status
- [ ] Host taps "Return to Lobby": `rooms/{code}.status` -> 'lobby' for
      all clients, all human players' `ready` resets to false, bots stay
      ready, and a new match can be started (new map/roles/tasks)
- [ ] If the match-phase host disconnects (>15s heartbeat stall),
      `useMatchHostMigration` reassigns `games/{code}.hostUid` to the
      oldest connected human player, and the game loop continues
      uninterrupted (no visible pause beyond the migration window)

## Phase 3.5 — Multiplayer QA & Stress Testing

This phase exists to catch concurrency bugs, race conditions, and
scale issues **before** investing further effort in bot intelligence
(Phase 4) — smarter bots make timing-sensitive bugs harder to isolate,
since bot actions add more concurrent writes to the same paths.

Run every numbered scenario below at **4, 6, 8, and 12 players**
(mix of humans + bots as noted).

**Solo testing is now supported**: a QA devtools panel (dev builds only)
provides multi-tab identity switching, simulation tools, and debug
views that make most of this matrix testable by a single person —
see `docs/QA_DEVTOOLS.md` for the full per-scenario breakdown of what's
solo-testable vs. what still needs real human testers/devices. For
human-tester sessions, use multiple real devices or separate browser
profiles — two tabs sharing one `localStorage`/auth session will collide
on `uid` and produce misleading results (unless multi-tab identity mode,
described in `docs/QA_DEVTOOLS.md`, is enabled per-tab).

### Known issues to verify/fix during this phase

Code review ahead of stress testing surfaced four issues. Verify each
against real multiplayer testing (some may be more or less severe than
they appear from code alone), then fix before Phase 4:

1. **[BUG] Reconnect handlers don't run during a match.**
   `useReconnectHandlers` (re-registers `onDisconnect`, restores
   `rooms/{code}/players/{uid}.connected = true` on reconnect) is only
   mounted in `LobbyScreen`. It is NOT mounted in `MatchScreen`. A
   player who disconnects and reconnects mid-match will have
   `rooms/{code}/players/{uid}.connected` stuck at `false` until they
   return to the lobby — and `useMatchHostMigration`'s `pickNextHost`
   filters on this field, so a reconnected player may be skipped as a
   migration candidate (or, if they WERE picked as host before
   disconnecting, a second disconnect won't re-arm `onDisconnect` for
   their new socket).
   **Fix**: mount `useReconnectHandlers(roomCode, uid)` in
   `MatchScreen` as well (or hoist it to `App.tsx` so it's always
   active while in a room, independent of screen).

2. **[BUG] `games/{code}/players/{uid}/connected` is dead state.**
   Set once to `true` at match start (`matchService.ts`) and never
   updated again. Nothing reads it during the match. Low severity on
   its own, but combined with #1, there's no live "this player is
   offline" signal anywhere in `MatchScreen`. Decide whether to wire
   this up (mirroring the room-side field) or remove it from
   `GameState` for clarity.

3. **[FIXED] Race condition: simultaneous `reportBody` /
   `callEmergencyMeeting` from different players.**
   Previously, both functions did a one-shot `get()` to confirm
   `game.meeting === null`, then a multi-path `update()` that wrote a
   brand-new `meeting` object with no transaction guarding the
   `meeting` field itself — last-write-wins could silently discard one
   caller's meeting while their body/event was still removed/logged.

   **Fix implemented**: both functions now call a shared
   `claimMeeting()` helper (`src/lib/gameActions/meetings.ts`) that
   performs a `runTransaction` scoped to `games/{code}/meeting`,
   transitioning it from `null`/`phase: 'closed'` to the new meeting
   object. Firebase serializes concurrent transactions on the same
   path: the first to commit wins; the second is replayed against the
   now-non-null `meeting` and its updater aborts (`result.committed
   === false`). The losing caller gets `GameActionError('meeting_active',
   'Someone else just started a meeting...')` and — critically —
   `unreportedBodies`/`eventLog` are only written AFTER the claim
   succeeds, so a losing `reportBody` call never removes the body it
   was about to report.

   **Verify with the following** (all at 8+ players):
   - [ ] Two players, each standing over a different unreported body,
         tap "Report Body" within the same ~100-200ms window
     - [ ] Exactly ONE meeting is created (visible to all players)
     - [ ] The winner's body is removed from `unreportedBodies` and
           reflected in the meeting (`reportedBody`)
     - [ ] The loser sees a toast (not a silent failure, not a crash)
           and their body remains in `unreportedBodies` — confirm by
           having them tap "Report Body" again once the first meeting
           ends, and it succeeds normally
   - [ ] One player taps "Report Body" while another simultaneously
         taps "Emergency Meeting" — same checks as above (only one
         meeting wins; the loser's action has zero side effects)
   - [ ] Three or more simultaneous attempts (mix of body reports and
         emergency meetings) — exactly one meeting created, all losers
         get clean errors, no body is ever permanently lost (every
         unreported body remains reportable in a later meeting if its
         report attempt lost the race)
   - [ ] Repeat the above with the *host's* report/meeting call as one
         of the simultaneous attempts — confirm host involvement
         doesn't change the outcome (transaction is path-scoped, not
         host-privileged)

4. **[BUG] Event log grows unbounded.**
   The original design called for trimming `eventLog` to the most
   recent 200 entries (mentioned in earlier docs/comments), but this
   trimming was lost when movement/elimination/task/meeting actions
   were rewritten to targeted multi-path `update()`s — no code path
   trims `eventLog` anymore. Every move, task completion, kill, body
   report, and meeting call adds a permanent entry to
   `/games/{code}/eventLog`, which every client subscribes to in full
   via `onValue`, and which the host's game loop reads in full every
   ~1s tick.
   **Impact**: in a long match with 8-12 players moving every 1-2.5s,
   this grows quickly — increasing payload size for all clients and
   the per-tick read/write cost for the host. Likely manifests as
   gradually increasing latency/lag in late-game rather than a hard
   crash.
   **Fix**: re-add trimming (e.g. host's game-loop tick prunes
   `eventLog` to the most recent N entries each tick, or each action
   prunes its own write).
   **Test specifically**: run a 12-player match for 10+ minutes
   (multiple rounds via return-to-lobby) and watch for increasing
   action latency (time from tap to UI update) over the session.

5. **[EDGE CASE] Kill vs. move race — body recorded at stale node.**
   If a saboteur eliminates victim V at node N in the same instant V's
   own `moveToNode` transaction (already in flight, read before the
   kill landed) completes a move to node M: V ends up with
   `alive: false` but `movement.currentNodeId === M`, while
   `unreportedBodies[V].nodeId === N` (snapshotted at kill time).
   `MapView` filters on `alive`, so V won't render as an occupant
   anywhere — likely harmless, but verify:
   - The body is reportable at node N (where `unreportedBodies[V]`
     says it is), not at M.
   - No UI shows V "alive-looking" at M.
   **Test specifically**: at 6+ players, have a saboteur eliminate a
   target at the exact moment that target taps a movement tile.

### Test matrix

For each player count (4 / 6 / 8 / 12), run through:

#### A. Reconnect during match
- [ ] A human player force-closes the app (or toggles airplane mode)
      mid-match, then reconnects within ~10s
  - [ ] Their avatar/position is preserved on reconnect
  - [ ] Their task progress/completions from before the disconnect are
        intact
  - [ ] `rooms/{code}/players/{uid}.connected` returns to `true` after
        reconnect (verify against bug #1 — likely fails currently)
  - [ ] If they reconnect during a meeting, they see the correct
        meeting phase (discussion/voting/results), not a stale state
- [ ] A human player stays disconnected >15s during active gameplay
      (no meeting) — confirm this does NOT trigger any incorrect state
      (only host-disconnect should trigger migration; non-host
      disconnects should just leave the player "stuck" until they
      return)

#### B. Host disconnect during meeting
- [ ] The current match host force-closes the app while a meeting is
      in `discussion` phase
  - [ ] After >15s, `useMatchHostMigration` reassigns
        `games/{code}.hostUid` to another connected human
  - [ ] The new host's `useGameLoop` picks up and the meeting
        transitions discussion -> voting -> results on schedule (not
        stuck in discussion forever)
- [ ] Repeat with host disconnecting during `voting` phase — confirm
      votes already cast are preserved and tallied correctly by the new
      host
- [ ] Repeat with host disconnecting during `results` phase — confirm
      the meeting still auto-closes after `RESULTS_DISPLAY_MS` under
      the new host
- [ ] At 12 players with 3 saboteurs, repeat the above — confirm
      migration picks a human (never a bot) even when most players are
      bots

#### C. Simultaneous votes
- [ ] All living players cast their votes within the same ~1s window
      (use a "go" countdown to coordinate testers)
  - [ ] All votes are recorded (`meeting/votes/{uid}` per player, no
        lost writes)
  - [ ] Tally in the results phase matches what was cast
  - [ ] Ties (engineer a tie by splitting votes evenly) correctly
        result in "no one was ejected"
- [ ] Two players vote for each other at the exact same instant —
      confirm no deadlock/error, both votes recorded normally
      (independent paths, should be trivially fine — sanity check only)

#### D. Simultaneous task completion
- [ ] Multiple players finish minigames and call `completeTask` within
      the same second
  - [ ] Each player's own task list updates correctly (no
        cross-contamination between players' `tasks` arrays)
  - [ ] If this is the action that satisfies the "all citizens done"
        win condition, the game ends exactly once (not a double
        "ended" transition or duplicate post-game navigation)
- [ ] Same player rapidly double-taps "Start" then completes the same
      task twice in quick succession (simulating a network retry) —
      confirm idempotent (no duplicate completion events, task stays
      `completed`)

#### E. Kill/report race conditions
- [ ] Run the bug #3 verification checklist above (now fixed via
      `claimMeeting` transaction) — confirm exactly one meeting wins,
      losers get clean toasts, and no body is ever lost
- [ ] A saboteur eliminates a target the instant that target attempts
      to move (bug #5 edge case) — verify body location and that the
      victim doesn't render as alive anywhere
- [ ] At 10-12 players with 2-3 saboteurs, two different saboteurs
      (each isolated with a different victim at different nodes)
      eliminate simultaneously — confirm both eliminations succeed
      independently (no cross-talk on `lastKillAt`, `unreportedBodies`,
      or `eventLog`)
- [ ] A player taps "Report Body" at the exact moment the host's game
      loop processes a bot eliminating someone at a DIFFERENT node —
      confirm no interference (independent paths)

#### F. Return-to-lobby flow
- [ ] Host taps "Return to Lobby" while a non-host player still has a
      minigame open (`MinigameLauncher` active) — confirm that
      player's screen cleanly returns to the lobby (no stuck overlay,
      no error)
- [ ] Host taps "Return to Lobby" while the meeting overlay is showing
      `results` phase for some players (e.g. host returns immediately
      after the win condition fires, before `RESULTS_DISPLAY_MS`
      elapses) — confirm no stuck meeting state in the next round
- [ ] After returning to lobby, start a NEW match — confirm:
  - [ ] New map layout generated (different from previous round)
  - [ ] Roles/tasks freshly assigned (not leftover from previous round)
  - [ ] All human players' `ready` is `false`; bots remain `ready: true`
  - [ ] `roundNumber` incremented
  - [ ] If host migration occurred mid-previous-match, the NEW host
        (post-migration) is correctly reflected as `rooms/{code}.hostUid`
        going into the new lobby
- [ ] Non-host player force-quits during the post-game screen (before
      host returns to lobby) — confirm they can rejoin and land on the
      lobby correctly once the host does return

#### G. Bot-filled matches
- [ ] Practice mode (1 human + bots) at each player count — confirm:
  - [ ] Match reaches a win condition without human input (human can
        idle/observe only)
  - [ ] No bot ever becomes host; if the human (sole real host)
        backgrounds their tab/app for an extended period, document what
        happens to the game loop (expected: it stalls until they
        return — no Cloud Functions to take over)
- [ ] Mixed human/bot matches at each player count, with bots
      outnumbering humans (e.g. 2 humans + 10 bots at the 12-player
      tier) — confirm:
  - [ ] Bot saboteurs occasionally get reported/ejected (citizen bots'
        body-reporting and voting actually contribute to outcomes)
  - [ ] Bot movement doesn't visibly "teleport" or desync from the map
        on human clients
  - [ ] `eventLog` growth (bug #4) is most visible here, since bots act
        every tick — use this configuration for the 10+ minute
        longevity test



A baseline deterministic bot driver (`src/lib/gameActions/bots.ts`) is
already wired into the game loop so matches with bots are fully
playable. This phase focuses on tuning and expanding that behavior.

- [ ] Citizen bots move toward nodes with pending tasks and complete them
      over time
- [ ] Citizen bots report bodies they encounter
- [ ] Saboteur bots eliminate isolated targets when their kill cooldown
      is ready, and report bodies only ~50% of the time (to sometimes
      look innocent)
- [ ] Bot voting uses only in-game signals (recent `player_moved` events
      near a reported body's location) — never omniscient — and
      `botDifficulty` (easy/medium/hard) changes how often bots act on
      that signal vs. voting randomly/skipping
- [ ] A room filled entirely with bots (Practice mode) reaches a win
      condition without human input

## Phase 5 — Polish (to be expanded)

- [ ] Full reconnect test: kill network mid-match, rejoin, state recovers
- [ ] Debug mode toggle works and doesn't appear in production builds
      unintentionally
- [ ] Performance: local action → UI update under ~150ms on LAN
- [ ] Full playthrough with 4 players (min) and 12 players (max)
