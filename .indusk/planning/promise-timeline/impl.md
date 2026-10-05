---
title: "Promise timeline — Implementation"
date: 2026-10-05
status: approved
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
| A1 | Each marked promise has a strip over the chosen window (24 h, 7 d, 30 d): upheld runs green, violations coloured, each in the cell for its time | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A2 | A promise no run marks says so instead of drawing an empty strip | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A3 | A violation's cell is red while its incident is open or unrecorded, and purple on the next refresh after the incident is marked fixed | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A4 | Each incident is a band from when it opened to when it was fixed; an open one runs to now | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A5 | `promises fix <id>` records when the incident was fixed and returns the promise to enforced; `promises check` refuses a fixed incident with no time, naming the file | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/promises-fix.test.ts |
| A6 | An unfixed violation older than the window still shows "violated N ago — open" on its row and every group above it | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A7 | Rows group by plan or domain; a collapsed group shows the worst state per cell (red over purple over green) and opens to its promises | Build Phase 5 | Build Phase 5 | planned | apps/indusk-admin/src/components/PromiseGroups.test.tsx |
| A8 | With a production server the page opens on production's strip; local's is selectable and says how far back it reaches; a source that cannot be read says so and the other is still drawn | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A9 | Production's chip is red for an unrecorded or open violation, and `fixed` once every recent violation's incident is fixed | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A10 | Local's chip is red while the newest local run is a violation and green once a newer run holds, with no incident | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A11 | A window with more runs than one query returns is drawn end to end, and a cell that may be missing runs says "at least" | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts |
| A12 | After the first read of a window, a refresh with nothing new transfers only marks newer than those held, measured on the wire | Test Phase 1 | Build Phase 4 | planned | apps/indusk-admin/src/__tests__/http-promise-timeline-transfer.test.ts |
| A13 | Pointed at the deployed server after a break and its fix, the page shows red, then purple, then green | Build Phase 5 | Build Phase 5 | planned | manual: `pnpm --filter @infinitedusky/indusk-mcp e2e deployed-smoke`, then the admin against `promises.jaeger` |

### Deferred Verification

- **U1 — the strip reads at a glance**
  - reason: whether red reads as "broken now" and purple as "was broken, fixed" to someone new is a comprehension judgment
  - would require: a person who has not seen InDusk, looking
  - mitigation: Sandy reviews screenshots of the 7-day strip at Build Phase 4's close (a Verification item); the demo rehearsal (indusk-demo step 7) is the final check

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author A1–A6 and A8–A12 over boundaries — the admin over HTTP, the CLI — against real Jaeger fixtures with marks at chosen times. Every subject is reachable today and answers wrongly; A7 and A13 are deferred below.

- [ ] Create/confirm this plan's worktree (`indusk worktree create promise-timeline`, which records the assignment) — worktree-per-plan default
- [ ] `apps/indusk-mcp/src/__tests__/promises-fix.test.ts`: A5 over the CLI in a temp project — `promises fix <id>` exits 0, the incident has `status: fixed` and a `fixed` time within the test's run, the promise is `enforced`; a hand-written `status: fixed` with no `fixed` makes `promises check` exit 2 naming the file
- [ ] `apps/indusk-admin/src/__tests__/http-promise-timeline.test.ts`: A1–A4, A6 and A11 against one local daemon, the registry and incidents written by the test:
  - one promise with upheld marks 2 h and 26 h ago and a violation 5 h ago (A1, three windows);
  - one promise with no marks (A2);
  - a violation whose incident is open, then edited to `fixed` between two requests (A3, A4);
  - a violation 3 days old with an open incident, viewed in the 24 h window (A6);
  - with `INDUSK_PROMISE_QUERY_LIMIT=5`, 12 marks in one 15-minute cell (A11)
- [ ] `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts`: A8–A10 on `startTwoSources` — production's strip by default and `?source=local`; production stopped (A8); production's chip `fixed` once its incident is fixed (A9); local's chip green after a newer upheld local mark (A10)
- [ ] `apps/indusk-admin/src/__tests__/http-promise-timeline-transfer.test.ts`: A12 — `promises.jaeger` names a counting proxy in front of an always-on server holding 200 marks; two requests 6 s apart with nothing new; the second moves under 5 % of the first's bytes
- [ ] Run each and read each failure; a red that is a load or setup failure is not authored

#### Deferred to Build Phase 5

- **A7** — a browser component test of the grouped strips (`PromiseGroups.test.tsx`), which imports the component Build Phase 5 introduces; the file would fail to load today. Body reviewed:

  ```tsx
  // render <PromiseGroups> with two promises in one plan: one red at cell 3, one purple at cell 5
  // collapse the group → its summary strip has data-state="red" at cell 3 and "purple" at cell 5
  // expand → both promise strips are visible; switch grouping to domain → the same promises regroup
  ```

- **A13** — needs the full timeline and the deployed server's smoke marks; a manual smoke at close, run against the real deployment.

#### Test Phase 1 Verification

