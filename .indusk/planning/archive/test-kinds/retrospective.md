---
title: "Test kinds — Retrospective"
date: 2026-10-05
---

# Test kinds — Retrospective

## What We Set Out to Do

Every phase waited about five minutes on `pnpm test`, and Sandy named that wait
as the biggest drag on building InDusk ([brief](brief.md)). Eight admin files
booted `next dev` and real Jaeger servers to check rules about what a chip
shows, and their load forced the root suite to run its packages one after the
other. The cause was two of our own rules combined ("assertions are
behavioural", "prefer the boundary for a real red"), so the fix was a
vocabulary: five kinds of test, each with its moment, the smallest by default
([ADR](adr.md)). The plan also gave the suite two promises about itself.

## What Actually Happened

| | Before | After |
|---|---|---|
| Root `pnpm test` | about 5 min, packages serial | 53–55 s, parallel, never replayed from cache |
| Admin everyday suite | 255 s | 5 s |
| The store's and chips' nine rules | 216 s against `next dev` and Jaeger | under 0.5 s as unit tests |
| A phase's own verification | the whole suite | a few seconds |

What was built:

- **Seams.** `readWindow` and `readHealth` take an optional `Deps` (clock,
  resolve, read, probe), and the `fakeSource` test helper drives them.
- **Nine rule tests (A4–A12).** Each was seen red against its rule broken in
  the source.
- **An admin system tier.** 13 files in `vitest.tiers.ts`, run by a
  `test:system` that covers both packages.
- **The five kinds.** One definition, a hook copy pinned by a parity test, and
  `test_kinds: required` refusing a missing or unknown kind. The planner, work,
  verify and retrospective skills were rewritten to match.
- **Two promises about the suite itself.**
  - `everyday-tests-never-wait`: a guard over both packages.
  - `everyday-suite-stays-fast`: each root run is marked with its duration,
    and a run that overlapped another or failed fast is not judged.

The plan touched 45 code and doc files, +1,714 / −495, in 28 commits.

Diverged from the plan:

- **Six of the eight HTTP files were moved, not deleted.** The ADR said delete
  eight and keep one trimmed contract test. Checking every assertion first
  showed that six of the files also assert what the *page* draws (bands, the
  source switch, the sidebar's red, the banners, live refresh), which no unit
  test reached. The impl's own rule, "delete only when every assertion is
  covered", moved them to the system tier instead. Rewriting those page
  assertions as component tests is unclaimed follow-up work.
- **The guard found more than planned.** It named `LiveRefresh.test.tsx`, a
  browser test waiting on real timers, which the plan hadn't counted.

## Getting to Done

- **The new unit tests found a real bug in last release's slow-window fix.** A
  late-tail read that spent a refresh's whole budget stopped every older
  slice, so a slow window would have said "still reading" forever. The old HTTP
  test's slow proxy never slowed the tail, so it couldn't see it. The unit test
  found it in under a second.
- **A fake clock exposed a test-mock artifact.** `LiveRefresh`'s mocked
  `useRouter` returned a new object on every render, restarting the interval
  after a failure. With real timers, the extra probe happened before the test
  counted.
- **The guard's first run named false positives.** These were deadline timers
  (which fire only on failure), a hanging child process's script body, a
  comment, and a screenshot directory a failed browser run left behind. Each
  narrowed a pattern; none needed an exemption list.
- **My Key Decisions line made trunk's suite red.** It pushed the root
  `CLAUDE.md` past its 20 % budget margin. It was trimmed on both trunk and the
  branch, and the root now has 1 byte of margin.
- **This impl's own note broke its own validation.** It mentioned an old
  file's row label (`A20`), which the validator read as a reference to a
  missing row.
- **The speed mark's first live run judged nothing.** `pgrep -f vitest`
  matched the calling shell, whose command line contained the word. It now
  looks for vitest binaries and workers outside its own ancestry.
- **Falsification found four more gaps:**
  - turbo's cache replayed mcp's green whenever only admin files changed,
    hiding the guard;
  - promise-form waits (`await setTimeout(5_000)`) passed the guard;
  - the admin's tier list was read as text, so a commented-out line still
    counted;
  - a crash at startup was marked as a fast suite.
- **The evaluator kept overlapping this plan's runs.** It runs this
  worktree's suite once per commit; two runs took 114 s and 61 s instead of
  54. The mark correctly refused to judge them.

## What We Learned

- **Behavioural wording and the kind of test are separate choices.** The test
  plan's rule was right that assertions describe what an outsider sees. The
  mistake was reading that as "test through what an outsider touches". Nine
  of nine rule assertions were `unit`.
- **A seam finds what a boundary test cannot drive.** The slow-window bug was
  invisible to an HTTP test whose fake slowness happened to miss the tail. A
  unit test with a controllable clock reached it on the first run.
- **A cache keys on the files it was told about, and some tests read
  others.** turbo caching the `test` task silently disabled a guard that
  crosses packages. Cross-cutting checks are exactly the ones a per-package
  cache hides.
- **Detecting "another run is alive" by name is wrong.** The word "vitest"
  appears in shell commands and loop conditions; a process's executable path
  does not lie.
- **"Delete only when every assertion is covered" was the right rule.**
  Without it, six files' worth of page assertions would have been lost to an
  ADR sentence written before anyone had read each assertion.

## What We'd Do Differently

- **Read every assertion of a file before the ADR decides its fate.** The ADR
  said "delete eight, keep one" from a list of file names; the audit in Build
  Phase 2 changed that to "delete two, move six".
- **Plan for the evaluator sharing the worktree.** Committing item by item
  queues one evaluator run per commit in the same worktree, and they skew
  every timing this plan cared about. The known issue in `current.md` (the
  evaluator runs inside the worktree it grades) needs its own plan before the
  next plan that measures time.
- **Leave root-budget headroom in the plan.** The Key Decisions line was
  written without checking the 20 % margin, and it turned trunk red.

## Insights Worth Carrying Forward

- The kinds table and the smallest-kind default reach every future plan
  through the planner skill. Watch whether the next plan's test plan picks
  `contract` only for boundary questions.
- Follow-up candidates, none claimed:
  - the six page-level files as component tests;
  - the evaluator in its own snapshot worktree;
  - mcp's slow-without-waiting files (`workbench-split`, 44 s) if
    `everyday-suite-stays-fast` ever reads red.

## Quality Ratchet

No Biome rule would have caught these: they are a test architecture, a
cache-key assumption and a process-matching pattern, not lint-shaped. The
recurring mechanical slip was editing impl prose that the validator reads as
structure (a row label in a note). The validator caught it, which is the
ratchet working.

Shape: **0 findings raised** across six build phases, **0 judged wrong**. Each
phase recorded nothing to change, with a reason. promise-timeline, the plan
before, raised 1 and had 0 judged wrong, so there is no streak.

## Deferred Verification, at close

- **U2, the threshold.** The first real marks: two upheld (52 s, 53 s), no
  violations. Three runs were not judged because they overlapped evaluator
  runs (114 s, 61 s, and one more), which is the false alarm the overlap rule
  exists to prevent. Nothing has fired falsely; the threshold stays at 120 s.
- **U1, later plans follow the clock-and-reads rule.** Carried by the
  planner's test-plan section, the lesson, and the guard, which refuses the
  symptom.

## Metrics

- Sessions: 1
- Files: 45 code and doc files (64 with plan documents), +1,714 / −495
- Trajectory: 23 rows, all passing. 4 came from falsification (A20–A23).
- Suites at close: `pnpm test` 54 s green; `test:system` both tiers green
  (mcp 37 files, admin 13)

Landed on main at da4a2f23, 2026-10-05.
