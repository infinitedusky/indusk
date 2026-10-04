---
title: "The watcher proves it is watching"
date: 2026-10-03
status: completed
trajectory: required
test_phases: required
gate_policy: ask
---

# The watcher proves it is watching — Implementation

## Goal

"Nothing broke" is only ever reported by a watcher that has just proved it
can hear. `readPromiseMarks` probes its source before it reads — one span sent
through the intake, read back through the query API — and throws
`WatcherBlind` when it does not come back; every reader says *watcher blind*
in place of counts. The always-on server sends a heartbeat each pass, reads
the previous one, and tells Slack once on going blind and once on recovering.
A promise may declare `expect_every`. See [brief.md](brief.md),
[test-plan.md](test-plan.md) and [adr.md](adr.md).

## Scope

### In Scope
- `probeWatcher` + `WatcherBlind` (`lib/promises/probe.ts`), called first in
  `readPromiseMarks`, cached 30 s per source
- The intake address for a named server: an optional
  `promises.jaeger.otlp_url`; a named server without one reads *watcher blind*
  naming the key — never an unprobed read (see Notes)
- Every reader's mapping: `promises status`, `promises watch`,
  `promise_health`, the admin's Promises page, the catchup skill
- The server heartbeat, `<volume>/watcher-state.json`, the two Slack messages
- `expect_every` in promise frontmatter, `promises check`'s refusal, the
  attention state in every reader; `every-commit-evaluated` declares one

### Out of Scope
- Deploying a server (`day-always-on-deploy`); one server per workbench
  (`workbench-watch-provisioning`)
