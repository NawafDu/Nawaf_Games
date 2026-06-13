# QA Validation Report — Solo Testing with Devtools

This report maps every Phase 3.5 multiplayer QA scenario (see
`TEST_CHECKLIST.md`) to whether it can now be validated by a **single
tester** using the dev panel + multi-tab identity mode, or whether it
still requires **real human testers** across multiple physical
devices/networks.

Legend:
- Solo — fully testable alone via multi-tab + dev panel
- Solo (partial) — testable alone, but with a documented caveat
- Humans required — needs real separate devices/networks/people

---

## QA Devtools quick reference

Available only in `npm run dev` (dead-code-eliminated from production
builds). Floating "QA" button, bottom-right.

| Tab | Purpose |
|---|---|
| Identity | Enable per-tab identity (multi-tab testing), see current uid/role |
| Debug | Live room/match/meeting status, player connection states, vote counts, heartbeat age |
| Simulate | Force disconnect/reconnect, force host disconnect/stale heartbeat, force meeting/body report/task completion/vote, force game end |
| Bots | Presets for 3-humans+bots / 1-human+bots / bots-only room setup |
| Latency | Inject 100/250/500/1000ms delay into this tab's actions |
| Events | Chronological eventLog viewer with type filters |
| State | Raw JSON of room/game/this-player state |

---

## A. Reconnect during match

| Scenario | Status | Notes |
|---|---|---|
| Player force-closes/reconnects mid-match, position & tasks preserved | Solo | Simulate -> Force Disconnect, then Force Reconnect on any non-host tab. Position/tasks are server-side and unaffected by goOffline/goOnline. |
| `connected` flag correctly returns to true after reconnect | Solo | Debug tab shows the flag live; this is the bug-#1 fix verification. |
| Reconnect during a meeting shows correct phase, not stale | Solo | Force Disconnect during discussion, let other tabs progress to voting, Force Reconnect — confirm the reconnected tab shows `voting`, not `discussion`. |
| Non-host disconnects >15s during active gameplay — no incorrect migration | Solo | Force Disconnect on a non-host tab; Debug on other tabs should show `games/{code}.hostUid` unchanged. |
| Real network conditions (WiFi/cellular handoff, airplane mode, iOS Safari suspension) | Humans required | goOffline/goOnline simulate connection state but not OS-level socket teardown or real-world reconnection latency/packet loss. |

## B. Host disconnect during meeting

| Scenario | Status | Notes |
|---|---|---|
| Host disconnects during discussion -> migration after stall -> meeting still progresses to voting/results under new host | Solo | Simulate -> Force Host Disconnect on host tab during discussion. After ~15s, `games/{code}.hostUid` changes on another tab's Debug view. |
| Host disconnects during voting -> votes preserved & tallied by new host | Solo | Cast votes from 2+ tabs first, then Force Host Disconnect on host. |
| Host disconnects during results -> meeting still auto-closes under new host | Solo | Force Host Disconnect right as `meeting.phase` becomes `results`. |
| Migration always picks a human, never a bot | Solo | Use Bots preset (1 human + bots), then Force Host Disconnect — see note below on the no-eligible-human case. |
| Faster alternative: Force Stale Heartbeat | Solo | Back-dates `hostHeartbeatAt` directly, but the current host's own game loop may overwrite it again before another tab notices (documented in simulationActions.ts). Force Host Disconnect is more reliable. |
| Real-world device crash (not just clean network disconnect) | Humans required (low priority) | goOffline is a clean disconnect; a real crash mid-write is a different failure mode, though Firebase's atomic multi-path update makes partial writes unlikely either way. |

Note on "1 human + bots" + host disconnect: if the sole human is host
and disconnects, `pickNextHost` (non-bot, connected only) has no
candidate — migration simply doesn't happen until that human reconnects
and their own tab resumes the game loop. This is correct for a
no-Cloud-Functions design and is itself solo-testable (confirm nothing
crashes/corrupts while "headless").

## C. Simultaneous votes

| Scenario | Status | Notes |
|---|---|---|
| All living players vote within ~1s; all votes recorded; tally correct | Solo | With N tabs open during voting, use Simulate -> Force Vote on each tab in quick succession; Debug tab shows vote counts live. |
| Engineered tie -> "no one was ejected" | Solo | Split Force Vote choices evenly across candidates. |
| Two players vote for each other simultaneously | Solo | Independent `meeting/votes/{uid}` paths — trivial sanity check. |
| Realistic human reaction-time variance / accidental double-taps | Humans required (low priority) | The write path is identical regardless of input speed; mainly tests UI double-tap guards, already covered by `useAsyncAction`-style pending states. |

## D. Simultaneous task completion

