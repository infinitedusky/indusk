---
title: "Promise timeline — Retrospective"
date: 2026-10-05
---

# Promise timeline — Retrospective

## What We Set Out to Do

The Promises page showed one chip per source, and the chip could not tell a
live break from a fixed one: a promise read *violated* for a week after its
fix landed ([brief](brief.md)). The plan set out to show each promise's
history (every run, every break, and whether each break is fixed), read from
the source that keeps it, without re-reading the whole window on every
refresh ([ADR](adr.md)).

## What Actually Happened

Built, across five build phases plus falsification and cleanup:

- **A compact, sliced reader** (`lib/promises/timeline.ts`). It reads one
  source's window through the one query, `marksBetween`, and halves a full
  query down to a minute so a busy window says "at least" rather than a
  wrong count.
- **One rule for a violation's state**, `violationState`: unrecorded, open or
  fixed. The chip and the strip share it. Incidents record `fixed:` through a
  new command, `promises fix`.
- **The admin store** (`lib/promise-timeline.ts`), which reads only what it
  has not read. The chips read through it too (A12), so a refresh with
  nothing new moves under 5 % of the first load's bytes.
- **The strip**: 96, 84 or 90 cells; the worst state per cell; incident bands;
  an "old break" marker. Window and source live in the URL.
- **A purple `fixed` chip.** Production's chip follows incidents; local's
  follows the newest local run.

Diverged from the plan:

- **Grouping moved out.** Build Phase 5's grouping of the table moved to
  `contract-ui`, which replaces the table with the premises → promises →
  phases hierarchy. Its row, A7, is skipped.
- **The chips joined the store.** That was found while building (A12), not
  planned.
- **A rule became a test.** The `marksBetween` one-query rule could not fit
  the mcp `CLAUDE.md` budget, so it became the guard test
  `promise-marks-one-query.test.ts`.

The plan touched 36 code and doc files, +2,854 / −116, in 47 commits on one
day.

## Getting to Done

- **The live check found what fakes could not.** A13 ran the plan against the
  deployed Fly server: red, then open, then purple, then green. On the way it
  found that a run tagged `timeline-smoke` was dropped as another project's,
  because the project id is normalised (`timeline_smoke`) and the tag was
  compared raw. Nothing had said a run was dropped. That became falsification
  row A15.
- **Falsification found a regression this plan introduced (A17).** The store
  re-read only the last minute. A violation reaching Jaeger later than that,
  from a buffered exporter or a reconnecting app, landed behind the covered
  range and was never read, so the chip stayed green. Before this plan the
  health read re-read its whole window on every cache expiry. The
  byte-saving change made the watcher able to miss a violation.
- **A read was all-or-nothing (A19).** A window too slow for one refresh
  failed every refresh. It is now read newest first, in slices, keeping each
  slice as it lands.
- **Smaller fixes:**
  - Cells moved with the clock (A14).
  - A repointed server kept the old server's marks (A16).
  - `promises fix` accepted an unwritten root cause (A18).
- **Unplanned:**
  - An admin test went flaky when `isPortListening`'s 500 ms timeout fired on
    a busy `next dev`; fixed with one retry.
  - The admin type-check passed only against a stale build.
  - A stale worktree `node_modules` leaked daemons.

## What We Learned

- **An incremental reader keyed by event time must re-read late arrivals.**
  "New" means when it arrived, not when it happened. Saving bytes introduced
  a missed violation, the worst failure a watcher can have.
- **A filter that drops must normalise both sides, and should say it
  dropped.** A silent drop reads exactly like a quiet promise.
- **A cache keyed by a name outlives what the name points at.** Key it by the
  resolved thing, here the query URL.
- **The suite got slow because every assertion went through the outermost
  door.** This plan added three admin test files that boot `next dev` and
  Jaeger servers. Together with promise-sources' they make up about 190 s of
  the admin suite's 247 s. Each asserts a rule about what a chip or cell shows
  for a set of runs, which a fake reader and a fake clock could check in
  milliseconds. Two of our own rules combined to cause it: "assertions are
  behavioural" and "prefer the boundary for a real red". Sandy named the cost
  as waiting on every phase. The fix is the `test-kinds` plan.
- **One live check against the real deployed system is worth more than many
  booted servers.** A13 found A15. No faked test would have, and no booted
  test did.

## What We'd Do Differently

- **Give the store its clock and reader as inputs from the first phase.**
  Every store row could then have been a unit test. As it is, `readWindow`
  is about 150 lines, and its tests take minutes.
- **Pick each test's mechanism by the question it asks.** The test plan put
  rule assertions (A9, A10, A12, A16, A17, A19) in HTTP-against-`next dev`.
  Only "does the page render the strip" needed the page.
- **Name late arrivals in the ADR.** The ADR's store decision (D5) named
  "spans indexed late" and allowed one minute for it; nobody asked how late
  an exporter can be.

## Insights Worth Carrying Forward

- Falsification paid for itself again. Four of the six rows found real bugs
  in shipped behaviour, one of them a regression the plan itself caused.
- The test-kinds diagnosis (which kind of test answers which question, and
  when it runs) is the follow-on: `.indusk/planning/test-kinds/`, after this
  release.

## Quality Ratchet

No Biome rule would have caught these. They are logic errors (late arrivals,
un-normalised comparison, cache key), not lint-shaped. The one recurring
mechanical error was a stale build behind a type-check, which a test now
catches (A25's type-check runs against the fresh build).

Shape: **1 finding raised** (extract `readSourceWindow` out of `readTimeline`,
Build Phase 2), **0 judged wrong** by a human. Build Phase 6 recorded one
reasoned leave-as-is: `readWindow`, deferred to test-kinds' seams.

## Metrics

- Sessions spent: 1 (with compactions)
- Files touched: 36 code and doc files (52 including plan documents)
- Lines: +2,854 / −116 (code and docs)
- Trajectory: 19 rows (18 passing, 1 skipped: A7, moved to contract-ui), plus
  one deferred UX row (U1, reviewed in screenshots and at the demo rehearsal)
- Suites at close: `pnpm test` 328 files green (admin 255 s, mcp 49 s);
  `test:system` 34 files green (147 s)
