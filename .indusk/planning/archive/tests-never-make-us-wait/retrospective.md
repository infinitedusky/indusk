---
title: "Tests never make us wait"
date: 2026-10-18
---

# Tests never make us wait — Retrospective

## What We Set Out to Do

Development had slowed to a crawl on tests: `pnpm test` took about 150 s and the
retrospective ran it whole at landing, one story-frame check took 23 minutes, and a
CSS fix took five build phases. The brief promised two things, stated as what
happens rather than as times: a plan runs the tests it writes, the tests its changes
reach and the tests of what its brief says must not break, and nothing else; and a
visual test checks only the looks a change touched. The speed was the expectation,
met by degree. Running everything else behind the scenes became the next plan,
`the-sampler`.

## What Actually Happened

All of it shipped across a test phase and five build phases, in one day: 56 files,
+3,196 / −419, 67 commits.

- **A plan's test set** is computed in one place and run by one command,
  `indusk plans tests <plan> --phase N | --landing`, which says why each file is in
  it. The work, verify and retrospective skills call it instead of the whole suite.
- **A look check of what changed** traces each screen through its page's imports and
  each story through its component's; editing the admin's plan page touches 27 of
  181 looks.
- **About 190 test files** that start the command line, git or Node moved to the
  system tier; `pnpm test` went from 150 s to 33 s.

The design changed while planning, in ways worth keeping. The first draft of the
promises was times and absolutes ("under a minute", "never waits"); Sandy turned
them into literal descriptions of what happens, and the times moved to the
expectation. A third promise, that the docs would have a testing section, went in,
out and back in, and finally out: a promise that a page says something is a
commitment by the agent, and the whole approach section became its own
documentation plan for later.

## Getting to Done

**Every build phase found something at verification.** Build Phase 2's reached-tests
search only looked in the everyday tier, narrower than the clause and the ADR; a
system-tier test that imports a changed file would never have run. Build Phase 3's
own test set went red twice: once on a stale test (the always-on health tool still
expected "violations" where the command line prints "break", failing on main too),
and once because the docs site has no Vitest config and the search fell back to the
root config. Each was fixed with a test first.

**Falsification confirmed all five hypotheses.** Tests under `examples/` were
invisible to the test set; one failing file marked its whole batch failed; 55 fast
tests started Node or git through shared helpers the guard exempted; images and the
Next.js config touched no look; a changed JSON file reached no test.

**Cleanup found a correctness bug, not only shape.** Phase verification ran each
row's file from the repository root, where the system tier is not a project, so
after the move a passing system-tier test would read as red. One shared module now
runs test files for both. That reversed the earlier rule that verification reads
only exit codes: it now reads Vitest's JSON report too. The decision page records it.

**The audit found the same gap one layer deeper, and a question about scope.** The
guard still misses a helper that starts git through another helper, and it never
scanned the editor extension. Reading that finding, Sandy asked what the everyday
suite is for at all: `pnpm test` is this repository's script, not InDusk, and a
fast/slow split is a project's choice. That is to leave InDusk. Retiring the promise
that describes it showed the registry has no way to retire a promise without a
replacement; and asking what a retirement does to its dependents became the draft
plan `a-promise-can-be-retired` ("A pivot shows its reach").

**At close**, `promises confirm` refused twice: files still carried the tokens of the
two promises this plan replaces. Re-pointed or removed, it confirmed both and
retired the two old ones.

Carried, not done:
- Audit finding: a changed `package.json` or Vitest config makes Vitest's related
  search rerun a package's whole suite, both tiers.
- Audit finding: the planner's impl template still says the whole suite runs at
  landing; `quality_check` runs the whole `test` script; nothing tells a plan to use
  `looks check --changed`.
- Retire `everyday-tests-never-wait` and take the tier logic out of InDusk, once
  retiring exists (`a-promise-can-be-retired`); `pnpm test` then runs everything.

## What We Learned

- **A promise is the plain statement of what happens.** "Runs the tests it writes and
  what must not break" can be checked and does not drift; "never waits" and "under a
  minute" were the purpose, and belong in an expectation, which is met by degree.
- **A guard that exempts helpers is only as good as its view of what helpers do.** Two
  rounds of process starts hid behind helpers: directly, then helper-through-helper.
- **Narrowing what runs surfaces stale tests that nothing ran.** The health tool's
  "violations" assertion had been failing on main unnoticed; the plan's own test set
  reached it the first time a phase touched its imports.
- **Retiring a promise is a pivot.** What rested on it, what protected it and what
  cited it all move with it; today only the author decides what to look at.

## What We'd Do Differently

- **Ask "is this a project's choice or InDusk's?" before promising it.** The
  fast/slow tier split was promised by InDusk, guarded and extended through three
  phases before anyone asked whether InDusk should hold it.
- **Run the plan's own test set once at planning time.** The vitest-related, the
  no-config package and the examples-package failures were all visible the first
  time the command ran on this repository.
- **Decide what verification reads before touching it.** The cleanup changed verify
  to read a report file without revisiting the decision that forbade it; the audit
  caught it.

## Insights Worth Carrying Forward

The test set made the old suite's gaps visible: stale tests surface the first time a
change reaches them. That is the sampler's case: everything a plan no longer runs has
to be run by something, or its rot is found only when a plan happens to touch it.

## Quality Ratchet

No Biome rule would have caught these defects: they were scope, tier and path
mistakes, not lint. No rule added.

Shape findings: 3 raised (Build Phase 2: 1, Build Phase 3: 1, Build Phase 4: 1;
Build Phases 1 and 5: 0), 0 judged wrong by a human. The context file periodic pass
(one root entry moved down a tier) was not done at this close.

## Metrics

- Sessions spent: 1 day, one planning and several build sessions
- Files touched: 56
- Lines added/removed: +3,196 / −419
- `pnpm test`: about 150 s → 33 s; a phase's own set: 4 to 144 files, 3 s to 66 s
- Trajectory rows: 20, all passing
- Test files moved to the system tier: about 190
