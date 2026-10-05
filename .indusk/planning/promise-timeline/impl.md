---
title: "Promise timeline — Implementation"
date: 2026-10-05
status: in-progress
trajectory: required
test_phases: required
gate_policy: ask
---

# Promise timeline — Implementation

## Goal

The Promises page draws each promise's history per source — runs, breaks,
whether each break is fixed, and each incident as a band — and the chips stop
calling a fixed incident's promise *violated*. Built on [adr.md](adr.md)
D1–D7; asserts [test-plan.md](test-plan.md) A1–A13.

## Scope

### In Scope
- `fixed` on incidents, `indusk promises fix`, `check`'s refusal (D1)
- `violationState`, one rule for chip and timeline (D2)
- The `fixed` health and the per-source chip rules (D3)
- `readTimeline` and the `promises/timeline` subpath (D4)
- The admin's store, the strips, bands, window and source parameters, the
  old-break marker, group summaries and collapse (D5–D7)

### Out of Scope
- A mark from `check-gates.js` (`gates-ran-at-every-checkoff` stays hollow —
  Sandy, 2026-10-05)
- The deployed demo app (demo-app-template); A13 uses the server's smoke marks

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | `fixed` on incidents; `promises fix`; `check` refusal; `violationState` | registry, incidents |
| Build Phase 2 | `readTimeline` (sliced, compact), `promises/timeline` subpath | `sources.ts` resolution, `markedSpans`' query |
| Build Phase 3 | `fixed` health; production and local chip rules | `violationState`, `readHealth` |
| Build Phase 4 | the admin store; strips, bands, `?window`/`?source`, no-marks row, "at least", old-break marker | `readTimeline`, `violationState` |
| Build Phase 5 | group summary strips and collapse; the deployed smoke | Build Phase 4's strips |

## Test Trajectory

The markup contract, fixed here so the HTTP tests can be written before the
page exists: a strip is `data-testid="promise-timeline"` with `data-promise`,
`data-source` and `data-window`; a cell is `data-testid="timeline-cell"` with
`data-state` (`green | red | purple | empty`), `data-from` (ISO) and, when its
read hit the limit, `data-at-least`; a band is `data-testid="incident-band"`
with `data-incident`, `data-from` and `data-to`; the old-break marker is
`data-testid="open-break"`; a promise with no marks shows
`data-testid="timeline-empty"`.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | Each marked promise has a strip over the chosen window (24 h, 7 d, 30 d): upheld runs green, violations coloured, each in the cell for its time | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A2 | A promise no run marks says so instead of drawing an empty strip | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A3 | A violation's cell is red while its incident is open or unrecorded, and purple on the next refresh after the incident is marked fixed | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A4 | Each incident is a band from when it opened to when it was fixed; an open one runs to now | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A5 | `promises fix <id>` records when the incident was fixed and returns the promise to enforced; `promises check` refuses a fixed incident with no time, naming the file | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/promises-fix.test.ts |
| A6 | An unfixed violation older than the window still shows "violated N ago — open" on its row and every group above it | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A7 | Rows group by plan or domain; a collapsed group shows the worst state per cell (red over purple over green) and opens to its promises | Build Phase 5 | Build Phase 5 | skipped | apps/indusk-admin/src/components/PromiseGroups.test.tsx |
| A8 | With a production server the page opens on production's strip; local's is selectable and says how far back it reaches; a source that cannot be read says so and the other is still drawn | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A9 | Production's chip is red for an unrecorded or open violation, and `fixed` once every recent violation's incident is fixed | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A10 | Local's chip is red while the newest local run is a violation and green once a newer run holds, with no incident | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A11 | A window with more runs than one query returns is drawn end to end, and a cell that may be missing runs says "at least" | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A12 | After the first read of a window, a refresh with nothing new transfers only marks newer than those held, measured on the wire | Test Phase 1 | Build Phase 4 | passing | apps/indusk-admin/src/__tests__/http-promise-timeline-transfer.test.ts |
| A13 | Pointed at the deployed server after a break and its fix, the page shows red, then purple, then green | Build Phase 5 | Build Phase 5 | passing | manual: `pnpm --filter @infinitedusky/indusk-mcp e2e deployed-smoke`, then the admin against `promises.jaeger` |
| A14 | Two strips built a minute apart place the same run in a cell with the same `data-from`: cell boundaries are fixed to the clock, not measured back from now | Phase 0 | Build Phase 6 | written | apps/indusk-admin/src/lib/timeline-strip.test.ts |
| A15 | A run whose `indusk.project` names this project with different separators (`timeline-smoke` for `timeline_smoke`) counts as this project's — never dropped silently | Phase 0 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/promise-timeline-reader.test.ts |
| A16 | After `promises.jaeger.url` is repointed to another server, the page draws only the new server's runs — none held from the old one | Phase 0 | Build Phase 6 | written | apps/indusk-admin/src/__tests__/http-promise-timeline-falsify.test.ts |
| A17 | A violation whose span ended five minutes before it reached Jaeger turns the chip red and its cell red within one refresh after it arrives | Phase 0 | Build Phase 6 | written | apps/indusk-admin/src/__tests__/http-promise-timeline-falsify.test.ts |
| A18 | `promises fix` refuses an incident whose root cause is unwritten, naming it, and changes nothing | Phase 0 | Build Phase 6 | written | apps/indusk-mcp/src/__tests__/promises-fix.test.ts |
| A19 | A production window that one refresh cannot read within its budget is drawn after a few refreshes: each refresh keeps what it read and continues from there | Phase 0 | Build Phase 6 | written | apps/indusk-admin/src/__tests__/http-promise-timeline-falsify.test.ts |