| Scenario | Status | Notes |
|---|---|---|
| Multiple players complete tasks within the same second; no cross-contamination between players' `tasks` arrays | Solo | Force Task Completion on multiple tabs back-to-back; verify via State tab per tab (independent `players/{uid}/tasks` paths). |
| Win condition fires exactly once when the last task completes | Solo | Reduce remaining tasks to one across the room, then complete it — confirm `game.status` -> `ended` exactly once on all tabs simultaneously, no double post-game navigation. |
| Idempotency: same task completed twice in a row | Solo | Force Task Completion twice on an already-completed task — `completeTask`'s transaction no-ops on `status === 'completed'`. |
| Minigame-specific UI race conditions (rapid input causing duplicate `onComplete`) | Solo (partial) | `MinigameLauncher`'s `completedRef` guard needs a manual rapid-tapping pass through each of the 9 minigames — Force Task Completion bypasses the minigames entirely, so this guard isn't exercised by devtools. No humans needed, just one tester playing fast. |

## E. Kill/report race conditions

| Scenario | Status | Notes |
|---|---|---|
| Simultaneous reportBody/callEmergencyMeeting from different players (bug #3, fixed via claimMeeting) | Solo | Need 2+ unreported bodies (let bot/human saboteurs eliminate two victims), then Force Body Report on 2+ tabs back-to-back. Confirm exactly one meeting wins, the loser gets a clean error, and the losing body remains in `unreportedBodies` (State tab). |
| Kill vs. move race (bug #5 edge case) | Solo (partial) | Reproducible by having a saboteur tab eliminate a target the instant the target's tab calls moveToNode — but precise sub-100ms timing between two tabs operated by one person is hard to guarantee deterministically. Best-effort solo; a definitive repro may need scripted clients (out of scope). |
| Two saboteurs (10-12 players) eliminate different isolated victims simultaneously | Solo | 12-player bots preset with 3 saboteurs; verify both eliminations land independently via Events tab. |
| Report Body at the moment the host's loop processes a bot kill elsewhere | Solo | Naturally occurs in bot-filled matches; Events tab timestamps let you spot near-simultaneous events afterward. |

## F. Return-to-lobby flow

| Scenario | Status | Notes |
|---|---|---|
| Host returns to lobby while a non-host has a minigame open | Solo | Open a minigame on tab B, Force Game End on host tab A, host returns to lobby — confirm tab B cleanly returns (MatchScreen/MinigameLauncher unmount together). |
| Host returns to lobby during meeting results phase before RESULTS_DISPLAY_MS elapses | Solo | Force Game End during an active meeting's results phase, then return to lobby immediately — confirm no stuck meeting state next round. |
| New match: new map, fresh roles/tasks, ready reset, roundNumber++, host sync after migration | Solo | Combine with scenario B's Force Host Disconnect to test the post-migration host-sync path specifically. |
| Non-host force-quits during post-game, rejoins after host returns to lobby | Solo | Force Disconnect on a non-host tab during PostGameScreen, host returns to lobby, then Force Reconnect — confirm landing on the lobby. |
| Real app-restart (full process kill, not just goOffline) | Humans required (low priority) | Tests cold-start + auto-rejoin together; goOffline/goOnline don't exercise auth re-initialization. Partially covered by existing Phase 2 reconnect tests. |

## G. Bot-filled matches

| Scenario | Status | Notes |
|---|---|---|
| Practice mode (1 human + bots) reaches a win condition without human input | Solo | Existing Practice mode; Force Game End can skip to the end state for UI testing. |
| No bot ever becomes host | Solo | Confirm via Debug tab over a long bot-heavy match that `hostUid` never matches a `bot_*` uid. |
| Sole human backgrounds their tab — game loop stalls until they return | Solo | Background the tab for real (don't use Force Disconnect) for 30s+, then foreground and confirm the heartbeat age drops back down. |
| Mixed human/bot matches, bots outnumbering humans, at 12 players | Solo | Bots tab "1 human + bots (max 12)" preset, or join multiple multi-tab-identity human tabs first. |
| Bot saboteurs occasionally get reported/ejected | Solo (partial) | Observable solo, but "occasionally" implies statistical behavior — run several full matches for better coverage. |
| Bot movement doesn't desync/teleport on human clients | Solo | Watch MapView on a human tab during a bot-heavy match. |
| eventLog growth/pruning (bug #4 fix) over a 10+ minute longevity test | Solo | Debug tab's "Event log size" should stabilize around MAX_EVENT_LOG_ENTRIES (200) rather than growing unboundedly. Use "1 human + bots (12)" for max throughput. |

---

## Summary

The large majority of the Phase 3.5 test matrix — reconnect flows, host
migration, simultaneous votes/tasks, the meeting-race fix,
return-to-lobby, and bot-filled matches at all player counts (4/6/8/12)
— are now solo-testable using multi-tab identity mode plus the dev
panel's Simulate/Bots/Debug/Events/State tabs.

The remaining "Humans required" / "(partial)" items are all
lower-priority, real-device-specific concerns (OS-level socket/process
behavior, real network handoffs, sub-100ms dual-tab timing precision,
and statistical bot-behavior coverage) that don't block Phase 4 — noted
here so they aren't forgotten, and can be revisited later if real human
testers become available or issues are suspected in those areas.

**Recommendation**: run the full Phase 3.5 test matrix using the
devtools as the primary validation pass, record any new findings in
`TEST_CHECKLIST.md`, and only move to Phase 4 once that pass is clean.