- A local "since when" — locally nothing runs between sessions (ADR, Accepting)
- The promise timeline (`day-always-on-deploy`'s brief)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A2, A4–A8 red; A1, A3 regression guards | today's readers, the real local daemon, `startFakeQueryPort`, the real server binary, `slack-capture` |
| Build Phase 1 | `probe.ts` (`probeWatcher`, `WatcherBlind`), `promises.jaeger.otlp_url`, every reader's *watcher blind*, the catchup line | `readPromiseMarks`, `resolveMarkSource` |
| Build Phase 2 | `always-on/heartbeat.ts`, `watcher-state.json`, two Slack messages | `startPass`, `runPass`'s Slack post, Build Phase 1's span shape |
| Build Phase 3 | `expect_every` in the registry, `promises check`, the attention state | `parseDuration`, `healthOf`, the admin's chips |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | With the local daemon running and listening, `promises status` and `promise_health` read promises exactly as today — a probe that comes back changes nothing a person sees | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/watcher-probe.test.ts |
| A2 | When the Jaeger a project reads answers its queries but never returns what is sent to it, `promises status`, `promise_health` and the admin's Promises page say **watcher blind**, naming where they looked, with no promise counts | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/watcher-probe.test.ts, apps/indusk-admin/src/__tests__/http-watcher-blind.test.ts |
| A3 | With the daemon stopped, every reader says the watcher cannot be reached — as today — and never a count | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/watcher-probe.test.ts |
| A4 | Reading promise health repeatedly within 30 s sends one probe, not one per read | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/watcher-probe.test.ts |
| A5 | `/catchup` reports "watcher blind" on its own line, ahead of the roadmap, when `promise_health` says so — and never promise counts in that state (package and installed copies) | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/watcher-catchup-skill.test.ts |
| A6 | The always-on server records a heartbeat on every pass: its own Jaeger holds a heartbeat span no older than one pass interval | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/watcher-heartbeat-server.test.ts |
| A7 | When the server's heartbeat goes stale, Slack gets one "watcher blind since <time>" message, not one per pass; when heartbeats resume, one "watcher recovered" message | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/watcher-heartbeat-server.test.ts |
| A8 | A promise declaring `expect_every` needs attention when no mark of it has arrived for longer than that while the watcher is listening; a promise without it, silent as long, does not | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/watcher-expect-every.test.ts |

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author all eight now. Every subject is reached over a boundary — the
CLI, the MCP tool through `helpers/tool-call.ts`, the admin over HTTP, the
server binary, Jaeger's query API, the skill files — so nothing is deferred.
The `indusk-watcher` service and the `expect_every` key do not exist yet; a
test that queries for the first finds nothing and one that writes the second
writes a key nothing reads, both genuine reds.

- [x] Create/confirm this plan's worktree (`indusk worktree create watcher-heartbeat`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [x] Author A1–A4 in `apps/indusk-mcp/src/__tests__/watcher-probe.test.ts`, added to `SYSTEM` in `vitest.tiers.ts`. A1: `startLocalJaeger` in a temp home, a project from `promises-fixture.ts` with one behaviour promise and one upheld mark loaded; `promises status` (CLI, `INDUSK_HOME` set) and `promise_health` (tool call) report the promise upheld, exit 0. A2: `startFakeQueryPort(home, '{"data":[]}')` — answers every request like an empty Jaeger, stores nothing; `promises status` exits 2 with "watcher blind" and the URL in its output and no "0 violations"; `promise_health` is an error carrying "watcher blind". A3: no daemon in the home; both readers say unreachable, exit 2 / error, no count. A4: against the real daemon, five `promise_health` calls in one process within a second, then a query of `/api/traces?service=indusk-watcher` returns exactly one `watcher.probe` span. Every test stops its daemon (`stopTelemetryForHome`) — done; the daemon is stopped through `startLocalJaeger`'s own `stop()`, as `monitor-status` does. "No promise rows" reads `promises ?? []` as empty: `promise_health` answers an unreachable Jaeger with `promises: null`, not an absent key
- [x] Author A2's admin half in `apps/indusk-admin/src/__tests__/http-watcher-blind.test.ts`, beside `http-promise-health.test.ts` and on its pattern: a registered project whose home's daemon record points at `startFakeQueryPort(home, '{"data":[]}')`; `GET /p/<project>/promises` contains "watcher blind" and no "upheld" or violation count — written as: 200, "watcher blind", no green chip, no "not seen" (what the page shows today for an empty answer)
- [x] Author A5 in `apps/indusk-mcp/src/__tests__/watcher-catchup-skill.test.ts` (everyday tier), on the `release-ritual-skill.test.ts` pattern: `apps/indusk-mcp/skills/catchup.md` and `.claude/skills/catchup/SKILL.md` each say that a `promise_health` result naming *watcher blind* is reported on its own line ahead of the roadmap and that no promise counts are reported with it
- [x] Author A6 and A7 in `apps/indusk-mcp/src/__tests__/watcher-heartbeat-server.test.ts`, added to `SYSTEM`. A6: `startAlwaysOnServer` with `INDUSK_SERVER_PASS_INTERVAL_MS=1000`; after three seconds the server's query API (authenticated) holds a `watcher.heartbeat` span from `indusk-watcher` younger than two seconds. A7: the same server with a `startSlackCapture` webhook and the staleness floor lowered for the test (`INDUSK_SERVER_WATCHER_STALE_MS=3000` — named with the server's other settings, not `INDUSK_WATCHER_STALE_MS`); after a clean start, `SIGSTOP` the server's Jaeger child (found by the server's volume in `ps`) — exactly one captured message containing "watcher blind since" across at least four passes; `SIGCONT` it — exactly one "watcher recovered", and still one "blind". Also in `RUN_ALONE`, beside the other timed server files. A clean start must say nothing, so a server with no beat yet is listening until the staleness window has passed since it started — Build Phase 2 must honour that
- [x] Discovered: the first red run left one server Jaeger running. The helper's `stop` SIGKILLs the server after 5 s, and a Jaeger just thawed from `SIGSTOP` was still shutting down, so it outlived its parent. The test now thaws first and then kills any Jaeger still started from its volume; the re-run left none, and the leak guard was clear
- [x] Author A8 in `apps/indusk-mcp/src/__tests__/watcher-expect-every.test.ts`, added to `SYSTEM`: the real local daemon, a fixture project with two behaviour promises, one declaring `expect_every: 1h`, neither with a mark in the last two hours (one each loaded at three hours ago); `promise_health` reports the first as needing attention with "silent for" and "expected every 1h" and the second not; `promises status` says the same — `promises-fixture.ts`'s `PromiseSpec` gains an optional `expect_every`, written to frontmatter when set
- [x] Run each and read each failure: A2 reads "0 violations" today (red on "watcher blind"); A4 finds no probe span (red on the count); A5 finds no blind line in the skill; A6 finds no heartbeat; A7 captures no message; A8 reports neither promise needing attention; A1 and A3 pass. A red that is a load or setup failure is not authored — fix the test or defer it into this register — read 2026-10-03: A2 CLI exits 0 with "not seen" and `promise_health` returns a 0-violation row (red on "watcher blind"); admin A2 renders 200 without "watcher blind"; A4 added 0 probe spans (expected 1); A5 4/4 red on the skill text; A6 found no heartbeat span; A7 captured no "blind" message; A8 `needsAttention` is `[]` and the status block lacks "expected every 1h"; A1 and A3 green. Every red is on its own assertion; nothing deferred
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (Seven files, all test code; `unreadable` empty. Each test file's helpers — `status`, `health`, `probeSpans`, `newestBeat`, `findJaegerPid` — are named for what they read, and A7's long body is one sequence told in order: clean start, freeze, one message, thaw, one message.)