### Deferred Verification

- **U1 — the strip reads at a glance**
  - reason: whether red reads as "broken now" and purple as "was broken, fixed" to someone new is a comprehension judgment
  - would require: a person who has not seen InDusk, looking
  - mitigation: Sandy reviews screenshots of the 7-day strip at Build Phase 4's close (a Verification item); the demo rehearsal (indusk-demo step 7) is the final check

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author A1–A6 and A8–A12 over boundaries — the admin over HTTP, the CLI — against real Jaeger fixtures with marks at chosen times. Every subject is reachable today and answers wrongly; A7 and A13 are deferred below.

- [x] Create/confirm this plan's worktree (`indusk worktree create promise-timeline`, which records the assignment) — worktree-per-plan default
- [x] `apps/indusk-mcp/src/__tests__/promises-fix.test.ts`: A5 over the CLI in a temp project — `promises fix <id>` exits 0, the incident has `status: fixed` and a `fixed` time within the test's run, the promise is `enforced`; a hand-written `status: fixed` with no `fixed` makes `promises check` exit 2 naming the file
- [x] `apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts`: A1–A4, A6 and A11 against one local daemon, the registry and incidents written by the test:
  - one promise with upheld marks 2 h and 26 h ago and a violation 5 h ago (A1, three windows);
  - one promise with no marks (A2);
  - a violation whose incident is open, then edited to `fixed` between two requests (A3, A4);
  - a violation 3 days old with an open incident, viewed in the 24 h window (A6);
  - with `INDUSK_PROMISE_QUERY_LIMIT=5`, 12 marks in one 15-minute cell (A11)
- [x] `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts`: A8–A10 on `startTwoSources` — production's strip by default and `?source=local`; production stopped (A8); production's chip `fixed` once its incident is fixed (A9); local's chip green after a newer upheld local mark (A10)
- [x] `apps/indusk-admin/src/__tests__/http-promise-timeline-transfer.test.ts`: A12 — `promises.jaeger` names a counting proxy in front of an always-on server holding 200 marks; two requests 6 s apart with nothing new; the second moves under 5 % of the first's bytes
- [x] Run each and read each failure; a red that is a load or setup failure is not authored — each fails on its own assertion; the page test's precondition (every promise's row renders, status 200) passes, so its reds are absences, not a broken page

#### Deferred to Build Phase 5

- **A7** — *moved to [contract-ui](../contract-ui/brief.md) on 2026-10-05 with the groups it tests; state `skipped` here for that reason.* A browser component test of the grouped strips (`PromiseGroups.test.tsx`), which imports the component Build Phase 5 introduces; the file would fail to load today. Body reviewed:

  ```tsx
  // render <PromiseGroups> with two promises in one plan: one red at cell 3, one purple at cell 5
  // collapse the group → its summary strip has data-state="red" at cell 3 and "purple" at cell 5
  // expand → both promise strips are visible; switch grouping to domain → the same promises regroup
  ```

- **A13** — needs the full timeline and the deployed server's smoke marks; a manual smoke at close, run against the real deployment.

