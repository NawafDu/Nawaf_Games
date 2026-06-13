# Security Audit — Pre-Phase 4

**Posture: this audit assumes a hostile client.** Every check below was
performed by asking "if I open browser devtools and call the Firebase
SDK directly — bypassing the app's UI and gameAction functions entirely
— what can I write, and does any rule stop me?" Client-side validation
in `src/lib/gameActions/*.ts` is **not** a security boundary; only
`database.rules.json` is. Findings are graded by actual exploitability,
not by whether the normal UI exposes the action.

**Bottom line up front**: the rules correctly lock down a handful of
fields (who can change `role`, who can read `secrets`), but the
gameplay-critical fields — `tasks`, `movement`, `alive`,
`unreportedBodies`, `meeting`, and `hostUid` — are either unvalidated or
validated only for shape, not legitimacy. Every "can a malicious player
do X" question in section 1 below is YES, several trivially, via a
single `update()` call from the browser console. This is normal for a
prototype built without Cloud Functions, but it means the game currently
has zero cheat resistance and a complete hidden-information leak (every
player can read every role at all times). None of this blocks Phase 4
(bot intelligence) functionally, but it should be understood as the
baseline before any claim of "ready for strangers to play."

---

## 1. Can a malicious player...

### Change their own role? — Partially yes (via host takeover)
Directly: no. `games/{code}/players/{uid}/role` and
`games/{code}/secrets/{uid}/role` are both writable only by
`rooms/{code}.hostUid === auth.uid`. A normal player cannot write either.

However, because becoming host is itself unauthenticated (see "Become
host illegitimately?" below), the attack is two steps:
1. Write `rooms/{code}.hostUid = <self>` (no legitimacy check).
2. Write `games/{code}/players/{self}/role` (and, for consistency,
   `secrets/{self}/role`) to whatever value they want.

Both writes pass `.validate` (enum check only). **Verdict: yes, in two
trivial steps**, and the same path lets an attacker rewrite anyone's
role, not just their own.

### See hidden roles? — Yes, trivially, for everyone, at all times
`games/{code}/players/{uid}/role` is a mirrored, non-secret field inside
the `players` map, and `games/{code}.read` is granted to any room player.
Every client already holds a live `onValue` subscription to the entire
`games/{code}` object for the whole match.

This means every player's role is sitting in every other player's local
cache from the moment the match starts — `secrets/{uid}` (the genuinely
read-restricted path) is largely redundant, because the same information
is duplicated in an unrestricted location. A malicious player doesn't
even need a special call: opening devtools and inspecting the already-
subscribed `game.players` data (or the Zustand store) shows every
saboteur immediately.

**This undermines the core mechanic of a social-deduction game.**
Severity: critical for this genre.

### Modify votes? — Yes — own (trivially) and, via meeting creation,
other players' initial vote state
- **Own vote**: `meeting/votes/{auth.uid}` is self-writable with only
  `isString()` validation — a player can vote for a target who isn't
  even alive/in-game. (Changing your own vote repeatedly is by-design
  behavior, not a bug.)
- **Other players' votes**: when a non-host player starts a fresh
  meeting (`meeting.write` requires only
  `newData.child('phase').val() === 'discussion'`), `.validate` only
  requires `hasChildren(['id','type','calledBy','phase','startedAt','votes'])`
  — it does not constrain the *contents* of `votes`. RTDB does not
  re-check the descendant rule `meeting/votes/{voterUid}.write:
  auth.uid === $voterUid` for a write that originates at the parent
  `meeting` path and is already permitted there. A malicious player
  calling a fresh meeting can therefore pre-populate `meeting.votes`
  with arbitrary `{otherPlayerUid: targetUid}` entries for players who
  haven't voted yet. The same write can also set
  `discussionEndsAt`/`votingEndsAt` to arbitrary timestamps (e.g.
  `discussionEndsAt: 0`), collapsing the discussion window on the next
  host tick.

**Verdict: yes — pre-seeded votes for other players, plus timer
manipulation, via the meeting-creation write itself.**

### Modify another player's tasks? — Yes, but low practical value
`games/{code}/players/{uid}/tasks` is writable only by `auth.uid ===
$uid` (or host for bots/initial creation) — a player CANNOT write
`players/{someoneElse}/tasks`. Directly sabotaging another specific
player's tasks is correctly blocked.

(The far more severe issue is what a player can do to THEIR OWN tasks —
see next two items, which only require self-writes.)

### Fake task completion? — Yes, completely, with zero constraints
`players/{uid}/tasks` has `.write: auth.uid === $uid` and NO `.validate`
at all. A player can:
```
db.ref(`games/${code}/players/${myUid}/tasks`).set(
  myTasks.map(t => ({ ...t, status: 'completed', progress: 100 }))
)
```
— marking every task complete instantly, no location requirement, no
minigame interaction, no rate limit. `completeTask()`'s checks are pure
client convention.

**Verdict: yes, trivially, for all of a player's own tasks at once.**

### Fake kills? — Yes — any saboteur can "kill" any player, from
anywhere, with no cooldown
`games/{code}/players/{uid}/alive` is writable by any player whose own
`role === 'saboteur'`, for ANY `$uid` (the rule doesn't restrict the
target), with only `isBoolean()` validation. `eliminatedBy` is similarly
writable by any saboteur for any target. `unreportedBodies/{$uid}` is
writable by ANY room player with NO `.validate` at all (any shape).

So a saboteur can, from across the map, with no cooldown, no isolation,
no proximity:
```
db.ref(`games/${code}`).update({
  [`players/${victim}/alive`]: false,
  [`players/${victim}/eliminatedBy`]: 'kill',
  [`unreportedBodies/${victim}`]: { uid: victim, nodeId: 'x', killedAt: Date.now() },
});
```
`eliminate.ts`'s colocation/isolation/cooldown checks (and the
`lastKillAt` transaction) only constrain the app's own code path, not
the database.