- [ ] A1–A6 and A8–A12 fail on their own assertions (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-fix`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline`); the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js`)
- [ ] The deferred A7 body reviewed: it will compile at Build Phase 5, and it asserts the worst-state summary and the regrouping

### Build Phase 1: an incident records when it was fixed

- [ ] `lib/promises/incidents.ts`: `fixed` read and written as an ISO time; `violationState(traceId, incidents)` → `unrecorded | open | fixed`, by the incidents' recorded traces
- [ ] `bin/commands/promises.ts`: `indusk promises fix <incident-id>` — `status: fixed`, `fixed: <now>`, and the promise back to `enforced` (its `incidents` list kept) when no other incident of it is open; refuses an unknown or already-fixed id by name
- [ ] `lib/promises/check.ts`: refuse `status: fixed` without `fixed`, naming the file
- [ ] The two fixed incidents get `fixed` from the commit that fixed them (`i-2026-09-15-gates-silently-off`, `i-2026-10-03-every-commit-evaluated`), so this repository's own `promises check` stays green

#### Build Phase 1 Verification

- [ ] A5 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/promises-fix`); `pnpm promises:check` exits 0 on this repository
- [ ] `tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 1 Context

- [ ] planning: `.indusk/planning/CLAUDE.md` (via its template) — "an incident is closed with `indusk promises fix`, which records when"

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/promises.md`: `promises fix`, the `fixed` field, `check`'s refusal; `apps/docs/src/guide/promises.md`, "The loop": it ends with `promises fix`

### Build Phase 2: one reader for a window

- [ ] `lib/promises/timeline.ts`: `readTimeline(root, registry, { source, from, to, timeoutMs })` → per source, per behaviour promise, `{ at, outcome, traceId }[]` plus slices that stayed full (`atLeast`); a full query splits at its midpoint down to a one-minute slice. The query limit reads `INDUSK_PROMISE_QUERY_LIMIT` (test setting; default `TRACE_LIMIT`)
- [ ] Source resolution and failure per source through `sources.ts` (`resolveMarkSources`), the probe not repeated
- [ ] `package.json` `exports`: `./promises/timeline`

#### Build Phase 2 Verification

- [ ] (no tests flip at this phase — reason: infra) — the reader is drawn by Build Phase 4, where A1 and A11 pass. Its own unit test, `src/lib/promises/timeline.test.ts` against a real local Jaeger, passes here: 12 marks in one minute with the limit at 5 come back as one `atLeast` slice; 12 spread over an hour come back complete; a stopped source is that source's failure
- [ ] The existing promise suites unchanged (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/promise-sources src/__tests__/monitor-status`); `tsc --noEmit` clean

#### Build Phase 2 Context

- [ ] mcp: `apps/indusk-mcp/CLAUDE.md` — "a window of marks is read through `readTimeline`, never by re-reading traces in a reader of its own"

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/cli/promises.md`, the library paragraph: `promises/timeline`, slicing and `atLeast`

### Build Phase 3: the chips

- [ ] `apps/indusk-admin/src/lib/promise-health.ts`: `PROMISE_HEALTHS` gains `fixed`; production's (and a one-source project's) chip by `violationState` — red for unrecorded or open, `fixed` when every violation in the window is fixed; local's chip, when production exists, by the newest local run
- [ ] `components/bars/labels.ts`: `PROMISE_HEALTH_CHIP.fixed` — purple, "fixed", aria "violated in the window, every incident fixed"

#### Build Phase 3 Verification

- [ ] A9 and A10 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline-sources -t "A9|A10"`); the existing admin promise suites unchanged (`http-promise-health`, `http-promise-sources`, `http-promise-remote`, `http-watcher-blind`); admin `tsc` clean

#### Build Phase 3 Context

- [ ] guard: A9 carries `lesson: a-fixed-break-is-history-not-health` — a chip that counts fixed violations as live calls a mended promise broken for a week

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the `fixed` chip; production's and local's rules

### Build Phase 4: the strips

- [ ] `apps/indusk-admin/src/lib/promise-timeline.ts`: the store (D5) — per project, source and promise: marks held, deduplicated by trace, and the range covered; a request reads only uncovered ranges and the last minute again; pruned to 30 days
- [ ] `components/PromiseTimeline.tsx`: the strip (96 / 84 / 90 cells; worst state per cell by `violationState`), bands from `opened` to `fixed` or now, the no-marks row, `data-at-least` cells, the old-break marker (D6, D7)
- [ ] The Promises page: `?window` (`24h | 7d | 30d`, default `7d`) and `?source` (default the alarm source), each strip under its promise's row; local's view says how far back its marks reach; a failed source says so in place of its strip

#### Build Phase 4 Verification

- [ ] A1–A4, A6, A8, A11 and A12 pass (`cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-promise-timeline`); `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear
- [ ] U1: screenshots of the 7-day strip (one red, one purple, one green-only promise) reviewed by Sandy

#### Build Phase 4 Context

- [ ] `apps/indusk-admin/CLAUDE.md`: the timeline's reads go through the store (`lib/promise-timeline.ts`), which reads only uncovered ranges — never a whole-window read per request

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the timeline — cells, colours, bands, windows, sources — with the Mermaid diagram of a cell's colour from its incident's state

### Build Phase 5: groups, and the deployed smoke

- [ ] `components/PromiseGroups.tsx` (client island): each group's summary strip (worst state per cell among its promises) and collapse, over the page's existing grouping buttons; the old-break marker carried to every group above (D7)
- [ ] Author A7 from the Test Phase 1 register (`PromiseGroups.test.tsx`)
- [ ] A13: run the deployed smoke's break and recovery (`e2e/deployed-smoke.e2e.test.ts` against the Fly server), record the incident, `promises fix` it, and read the page against `promises.jaeger`

#### Build Phase 5 Verification

- [ ] A7 passes (`cd apps/indusk-admin && pnpm exec vitest run src/components/PromiseGroups`); A13 observed on the deployed server — red, then purple after `promises fix`, then green runs — with a screenshot in the impl
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear

#### Build Phase 5 Context

- [ ] `.indusk/current.md`: the Promises page draws each promise's history; `every-commit-evaluated`'s `fixed` incidents read purple

#### Build Phase 5 Document

- [ ] `apps/docs/src/changelog.md` Unreleased — Added: the promise timeline, `indusk promises fix`; Fixed: a fixed incident's promise no longer reads *violated*

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
