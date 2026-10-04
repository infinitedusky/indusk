---
title: "The watcher proves it is watching — Retrospective"
date: 2026-10-03
status: completed
---

# The watcher proves it is watching — Retrospective

## What We Set Out to Do

On 2026-10-01 a test's leaked Jaeger answered on the default ports, and every
promise reader reported this repository's behaviour promises healthy after
seven silent days. Every reader checked that Jaeger *answered*; none checked
that it *heard*. The brief asked for three things:

- a check at read time, locally, where no process runs between sessions to
  send a beat;
- a heartbeat on the always-on server's own clock, with Slack told once when
  it goes stale and once when it recovers;
- an opt-in `expect_every` for promises that are known to fire regularly.

## What Actually Happened

58 commits on `plan/watcher-heartbeat`, 45 files, +2,046 / −99. The package
code, skills and tests are 29 files, +1,756 / −44.

- **The probe** (`lib/promises/probe.ts`, called first in
  `readPromiseMarks`). Every read sends one `watcher.probe` span through the
  source's intake and reads it back from the query API. When it does not come
  back, the reader says *watcher blind* and gives no counts. All five readers
  say it: `status` and `watch` exit 2, `promise_health` returns `blind: true`,
  the admin shows a banner and hollow chips, and catchup puts it ahead of the
  roadmap. A probe that comes back is trusted for 30 s per source.
- **A config key the ADR had not named.** A deployed server's intake is a
  different address from its query API, so this plan added
  `promises.jaeger.otlp_url`. A named server without it reads blind.
- **The server heartbeat** (`lib/always-on/heartbeat.ts`). Every pass beats into
  the server's own intake and reads the newest beat back. Slack hears once on
  going blind and once on recovering. The record is `watcher-state.json`.
- **`expect_every`**, judged by one function, `silencePastExpectation`.
  `every-commit-evaluated` declares `1d`.
- **The admin shows blindness as a state of the read, not a chip colour.** The
  same goes for `expect_every`'s silence. Both stay out of the label map,
  because the chip describes a promise and blindness describes the backend.
- **Falsification found six things to check, and five were real failures:**
  - `--since` was widened by `expect_every`, so it counted outside the window it
    printed.
  - A restart while blind announced a recovery that had not happened.
  - An unwritable state file repeated the alarm on every pass.
  - The admin waited the probe's full 5 s against its own 2 s budget.
  - `expect_every` on a state promise was accepted and silently did nothing.
  - **The sixth was not confirmed:** heartbeat result ordering. Its test passed
    when written; the window was narrowed anyway.
- **Cleanup** removed two three-way duplications, `newestMark` and the test
  helper that reads `status` output.

## Getting to Done

- **The evaluator stashed uncommitted work in this worktree.** While grading a
  commit it ran `git stash`. That took this impl's latest edit and an
  uncommitted `telemetry.ts` re-export, which the admin commit had compiled
  against only because the file was still in the working tree. Recovered by
  checking the files out of the stash commit.
- **The evaluator ran this plan's tests in this worktree three times**, holding
  the always-on server's port 16685 each time. Every system-tier verification
  waited for its runs to end.
- **Two always-on test files collide on `main` too.** Jaeger's gRPC query port
  is not set in the server config, so it is always 16685, and
  `always-on-server` and `always-on-falsification` cannot run in parallel.
  Every server file now runs alone; a configurable port is a follow-up.
- **A test from an earlier plan caught a copy this plan wrote.** Day-always-on's
  check that the Jaeger-URL normalization is written only once
  (`always-on-cleanup`) failed on two copies this plan wrote.
  `normalizeJaegerUrl` replaced them.
- **A test cache hid the behaviour under test.** A4, which counts probes, read
  zero, because an earlier test in the same process had already cached the
  probe. A4 got its own daemon.
- **The end-to-end suite caught a fixture the build missed.** The retrospective
  ran `pnpm e2e` for the context-tiers check, which this plan's `CLAUDE.md`
  edits require. That check passed, but `day-always-on.e2e` named a server
  without `otlp_url` and read *watcher blind*, as designed. Build Phase 1 had
  swept named-server fixtures in `src/` and the admin, not `e2e/`. Fixed; all 9
  e2e tests pass.
- **The validator read another plan's row label.** "A29" in a Verification note
  was taken as a reference to a row in this plan's table, and the edit was
  refused until it was reworded.

## What We Learned

- **Reachable is not listening.** A health check that only reads cannot tell an
  empty backend from a deaf one, so it reports the reassuring answer exactly
  when it knows least. Send something and require it back.
- **An alarm must not travel the path it reports broken.** It must speak on a
  change of state, prove it can record that state before speaking, and never
  let a restart stand in for evidence. Two of those four rules came from
  falsification, not authoring.
- **An evaluator that grades a branch in the branch's own worktree mutates
  it.** Not only does it collide on ports and locks: it ran `git stash` on
  another agent's uncommitted work.
- **A per-process cache makes tests in one file depend on their order.** A
  later test inherits an earlier test's state. A test about a cache needs a
  fresh key.
- **A single-definition test from an earlier plan caught this plan's copies.**
  The rule-of-three tests pay off on plans that never knew they existed.

## What We'd Do Differently

- **Read the deployed shape before accepting the ADR.** The intake URL was
  missing from D1. Writing the reader's call for a named server would have
  surfaced `otlp_url` at decision time instead of mid-build.
- **Commit every file an item touches before checking it off.** The re-export
  missed the admin commit, and the evaluator's stash is what revealed it.
- **Give a timed test a timeout budget from its first draft.** The admin's 2 s
  read was known; the probe's own wait was not checked against it until
  falsification.

## Insights Worth Carrying Forward

- The evaluator-in-worktree problem has now cost three plans time and once
  nearly lost work. It needs its own plan: run the evaluator against a
  snapshot, and never let it run mutating git commands.
- The server's unset gRPC port means two always-on servers on one machine
  cannot start. That matters for tests today, and for per-workbench servers
  if two ever share a host.

## Quality Ratchet

- No recurring lint or type errors; Biome reformatted on write as usual. No
  new rule warranted: the copied URL normalization was caught by an existing
  single-definition test, which is the right enforcer for that class.
- **Shape**: 6 findings across 6 phases (the probe's wait, `watcherTransition`,
  the attention line, `tryWriteState`, and two left-as-is records), 0 judged
  wrong. No streak.

## Metrics

| | |
|---|---|
| Trajectory rows | 15, all passing (A1–A15); A12 passed when written |
| Commits | 58 on the plan branch |
| `pnpm test` | mcp 1,675 / 5 skipped, admin 345, `promises check` clean, guard all-clear |
| `pnpm test:system` | 27 files, 102 tests, guard all-clear |