#### Test Phase 1 Verification

- [x] A1–A6 and A8–A12 fail on their own assertions (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-fix`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline`); the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js`)
- [x] The deferred A7 body reviewed: it will compile at Build Phase 5, and it asserts the worst-state summary and the regrouping — it imports only `PromiseGroups`, which Build Phase 5 introduces, and its three checks are the worst state per cell when collapsed, both strips when expanded, and the regroup by domain
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change (tests and a fixture field only)

### Build Phase 1: an incident records when it was fixed

- [x] `lib/promises/incidents.ts`: `fixed` read and written as an ISO time; `violationState(traceId, incidents)` → `unrecorded | open | fixed`, by the incidents' recorded traces
- [x] `bin/commands/promises.ts`: `indusk promises fix <incident-id>` — `status: fixed`, `fixed: <now>`, and the promise back to `enforced` (its `incidents` list kept) when no other incident of it is open; refuses an unknown or already-fixed id by name
- [x] `lib/promises/check.ts`: refuse `status: fixed` without `fixed`, naming the file
- [x] The two fixed incidents get `fixed` from the commit that fixed them (`i-2026-09-15-gates-silently-off`, `i-2026-10-03-every-commit-evaluated`), so this repository's own `promises check` stays green

- [x] (discovered) Two existing tests built incidents in the old shape: `promises-falsification.test.ts`'s "a fixed incident on an enforced promise is history" fixture now says when it was fixed (its assertion — no state refusal — unchanged), and the admin's `Promises.test.tsx` incident literal gains `opened`, `fixed` and `traces` (caught by the admin's own type-check test, A25, against the fresh build)

#### Build Phase 1 Verification

- [x] A5 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-fix`); `pnpm promises:check` exits 0 on this repository — 3/3; check: 4 promises, 3 incidents, exit 0. `pnpm test`: mcp 1702 passed / 5 skipped with the leak guard clear; the admin's only failures are this plan's own red rows (A1–A4, A6, A8–A12), as planned
- [x] `tsc --noEmit` clean; Biome clean on the changed files — both packages, against the fresh build

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Context

- [x] planning: `.indusk/planning/CLAUDE.md` (via its template) — "an incident is closed with `indusk promises fix`, which records when"

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/promises.md`: `promises fix`, the `fixed` field, `check`'s refusal; `apps/docs/src/guide/promises.md`, "The loop": it ends with `promises fix`

### Build Phase 2: one reader for a window

- [x] `lib/promises/timeline.ts`: `readTimeline(root, registry, { source, from, to, timeoutMs })` → per source, per behaviour promise, `{ at, outcome, traceId }[]` plus slices that stayed full (`atLeast`); a full query splits at its midpoint down to a one-minute slice. The query limit reads `INDUSK_PROMISE_QUERY_LIMIT` (test setting; default `TRACE_LIMIT`)
  - As built: the per-query read moved out of `markedSpans` into `marksBetween` (`telemetry.ts`) — the project filter, the alias renaming and the limit, written once — and both readers call it; `queryLimit()` reads the setting for both
- [x] Source resolution and failure per source through `sources.ts` (`resolveMarkSources`), the probe not repeated
- [x] `package.json` `exports`: `./promises/timeline`

#### Build Phase 2 Verification

- [x] (no tests flip at this phase — reason: infra) — the reader is drawn by Build Phase 4, where A1 and A11 pass. Its own test (written at `src/__tests__/promise-timeline-reader.test.ts`, in the system tier, where real-daemon tests are listed — not beside the module) passes here, 3/3, against a real local daemon and a real always-on server: 12 marks in one minute with the limit at 5 come back as one `atLeast` slice; 12 spread over an hour come back complete; a stopped source is that source's failure
- [x] The existing promise suites unchanged (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status`); `tsc --noEmit` clean — with `always-on-source` and `monitor-watch` too, since `markedSpans` now reads through `marksBetween`: 5 files, 36 passed, leak guard clear

- [x] Shape (`apps/indusk-mcp/src/lib/promises/timeline.ts`): extract `readSourceWindow` — one source's window across every promise, service and alias — out of `readTimeline`'s `Promise.all` callback, where it sat six levels deep; rule: a unit with two jobs (resolving sources, and reading one) names the second. Done; the reader's test still 3/3

#### Build Phase 2 Context