**Verdict: yes — instant, repeatable, range-free kills.**

### Force win conditions? — Yes — one write can end the match for
everyone, either direction
`checkWinConditions()` (host, ~1s tick): Citizens win if every living
citizen's `tasks` are all completed; Saboteurs win if living-saboteurs
>= living-citizens (>=1 saboteur alive).

- **Citizens win on demand**: any citizen sets their own `tasks` to
  all-completed (nothing stops this). If they're the last citizen with
  incomplete tasks, the next host tick ends the match for the whole
  room.
- **Saboteurs win on demand**: a saboteur fake-kills citizens (via the
  `alive` exploit) until parity — next tick ends the match.
- **Direct version**: `games/{code}.status`/`winningTeam`/`endedAt` are
  writable by `games/{code}.hostUid === auth.uid`. Combined with host
  takeover (below), an attacker just writes
  `{status:'ended', winningTeam:'saboteurs', endedAt:Date.now()}`
  directly — no win-condition logic involved at all.

**Verdict: yes, multiple independent ways, several a single write.**

### Become host illegitimately? — Yes — at any time, no legitimacy check
Two `hostUid` fields, both exploitable:

- **`rooms/{code}.hostUid`**: `.write` is `!data.exists() ?
  newData.hostUid===auth.uid : root.../players/{auth.uid}.exists()` —
  any current player can write `hostUid` to any value passing
  `.validate` (must be an existing non-bot player — including
  themselves). No check that the current host is stalled/disconnected,
  or that the claimant is the "oldest connected human" — that's 100%
  `useHostMigration`'s client-side logic, which a malicious client just
  doesn't run.
- **`games/{code}.hostUid`**: `.write` includes `(auth != null &&
  root.child('rooms/{code}/players/{auth.uid}').exists())` — an
  unconditional grant to ANY room player, at any time.

```
db.ref(`rooms/${code}/hostUid`).set(myUid);
db.ref(`games/${code}/hostUid`).set(myUid);
```
Instant host takeover, no migration window, no disconnection needed.
Once host: control over `status`/`winningTeam`/`endedAt`/
`hostHeartbeatAt`, `meeting` phase transitions and `meeting/result`,
every `players/{uid}/role`, and bot player records.