#### Regression Guards

- **A1** — what a person reads from a listening daemon today, and must keep reading once every read probes first. It passes when written; it goes red if the probe changes a healthy read.
- **A3** — the unreachable path day-monitor built. It passes when written; it goes red if `WatcherBlind` swallows `JaegerUnreachable`, or the probe turns "nobody answered" into a different, vaguer state.

#### Test Phase 1 Verification

- [x] A2 and A4–A8 fail on their own assertions and A1, A3 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watcher-probe src/__tests__/watcher-heartbeat-server src/__tests__/watcher-expect-every`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/watcher-catchup-skill`; `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-watcher-blind`), and the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js` exits 0)

### Build Phase 1: the probe, and every reader says so

- [x] `apps/indusk-mcp/src/lib/promises/probe.ts`: `WatcherBlind` (`where`, `intake`, `reason`; message names both URLs) and `probeWatcher(source, { project, timeoutMs })` — POST one OTLP/JSON span (service `indusk-watcher`, span `watcher.probe`, `indusk.project`, `indusk.probe.id` random) to the source's intake with its credential; poll the query API for that id for up to 5 s; not found → `WatcherBlind`; the intake refusing or unreachable → `WatcherBlind` naming it. A per-process cache keyed by query URL holds a success for 30 s (`PROBE_CACHE_MS`); a failure is never cached
- [x] `MarkSource` gains `intakeUrl`: the local daemon's `http://localhost:<otlpPort>`; for a named server, `promises.jaeger.otlp_url` (new optional key in `lib/config.ts`'s type and schema). A named server without it → `WatcherBlind` naming `promises.jaeger.otlp_url` — a read that cannot probe is not a read
- [x] `readPromiseMarks` calls `probeWatcher` after `resolveMarkSource` and before `markedSpans`; `JaegerUnreachable` from the source still wins (A3)
- [x] `bin/commands/promises.ts` (`status`, `watch`): `WatcherBlind` exits 2 with "watcher blind — a probe sent to <intake> did not come back from <query>", the same shape as unreachable; `lib/promises/watch.ts` refuses to open or extend anything while blind — `watch.ts` needed no change: it calls `readPromiseMarks` before writing anything, so a blind read throws before any incident is touched
- [x] `promise_health` (`src/tools/plan-tools.ts`, `lib/promises/health.ts`): `WatcherBlind` → `isError` with `blind: true`, the message, no rows — `health.ts` unchanged (it reads through `readPromiseMarks`, so the throw arrives); the tool adds `blind: true` beside `promises: null`
- [x] Discovered: A4 counted zero probes — A1, earlier in the same file and process, had already cached the probe for that daemon's query URL. A4 now starts its own daemon, so its cache starts empty; its assertion is unchanged. A1–A4 5/5 (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watcher-probe`)
- [x] `apps/indusk-admin/src/lib/promise-health.ts` `healthOf`: `WatcherBlind` → every behaviour chip hollow, "watcher blind — <intake> sent, not returned"; its chip state joins the label map in `components/bars/labels.ts` under the render-parity pin — built as a state of the **read**, not a new chip: `HealthRead`'s failure carries `blind: { intake }`, the page passes it to `PromisesTable`, which shows a "Watcher blind — a probe sent to <intake> was not returned by <where>" banner in place of "health unknown since". Every behaviour chip stays hollow and "not seen" is suppressed, through the existing unknown-read path. No `PromiseHealth` member was added, so nothing joins the label map: blind describes the backend, and the chip describes a promise
- [x] `apps/indusk-mcp/skills/catchup.md`: when `promise_health` says *watcher blind*, say so on its own line ahead of the roadmap and report no counts; resync `.claude/skills/catchup/SKILL.md`
- [x] Export `WatcherBlind` through the subpath the admin already imports `JaegerUnreachable` from, so the admin's `instanceof` sees the same class — `promises/telemetry.ts` re-exports it from `probe.ts`. It was left out of the admin commit, which compiled only against the working tree, and was committed separately (cbe43118) after the evaluator stashed it — see the next item
- [x] Discovered: every test that names a server through `promises.jaeger` (`always-on-source`, the admin's `http-promise-remote`) now needs `otlp_url` beside `url`, or its reads go blind — the probe needs an intake. Handled in this phase's Verification
- [x] Discovered: the evaluator, grading this branch, ran `git stash` in this worktree (20:22, reflog "reset: moving to HEAD"). It took this impl's latest edit and the uncommitted `telemetry.ts` re-export along with its own `current.md` changes. All four files were restored from the stash commit (8d97ef80) without popping it. The stash entry is left in place for the user. Highlighted as a critical incident
- [x] Shape (`apps/indusk-mcp/src/lib/promises/probe.ts`) — compute the probe's wait once (`const waitMs = opts.waitMs ?? PROBE_WAIT_MS`) instead of restating the fallback in the deadline and the message. Rule: one fact, one name; the two copies would drift on the next change to either
- [x] Shape (`apps/indusk-admin/src/components/Promises.tsx`) — reviewed, left as-is: the blind banner restates the unknown banner's classes rather than sharing a component. These are two sibling paragraphs in one render, mutually exclusive by condition, and a shared wrapper would hide which state is showing behind a prop

#### Build Phase 1 Verification

- [x] A1–A5 pass (the three commands in Test Phase 1's Verification, scoped to `watcher-probe`, `watcher-catchup-skill`, `http-watcher-blind`); `monitor-status`, `monitor-watch`, `always-on-health-tool`, `always-on-source` and the admin's `http-promise-health`, `http-promise-remote` still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/monitor-status src/__tests__/monitor-watch src/__tests__/always-on-health-tool src/__tests__/always-on-source`; `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-promise-health src/__tests__/http-promise-remote`) — system: `monitor-status`, `monitor-watch`, `always-on-health-tool`, `always-on-cleanup`, `always-on-falsification`, `watcher-probe` 37/37, `always-on-source` alone 5/5; everyday: `watcher-catchup-skill` + `skill-sync-parity` 28/28; admin: `http-promise-health`, `http-promise-remote`, `http-watcher-blind` 12/12. The first `always-on-source` run failed to start its server: port 16685 was held by a server the evaluator had started in this worktree; it passed once that run ended
- [x] `pnpm check` clean; `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` clean — `tsc` clean. `pnpm check` is red on `main` as well, with the same 21 diagnostics on files this plan does not touch (admin `public/*.svg`, `.indusk/*.json`, `.claude/hooks/`, the docs config). Biome over this plan's changed files, each package under its own config, is clean: mcp 12 files, admin 5

#### Build Phase 1 Context

- [x] guard: `watcher-probe.test.ts` A2 carries `lesson: reachable-is-not-listening` — the lesson file says a backend that answers is not one that hears; read health only after a probe comes back — both A2 assertions carry it; `lessonStates` reads the lesson as **guarded** by that file; `indusk context check-pointers` PASS
- [x] `apps/indusk-admin/CLAUDE.md`: *watcher blind* is a hollow chip like unreachable, never green or "unverified" — the admin reads `WatcherBlind` through the same subpath as `JaegerUnreachable` — written as built: blind is a state of the read with its own banner, never a chip colour (folded into the existing Promises-page entry, +167 bytes; 4,932 of 16,384)

#### Build Phase 1 Document

- [x] `apps/docs/src/guide/promises.md`: *watcher blind* and how it differs from unreachable, with the Mermaid diagram (reader → probe → returned → marks | not returned → watcher blind) — a new "Watcher blind" section after "The loop"; `vitepress build` clean
- [x] `apps/docs/src/reference/cli/promises.md`: `status` and `watch` exit 2 when blind; `promises.jaeger.otlp_url`; `apps/docs/src/reference/skills/catchup.md`: the blind line; `apps/docs/src/changelog.md` Unreleased, Added: the watcher probe — also: `watch`'s exit table names blind under 2; the library paragraph names `probeWatcher`, `WatcherBlind` and the 30 s trust

### Build Phase 2: the server's heartbeat

- [x] `apps/indusk-mcp/src/lib/always-on/heartbeat.ts`: `readNewestHeartbeat(endpoint)` (newest `watcher.heartbeat` span's time, or a failure), `sendHeartbeat(otlpUrl, credential)` (the probe's span shape, span `watcher.heartbeat`), `watcherStatePath(volume)` + read/write of `watcher-state.json` (`{ state: "listening" | "blind", since, newestBeat }`, written atomically; a malformed file reads as unknown and is replaced, never thrown past the pass) — as built: the beat is sent through `probe.ts`'s `watcherSpanBody` + `sendWatcherSpan` (no separate `sendHeartbeat`). The state is `{ state, since }`; the newest beat is read fresh from Jaeger every pass, so it is not stored. `pass.ts`'s `postToSlack` is exported for the two messages. Also: one heartbeat pass per volume at a time, since two overlapping passes would both post "blind"
- [x] The pass, before `runPass`'s violation read: read the newest beat; stale when older than `max(3 × interval, 3 min)` (overridable by `INDUSK_WATCHER_STALE_MS` for tests, in `ServerSettings`) or unreadable → blind; send this pass's beat; on a transition only, post "watcher blind since <newest beat>" or "watcher recovered, blind from … to …" through the pass's existing Slack post. A failed Slack post leaves the state unwritten, so the next pass tries again — the day-always-on rule — as built: `INDUSK_SERVER_WATCHER_STALE_MS` (named with the server's other settings) → `ServerSettings.watcherStaleMs`. `startPass` runs `heartbeatPass` before `runPass` on each tick. A server with no beat yet counts from its own start, so a clean start is listening until a full staleness window has passed
- [x] `describePassResult` reports the watcher state each pass (one info line; the transition as an error line when blind) — as `describeHeartbeat` beside it, logged by the same tick, so `PassResult` (shared with `announce --once`) keeps its shape
- [x] Shape (`apps/indusk-mcp/src/lib/always-on/heartbeat.ts`) — extract the transition decision from `heartbeatPass` into a pure `watcherTransition(previous, judged, now, queryUrl)` → `{ message, next }`, so `heartbeatPass` only reads, sends, tells and writes. Rule: one reason to change per unit, and a seam a test can reach without a live server — done; A6 and A7 2/2 after it, with nothing else running (the first re-run overlapped an evaluator run in this worktree and failed A7)

#### Build Phase 2 Verification

- [x] A6 and A7 pass and A1–A5 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watcher-heartbeat-server src/__tests__/watcher-probe`); the always-on suites still pass (`… src/__tests__/always-on-pass src/__tests__/always-on-server src/__tests__/always-on-falsification`) — 26/26 in one run, plus A5 4/4; no server Jaeger left; leak guard clear. Two runs along the way were not clean. (1) The evaluator, grading a commit, ran `watcher-heartbeat-server` in this worktree at the same time, and the two servers collided. Waited for it to end. (2) `always-on-server` and `always-on-falsification` collide on Jaeger's gRPC query port 16685 when run in parallel, and do so **on main too** (reproduced there). Both now run in `RUN_ALONE` with the other server files. The server's unset gRPC port is a follow-up, not this plan's
- [x] `pnpm check` clean; `tsc --noEmit` clean — `tsc` clean. Biome is clean over this plan's changed mcp files (16). `pnpm check` is red on main for files outside this plan, as recorded in Build Phase 1

#### Build Phase 2 Context

- [x] guard: `watcher-heartbeat-server.test.ts` A7 carries `lesson: an-alarm-must-not-travel-the-path-it-reports` — the server's blind message goes to Slack over HTTPS, never through the Jaeger it reports deaf, and only on a transition

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/telemetry-server.md` and `apps/docs/src/guide/always-on.md`: the heartbeat, `watcher-state.json`, the two Slack messages, the staleness rule; the changelog: the server heartbeat — a "The heartbeat" section under the pass, `INDUSK_SERVER_WATCHER_STALE_MS` in the environment table, a "when the server stops hearing" paragraph in the guide's "What you see"; `vitepress build` clean

### Build Phase 3: `expect_every`

- [x] `lib/promises/registry.ts`: `expect_every` read into `PromiseEntry.expectEveryMs`; `promiseProblem` refuses a value `parseDuration` (`lib/promises/status.ts`) cannot read, naming it — so `promises check` refuses it — as `PromiseEntry.expectEvery: { text, ms }`. The text is kept because every reader prints it as written ("expected every 1d")
- [ ] `readPromiseMarks` widens its window to the longest `expect_every` when that exceeds the quiet window; `health.ts` marks a promise **needs attention** — "silent for <age>, expected every <duration>" — when the watcher is listening and its newest mark (upheld or violated) is older; `promises status` prints it; the admin's chip shows it under the same label map — one judgment, `silencePastExpectation(promise, marks, now)` in `promises/telemetry.ts` (the subpath all three readers already import), so none restates the rule. `promise_health` rows carry `silence` and join `needsAttention`. `status` prints "needs attention — silent for …". The admin shows it on the detail line under the chip; as with *watcher blind*, no chip colour was added, because the chip still describes what was observed
- [x] `.indusk/promises/every-commit-evaluated.md`: `expect_every: 1d` — with a History line that says what declaring it costs: a day with no commits also reads as needs attention. `promises check` clean with the key. `promiseProblem` refuses `"soon"`, `5` and `"0h"` by name and accepts `"1d"` (checked by hand)
- [x] Discovered: `pnpm test` failed day-always-on's A29 pin, `always-on-cleanup`'s check that the Jaeger-URL normalization is written once. This plan had restated it twice, for the intake in `probe.ts` and for `otlp_url` in `resolveMarkSource`. It is now `normalizeJaegerUrl` in `promises/telemetry.ts`, called by `jaegerEndpoint` and both new sites; the pin passes 4/4
- [x] Shape (`apps/indusk-mcp/src/lib/promises/status.ts`) — `formatStatus` spells the "needs attention — …" line twice, once per branch. Name it once (`attentionLine`) and use it in both. Rule: one fact, one name — done; A8 and `monitor-status` 11/11 after it
- [x] Shape (`apps/indusk-mcp/src/lib/promises/telemetry.ts`) — reviewed, left as-is: `silencePastExpectation` finds the newest mark the same way `health.ts` and the admin's `healthOf` compute `lastSeen`. That is a cross-file question, `/cleanup`'s to judge with all three in view

#### Build Phase 3 Verification

- [x] A8 passes and A1–A7 still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watcher-expect-every src/__tests__/watcher-probe src/__tests__/watcher-heartbeat-server`; the A5 and admin commands); `pnpm promises:check` clean with the new key — every `watcher-*` file and the admin's `http-watcher-blind` ran in the two full runs below, all green; `promises check` clean (4 promises, 2 incidents)
- [x] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear — `pnpm test`: mcp 1,675 / 5 skipped, admin 345, `promises check` clean, guard all-clear. The first run failed only day-always-on's URL-normalization pin (fixed above). `pnpm test:system`: 26 files, 97 tests, guard all-clear. Both run with no other vitest in the worktree

#### Build Phase 3 Context

- [x] planning: `apps/indusk-mcp/templates/planning/CLAUDE.md` (and its installed copy) — a promise about something known to happen regularly declares `expect_every`; silence without it is the good outcome — folded into the `.indusk/promises/` entry (+126 bytes; 5,946 of 16,384); template and installed copy byte-identical

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `expect_every` in the promise file and what "needs attention" means for it; the changelog: `expect_every` — the key in the promise-file example, a `status` bullet covering the line, `promise_health`'s `silence`, the admin's detail line and the widened window; `vitepress build` clean; `check-pointers` PASS; the context-tiers ship and budget pins 14/14

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/probe.ts` | new — `probeWatcher`, `WatcherBlind` |
| `apps/indusk-mcp/src/lib/promises/telemetry.ts` | `MarkSource.intakeUrl`; the probe in `readPromiseMarks`; the widened window |
| `apps/indusk-mcp/src/lib/config.ts` | `promises.jaeger.otlp_url` |
| `apps/indusk-mcp/src/bin/commands/promises.ts`, `lib/promises/watch.ts`, `lib/promises/health.ts`, `src/tools/plan-tools.ts` | the blind state; needs-attention for `expect_every` |
| `apps/indusk-mcp/src/lib/promises/registry.ts` | `expect_every` |
| `apps/indusk-mcp/src/lib/always-on/heartbeat.ts` | new — beat, state, transitions |
| `apps/indusk-mcp/src/lib/always-on/schedule.ts`, `pass.ts`, `lib/telemetry/server.ts` | the beat in the pass; `INDUSK_WATCHER_STALE_MS` |
| `apps/indusk-admin/src/lib/promise-health.ts`, `components/bars/labels.ts` | the blind and expect-every chips |
| `apps/indusk-mcp/skills/catchup.md`, `.claude/skills/catchup/SKILL.md` | the blind line |
| `.indusk/promises/every-commit-evaluated.md` | `expect_every` |
| tests | `watcher-probe`, `watcher-catchup-skill`, `watcher-heartbeat-server`, `watcher-expect-every`, admin `http-watcher-blind` |

## Notes

- **A named server needs its intake address, and the ADR did not name one.**
  `promises.jaeger` holds the query URL and a credential; a deployed server's
  OTLP intake is a different door. This impl adds an optional
  `promises.jaeger.otlp_url` and reads a named server without it as *watcher
  blind* — no deployed server exists yet, so nothing that works today stops
  working.
- **A7 freezes Jaeger rather than stopping the server.** The pass lives in the
  server's process; stopping it would stop the thing that must notice. A
  `SIGSTOP`ed Jaeger answers nothing, which is both "the read fails" and
  "no beat lands", and `SIGCONT` restores it with its storage intact.
- **The probe cache is per process.** CLI runs are separate processes and each
  probes once; the admin daemon and the MCP server are long-lived and probe at
  most twice a minute per source (A4).