- [x] mcp: `apps/indusk-mcp/CLAUDE.md` — "a window of marks is read through `readTimeline`, never by re-reading traces in a reader of its own"
  - As built: a guard instead — `apps/indusk-mcp/CLAUDE.md` is at 16,294 of its 16,384 bytes, and the rule is enforceable: `promise-marks-one-query.test.ts` fails when any file but `telemetry.ts` builds an `indusk.promise` tag query, and carries `lesson: a-window-of-marks-is-read-through-one-query`

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/promises.md`, the library paragraph: `promises/timeline`, slicing and `atLeast`

### Build Phase 3: the chips

- [x] `apps/indusk-admin/src/lib/promise-health.ts`: `PROMISE_HEALTHS` gains `fixed`; production's (and a one-source project's) chip by `violationState` — red for unrecorded or open, `fixed` when every violation in the window is fixed; local's chip, when production exists, by the newest local run
  - As built: `healthOf` takes the registry's incidents and a `HealthRule` (`incidents | newest`); `ruleFor(read, reads)` picks it per source, and the sidebar's `redPlans` uses the alarm source's, `incidents`. `violationState` reaches the admin through a new `promises/incidents` subpath
- [x] `components/bars/labels.ts`: `PROMISE_HEALTH_CHIP.fixed` — purple, "fixed", aria "violated in the window, every incident fixed"

#### Build Phase 3 Verification

- [x] A9 and A10 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline-sources -t "A9|A10"`); the existing admin promise suites unchanged (`http-promise-health`, `http-promise-sources`, `http-promise-remote`, `http-watcher-blind`); admin `tsc` clean — A9, A10 pass; the four suites and the component tests: 34 files, 159 passed; admin `tsc` clean against the fresh build; leak guard clear

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Context

- [x] guard: A9 carries `lesson: a-fixed-break-is-history-not-health` — a chip that counts fixed violations as live calls a mended promise broken for a week

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the `fixed` chip; production's and local's rules

### Build Phase 4: the strips

- [x] `apps/indusk-admin/src/lib/promise-timeline.ts`: the store (D5) — per project, source and promise: marks held, deduplicated by trace, and the range covered; a request reads only uncovered ranges and the last minute again; pruned to 30 days. **The chips read from it too**: A12's red measured the second load at half the first (120 KB of 242 KB) because `readHealth` re-reads the whole quiet window each time its cache expires; the store holds the quiet window for every source, and the chips colour from it
  - As built: `readHealth` probes each source (`probeSources`, new in `sources.ts`) and takes its marks from the store over `healthWindowMs` (the health window rule, now one definition in `sources.ts`); `asMarkedSpans` turns held marks into what the chips read. A12 passes with this item alone; the chip suites (`http-promise-health`, `-sources`, `-remote`, `http-watcher-blind`, A9, A10) still pass through it
- [x] `components/PromiseTimeline.tsx`: the strip (96 / 84 / 90 cells; worst state per cell by `violationState`), bands from `opened` to `fixed` or now, the no-marks row, `data-at-least` cells, the old-break marker (D6, D7)
  - As built: the cell logic is pure and separate (`lib/timeline-strip.ts`: `buildStrip`, `WINDOWS`, `parseWindow`); the component only renders it. A promise with no runs held at all is `TimelineEmpty`; one whose runs are all older than the window draws empty cells and, when a break among them is unfixed, the old-break marker
- [x] The Promises page: `?window` (`24h | 7d | 30d`, default `7d`) and `?source` (default the alarm source), each strip under its promise's row; local's view says how far back its marks reach; a failed source says so in place of its strip

- [x] (discovered) The timeline tests' `row()` helper ended a promise's slice at the next `data-promise` attribute — and the markup contract puts one on the strip too, so a row's slice stopped just before its own strip and no cell could ever be seen. The helper now ends at the next *other* promise; no assertion changed

- [x] (discovered) A busy event loop read as a closed port: `isPortListening` timed out at 500 ms on the admin's own loop while `next dev` rendered, `daemonStatus` took that as a dead daemon and deleted its record, and the watcher-blind page test (`http-watcher-blind`) began failing once the timeline added a read to the render. A timed-out connect is now tried once more before it is believed; a refusal stays final (`lib/telemetry/status.ts`). Reproduced first in `lib/telemetry/port-listening.test.ts` (the loop held 700 ms), which carries `lesson: a-timeout-measured-on-a-busy-loop-is-not-a-fact-about-the-port`
- [x] (discovered) Four comments read as promise tokens (`per promise: marks` → a promise named `marks`), so this repository's `promises check` — and `promises-cli.test.ts` A15 — refused them; reworded