**Verdict: yes — the single most severe finding.** Nearly every other
"host-only" protection is downstream of this and is therefore not a real
boundary against a determined attacker.

### Start meetings without permission? — Yes, by design (intended), AND
with extra unintended capabilities
Any room player whose new `meeting.phase === 'discussion'` may write the
whole `meeting` object — matches the intended design (any living player
can call a meeting/report a body). But as above, the same write also
lets them set `type`, `calledBy` to ANY uid (not checked against
`auth.uid`), `votingEndsAt`/`discussionEndsAt`, and pre-seed `votes`.

The rule also doesn't check `alive` — only that
`root.child('rooms/{code}/players/{auth.uid}').exists()`. A dead player
(who can also see all roles, per above) can call meetings and manipulate
`votes`/timers after being "eliminated."

**Verdict: yes — both the intended capability and several unintended
ones (impersonating `calledBy`, vote-seeding, timer manipulation, acting
while dead).**

---

## 2. Firebase Rules Audit

### Write paths and trust assumptions

**`rooms/{code}`**

| Path | Who can write | Trust assumption |
|---|---|---|
| root (create) | anyone, if setting `hostUid = self` | fine — room creation |
| root (migration-style updates) | any current player | client enforces "legitimate migration"; rule does not |
| `hostUid` | any current player -> any non-bot current player (incl. self) | NO staleness/legitimacy check — critical |
| `hostHeartbeatAt` | any current player | low risk on its own; migration itself already unguarded |
| `status`, `roundNumber`, `activeGameId` | room host, or (activeGameId) game host | depends on unguarded `hostUid` |
| `settings` | room host | depends on `hostUid` |
| `players/{uid}` | self, or room host (any field) | host can rewrite any player's whole record |
| `players/{uid}.displayName` | length 1-24 validated | fine |
| `players/{uid}.$other` | `.validate: true` | self/host can write arbitrary extra fields |

**`games/{code}`**

| Path | Who can write | Trust assumption |
|---|---|---|
| `id`,`roomCode`,`startedAt`,`settings`,`map` | room host only | fine; depends on `hostUid` |
| `status`,`winningTeam`,`endedAt` | game host | NO check that the win condition was actually met |
| `hostUid` | room host, game host, OR any room player (migration) | same critical gap as rooms/{code}.hostUid |
| `players/{uid}` whole (bots only) | game host, if `$uid` starts `bot_` | correctly scoped |
| `players/{uid}.uid` | room host | fine |
| `players/{uid}.role` | room host | gateway for role-rewrite once host hijacked |
| `players/{uid}.movement` | self, bot-via-host, host (initial) | shape-only — no adjacency/cooldown check |
| `players/{uid}.tasks` | self, bot-via-host, host (initial) | NO validation at all |
| `players/{uid}.lastKillAt` | self-if-saboteur, bot-via-host | number-only; moot since `alive` is directly writable |
| `players/{uid}.alive` | game host, ANY saboteur for ANY target, host (initial) | no proximity/isolation/cooldown/target check |
| `players/{uid}.eliminatedBy` | game host, or any saboteur | enum-only; same gap as `alive` |
| `players/{uid}.connected` | self, bot-via-host, host (initial) | fine |
| `players/{uid}.$other` | `.validate: true` | arbitrary extra fields |
| `secrets/{uid}.role` | room host | read correctly restricted to owner; write depends on `hostUid` |
| `meeting` (fresh, phase=discussion) | any room player (alive not checked) | `calledBy`/`votes`/timers not constrained |
| `meeting` (transitions/clear) | game host | depends on `hostUid` |
| `meeting/votes/{uid}` | self (targeted writes) | NOT enforced when written via parent `meeting` write |
| `meeting/result` | game host | depends on `hostUid` |
| `eventLog/{eventId}` | any room player | `type`/`actorUid` not constrained to enum/self |
| `unreportedBodies/{uid}` | any room player | NO validation — arbitrary shape |
| `hostHeartbeatAt` | game host | depends on `hostUid` |

**`chat/{code}/{meetingId}/{messageId}`**: write requires `senderUid ===
auth.uid` and room membership; `text` <= 280 chars. No `alive` check — a
dead player can still chat (may be intentional for spectating, but worth
confirming against design — many social-deduction games silence the
dead).

**`presence/{code}/{uid}`**: self-write only, shape-validated. Fine.

### Trust assumptions on the client (summary)

Documented-or-implicit client-only enforcement:
1. Movement neighbor-adjacency and cooldown.
2. Kill proximity, isolation, cooldown (partial server-side transaction
   exists but is moot since `alive` is directly writable).
3. Task location requirements.
4. Host-migration legitimacy ("is the host actually stalled", "am I the
   correct next host").
5. Meeting cooldown.
6. `calledBy` actually being the caller.
7. Vote target validity for direct `meeting/votes/{self}` writes.
8. Win-condition correctness when `status`/`winningTeam` written
   directly.

### Privilege escalation paths (ranked)

1. **Host takeover -> role rewrite -> win-condition rewrite -> arbitrary
   outcome.** One unguarded write (`hostUid`) cascades into control of
   almost every other "host-only" field. The master key.
2. **Self-write `tasks` -> instant Citizens win.** No host takeover
   needed — fastest path to "break the game," even for a
   non-adversarial curious user.
3. **Any-saboteur `alive` write -> mass fake-kills -> Saboteurs win.** No
   host takeover needed.
4. **Fresh-meeting write -> vote pre-seeding + timer collapse.** No host
   takeover needed.
5. **Universal role visibility.** Not an escalation, but defeats the
   game's information asymmetry with zero writes at all.

---

## 3. Cheat Resistance

### Client-authoritative actions today

| Action | Client-side validation | Server-side (.validate) enforcement | Gap |
|---|---|---|---|
| Movement | neighbor-adjacency, cooldown via transaction | shape only | Teleport anywhere, any time, no cooldown |
| Task completion | location, alive, meeting-phase, idempotency | none | Mark all tasks complete instantly |
| Task progress | clamps 0-100 | none | Same as above, finer-grained |
| Elimination | role, alive, colocation, isolation, cooldown | "writer is *a* saboteur" only | Kill anyone, anywhere, anytime |
| Body reporting | reporter alive, body at node, meeting claim | unreportedBodies: none; meeting: phase==='discussion' only | Fabricate bodies; act while dead |
| Emergency meeting | alive, cooldown via eventLog scan, meeting claim | same as above | Bypass cooldown directly; impersonate calledBy |
| Voting | phase==='voting', target alive | votes/{uid}: isString() only | Vote for invalid targets; pre-seed others' votes via fresh meeting |
| Win/end state | checkWinConditions() on host | writable by any current "host" | No verification outcome matches game state |
| Host migration | "oldest connected human, stalled host" | target must be non-bot existing player — that's it | Anyone becomes host anytime |
| Event log attribution | set to own uid by caller's code | not checked against auth.uid or enum | Forge attribution/history |

### How they're "validated" today

Almost everything is a one-shot `get()` followed by client-computed
conditionals, then a write the rules accept on coarse criteria
(self-ownership, "is *a* saboteur", "is *the* host" — never "is this
specific action currently legal given full game state"). RTDB rules
handle per-field shape/ownership well but can't easily express
cross-field invariants like "is this the player's neighbor node" or "has
this cooldown elapsed" without duplicating game logic into rule
expressions — which the current ruleset doesn't attempt for the
high-value fields.

### Proposed fixes (roughly ordered by impact/effort)

1. **Close the `hostUid` hole (highest impact, moderate effort).**
   Require `hostUid` writes to either come from the current host
   (self-reassignment), or satisfy an in-rule staleness check using
   RTDB's `now`:
   `root.child('games/{code}/hostHeartbeatAt').val() < (now - 15000)`.
   Combined with requiring the new host's
   `root.child('rooms/{code}/players/' + newData.val() + '/connected').val() === true`,
   this closes the "instant takeover while the real host is active"
   attack — the dangerous case — even if exact "oldest connected human"
   ordering remains client-side.

2. **Stop treating `players/{uid}/role` as readable-by-all during an
   active match (highest impact for game integrity).** Remove the
   mirrored `role` field from the live `players` map while
   `status==='active'`, or move role-dependent server-equivalent logic
   (`checkWinConditions`, `canKillAt`) to read only from `secrets/*`
   (host can already read everything). Copy `secrets/*` -> `players/*/role`
   only at `status==='ended'` for the post-game reveal. Real
   architectural change, but fixes the worst issue.

3. **Add `.validate` to `tasks` and `unreportedBodies`.** At minimum,
   `tasks` should be an array of objects with required keys and
   `progress` in 0-100; `unreportedBodies/{uid}` should require
   `hasChildren(['uid','nodeId','killedAt']) && uid === $uid`. Doesn't
   stop self-completion (needs #4) but blocks malformed-data attacks.

4. **Add cross-field rule checks for `alive`/`tasks`.** RTDB rules can
   reference other paths via `root.child(...)`. E.g.
   `players/{targetUid}/alive` (for a saboteur writer) could require
   `root.child('games/{code}/players/' + auth.uid + '/movement/currentNodeId').val()
   === root.child('games/{code}/players/' + $uid + '/movement/currentNodeId').val()`
   (proximity) — blocks "kill from across the map" even if full
   isolation/cooldown logic stays client-side. Task-completion location
   checks are harder to express generically across an array in rules; a
   pragmatic middle ground is Cloud Functions (#6).

5. **Constrain the fresh-`meeting` write.** Require
   `newData.child('calledBy').val() === auth.uid`,
   `newData.child('votes').val() === null` (blocks vote pre-seeding),
   bound `discussionEndsAt`/`votingEndsAt` to `>= now` and within a sane
   multiple of configured durations, and require
   `root.child('games/{code}/players/' + auth.uid + '/alive').val() === true`.

6. **Long-term: Cloud Functions (or equivalent trusted server) for
   elimination, task completion, win-condition evaluation, and host
   migration.** The only way to fully close the cross-field-invariant
   gaps without extremely convoluted rules. The project's docs already
   note this was deliberately deferred for the prototype/MVP — revisit
   before any public launch.

7. **Quick partial mitigation without Cloud Functions**: server-
   timestamp-based rate limiting via rules (`newData.val() > data.val()
   + cooldown` patterns) on `alive` writes and task-completion counts —
   raises the bar from "instant, unlimited" to "rate-limited" even
   without full legitimacy checks.

---

## 4. Realtime Database Load Review

### Model

Every connected client holds one persistent `onValue` subscription to
the entire `/games/{roomCode}` object for the match duration. The host's
per-tick `update()` (~1s, `runGameLoopTick`) touches multiple branches
(`hostHeartbeatAt` always; `meeting/*`, `players/{uid}/*`,
`eventLog/{id}` when relevant), each delivered to all N subscribed
clients.

**Per-tick fixed cost**: `hostHeartbeatAt` (~20 bytes) to all N clients,
every ~1s, regardless of other activity.

**Per-action cost (player-driven)**:
- Movement: `players/{uid}/movement` (~60B) + `eventLog/{id}` (~120B)
  ~= 180 bytes, fanned out to N clients.
- Task completion: `players/{uid}/tasks` (whole array, ~150-300B for
  6-9 tasks) + `eventLog/{id}` ~= 400-500 bytes.
- Elimination: `alive` + `eliminatedBy` + `unreportedBodies/{uid}` +
  `eventLog/{id}` ~= 300 bytes.
- Meeting creation: whole `meeting` object (~250-400B) + `eventLog/{id}`
  ~= 500 bytes.
- Vote cast: `meeting/votes/{uid}` (~40B) — cheap individually, but N
  votes in the voting phase = N small pushes to N clients.

**`eventLog` steady state**: capped at 200 entries x ~100-150B each ~=
20-30 KB. A single-field `update()` only sends the changed entries, not
the whole log — except on initial subscribe/reconnect, where the full
current `games/{code}` object (including the full `eventLog`, up to the
cap) is sent once.

### Worst-case estimates

"Worst case": every player moves as fast as their cooldown allows
(`fast` = 1s cooldown), sustained, plus proportional task/meeting/vote
activity. Movement dominates because fan-out is O(N^2): N players each
generating an update, each delivered to N clients.

| Players (N) | Heartbeat (1/s x ~20B x N) | Movement (N moves/s x ~180B x N) | **Approx. sustained aggregate / per-client** |
|---|---|---|---|
| 4 | 80 B/s | 2,880 B/s | ~3 KB/s aggregate (~0.7 KB/s per client) |
| 8 | 160 B/s | 11,520 B/s | ~11.7 KB/s aggregate (~1.5 KB/s per client) |
| 12 | 240 B/s | 25,920 B/s | ~26 KB/s aggregate (~2.2 KB/s per client) |

**One-time costs per match**: initial `games/{code}` `set()` is
dominated by `map` (6-12 nodes x ~100B ~= 1-1.5KB) + `players` (N x
(~80B + ~200-300B tasks) ~= N x ~350B) + `secrets` (N x ~30B). For N=12:
~6KB, delivered to each of 12 clients ~= ~72KB total initial sync.
Reconnects re-sync the full current object (up to the ~20-30KB eventLog
cap) — frequent reconnects add up but remain small in absolute terms.

**Bot-filled matches**: bots add no fan-out cost (no client connections),
but the host's loop drives bot actions on the same writes, so a
"1 human + 11 bots" room generates similar *write* volume to 12 active
humans but only 1x fan-out — far cheaper bandwidth-wise, though
`eventLog` still fills at the same rate (pruning remains relevant).

### Verdict on load

At 4-12 players, bandwidth is not a practical concern — even the
12-player worst case (~26 KB/s aggregate, ~2.2 KB/s per client) is
trivial for any modern connection including cellular. The O(N^2) fan-out
would only matter at player counts an order of magnitude higher (50-100+),
well outside this game's design range. **No load-related changes needed
before Phase 4.**

---

## 5. Production Readiness Report

### Classification: Alpha

**Why not Prototype**: the core loop is feature-complete end-to-end —
lobby, roles, map, movement, 9 minigames, eliminations, meetings,
voting, win conditions, bots, reconnection, host migration, and
return-to-lobby all function correctly per the Phase 3.5 QA pass. This is
well past "does the idea work at all."

**Why not Beta**: Beta implies the remaining issues are polish-level, not
integrity-level. That's not true here:

- The game's central mechanic — hidden roles — is not actually hidden
  from anyone willing to open devtools. Not a polish issue; it's the
  premise of the game failing.
- Every win condition can be forced by any single player in one write. A
  curious user, not even a sophisticated attacker, can end every match
  instantly.
- Anyone can become host at any time, cascading into control over
  outcomes, roles, and bot records.

**Why Alpha and not lower**: these are all trust issues, not logic bugs.
The gameplay logic itself — map generation, minigames, meeting flow, bot
AI, win-condition math, reconnection and host-migration *protocol* — is
correctly implemented and works for cooperative/trusting players. "Alpha"
fits: feature-complete and internally consistent, suitable for trusted
playtesters who won't intentionally exploit it (a closed group of
friends who agree not to open devtools) — not safe for the general public
or any population where even one curious person might poke at the
network tab.

### Path to Beta

At minimum, fixes #1 (host takeover) and #2 (role visibility) from
section 3 — these are exploitable by a merely-curious user, not just a
malicious one. A Beta with a trusted/invited cohort could reasonably ship
with #3-#5 still open if #1 and #2 are closed.

### Path to Production Candidate

All of section 3's fixes, with #6 (Cloud Functions or equivalent for
elimination/task/win-condition/migration) as the structural fix for the
remaining cross-field invariants that RTDB rules alone can't express
cleanly. A production social-deduction game needs the hidden-information
guarantee to be architecturally enforced, not convention-based — this is
the single highest-priority item before public launch.

### Recommendation regarding Phase 4

Phase 4 (bot intelligence) can proceed — none of these findings block or
are affected by bot AI quality work, and bots already operate within this
same trust boundary without issue. However, treat this report as a
blocking prerequisite for any public/open playtest, even before
Production. A closed Alpha with trusted testers (the current Phase 3.5 QA
cohort) remains appropriate in the meantime.