#### Build Phase 4 Verification

- [x] A1–A4, A6, A8, A11 and A12 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline`); `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear — all ten timeline tests pass; `pnpm test`: mcp 1705 passed / 5 skipped, admin 361 passed; `test:system`: 133 passed; both end with the leak guard's all-clear
- [x] U1: screenshots of the 7-day strip (one red, one purple, one green-only promise) reviewed by Sandy — shown on this repository's own data (`every-commit-evaluated`: purple for the fixed 2026-10-03 incident, red for the open 2026-10-05 one, green runs between), as a screenshot and live from the worktree's admin; Sandy, 2026-10-05: "this is good for now"

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. The store (`lib/promise-timeline.ts`), the pure strip (`lib/timeline-strip.ts`) and the component (`PromiseTimeline.tsx`) each have one job; `Promises.tsx` grew a strip row and `TimelineControls` — whether that file splits is /cleanup's

#### Build Phase 4 Context

- [x] `apps/indusk-admin/CLAUDE.md`: the timeline's reads go through the store (`lib/promise-timeline.ts`), which reads only uncovered ranges — never a whole-window read per request

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/admin-ui/overview.md`: the timeline — cells, colours, bands, windows, sources — with the Mermaid diagram of a cell's colour from its incident's state

### Build Phase 5: the deployed smoke

*Trimmed 2026-10-05 (Sandy): collapsible groups and A7 moved to
[contract-ui](../contract-ui/brief.md), which reorganises the admin around
premises, promises and phases — groups built here on today's plan-and-domain
table would be rebuilt there.*

- [x] A13: run the deployed smoke's break and recovery (`e2e/deployed-smoke.e2e.test.ts` against the Fly server), record the incident, `promises fix` it, and read the page against `promises.jaeger`

  - As built (2026-10-05, 13:41–13:58 UTC): driven by hand, not by the smoke test, which also restarts the Fly machine. A scratch project (`~/code/sandbox/timeline-smoke`) named the Fly server; marks were sent straight to its intake (`checkout-never-charges-twice`, service `checkout-demo`, `deployment.environment: production`); `promises watch --source deployed` opened `i-2026-10-05-checkout-never-charges-twice` and reopened `checkout-v1`; the root cause was written and `promises fix` closed it. Screenshots in `.playwright-mcp/a13-{1-red,2-open,3-fixed,4-green-after}.png` at the repository root. Two findings for falsify: marks carrying `indusk.project: timeline-smoke` were dropped silently, because the project id is normalised to `timeline_smoke`; and cell boundaries are measured back from now, so a run moves to the next cell between refreshes

#### Build Phase 5 Verification

- [x] A13 observed on the deployed server — red, then purple after `promises fix`, then green runs — with a screenshot in the impl — observed: red (unrecorded), red with the band to now (incident open), purple with the band ending at 13:41:49 (fixed), then green runs in the next cell; the production chip `violated`, then `fixed`
- [x] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear — no code changed after the Build Phase 4 run at `b7f82bf9`, whose result stands: `pnpm test` mcp 1705 / admin 361, `test:system` 133, both all-clear

- [x] Shape (Build Phase 5): skipped — this phase changed no code; A13 was run against the deployed server and recorded here

#### Build Phase 5 Context

- [x] `.indusk/current.md`: the Promises page draws each promise's history; `every-commit-evaluated`'s `fixed` incidents read purple

#### Build Phase 5 Document

- [x] `apps/docs/src/changelog.md` Unreleased — Added: the promise timeline, `indusk promises fix`; Fixed: a fixed incident's promise no longer reads *violated*

### Build Phase 6: Falsification — late runs, moving cells, a repointed server, a window too big to read

**Goal**: verify whether the attested state holds against six failures found by reading the built code and by A13 against the real server. Each row is one hypothesis, red today; each item is the fix it needs.

- **A14**: `buildStrip` sets `start = now − window`, so cell boundaries move with every request; a run changes cell between refreshes (A13: the 13:41 break moved from the last cell to the one before).
- **A15**: `marksBetween` drops a run whose `indusk.project` differs from `markProjectId` by exact comparison; the id is normalised (`timeline-smoke` → `timeline_smoke`), the tag an application writes is not, and nothing says a run was dropped (A13's first marks).
- **A16**: the store is keyed `project + source name`; a changed `promises.jaeger.url` keeps the old server's marks and covered range, so the new server's view starts from the old one's history.
- **A17**: each refresh re-reads only the last minute (`OVERLAP_MS`). A run that reaches Jaeger later than that — a buffered exporter, an app reconnecting — lands in a range already covered and is never read; the chips read the same store, so a late violation never turns a chip red until the admin restarts. A regression: before this plan the health read re-read its whole window on every cache expiry.
- **A18**: `fixIncident` does not check the root cause; `promises fix` exits 0 on an incident whose root cause is still the unwritten line, and the next `promises check` refuses the registry.
- **A19**: a window read is all or nothing. When the first read of a busy production window exceeds the 2 s budget, nothing read is kept and the covered range does not move, so every refresh starts over and fails the same way; the strip — and, through the store, the chip — never appear.

- [ ] `lib/timeline-strip.ts`: cells aligned to the clock — the last cell ends at the next multiple of the cell width, `start = end − window` (A14)
- [ ] `lib/promises/telemetry.ts` `marksBetween`: compare a run's `indusk.project` after the same normalisation `markProjectId` applies (A15)
- [ ] `apps/indusk-admin/src/lib/promise-timeline.ts`: key the store by the source's query URL as well as its name, so a repointed server starts empty (A16)
- [ ] The store re-reads a tail long enough for late runs — the last `LATE_MS` (10 minutes) on every refresh, not one — and the whole health window once every `FULL_REREAD_MS` (10 minutes), so a run later than the tail is still read within a bounded time (A17)
- [ ] `fixIncident`: refuse an incident whose root cause is the unwritten line, naming it (A18)
- [ ] The store reads a window newest first, in slices, and keeps each slice as it lands: a refresh that runs out of budget keeps what it read, extends the covered range by it, and the next refresh continues from there; the strip draws what is covered and says how far back that reaches (A19)

#### Build Phase 6 Verification

- [ ] A14–A19 pass (`cd apps/indusk-admin && pnpm exec vitest run src/lib/timeline-strip src/__tests__/http-promise-timeline-falsify`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-fix`; `… --config vitest.system.config.ts src/__tests__/promise-timeline-reader`); A1–A13 still pass
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear

#### Build Phase 6 Context

- [ ] guard: A17 carries `lesson: a-store-that-reads-only-what-is-new-must-still-read-what-arrives-late`; `apps/indusk-admin/CLAUDE.md`'s store rule gains "and re-reads a late tail"

#### Build Phase 6 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: cells fixed to the clock; late runs; a busy window drawn progressively. `apps/docs/src/reference/cli/promises.md`: `promises fix` refuses an unwritten root cause; the project id compared normalised

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/incidents.ts` | `fixed`, `violationState` |
| `apps/indusk-mcp/src/bin/commands/promises.ts` | `promises fix` |
| `apps/indusk-mcp/src/lib/promises/check.ts` | refuse a fixed incident without `fixed` |
| `apps/indusk-mcp/src/lib/promises/timeline.ts` | new — `readTimeline` |
| `apps/indusk-mcp/package.json` | `./promises/timeline` export |
| `apps/indusk-admin/src/lib/promise-health.ts` | `fixed` health; per-source chip rules |
| `apps/indusk-admin/src/lib/promise-timeline.ts` | new — the store |
| `apps/indusk-admin/src/components/PromiseTimeline.tsx`, `PromiseGroups.tsx` | new — strips, groups |
| `apps/indusk-admin/src/app/p/[project]/promises/page.tsx` | `?window`, `?source`, the strips |
| `.indusk/promises/incidents/*.md` | `fixed` on the two fixed incidents |

## Dependencies

- promise-sources (archived) — `sources.ts`, the per-source chips, the two-sources fixture.

## Notes

- A12's proxy must count bytes on the wire; a counter inside the admin would prove the counter (test-plan Notes).
- `i-2026-10-05-every-commit-evaluated` is open while this is built; it is closed with `promises fix` once 1.59.1 is seen holding — the command's first real use.
- The admin package's name is `indusk-admin`, not `@infinitedusky/indusk-admin`: its commands above run from its directory (lesson `verify-pnpm-filter-name-matches-package-json`).
