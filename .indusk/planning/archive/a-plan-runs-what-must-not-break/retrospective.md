---
title: "A plan runs what must not break"
date: 2026-10-18
---

# A plan runs what must not break — Retrospective

## What We Set Out to Do

Under the rule `tests-never-make-us-wait` landed, each phase ran every test whose
imports reached a changed file. Touching a widely imported file ran about 100 tests,
most unrelated, and the process-starting ones in one batch overloaded the machine.
Sandy's call: run the certain, cheap set each phase (the rows and the Must-not-break
promises' tests), drop the import search, and leave choosing tests by what each test
executes to the sampler.

## What Actually Happened

One test phase and one build phase. A phase now runs its rows and the Must-not-break
tests; a landing runs every row and those tests; the `vitest related` search and its
code are gone, and so is its contract test. `indusk promises change` carries clauses,
and the promise was rewritten with three. This plan's own phase ran 9 files in 12 s,
against 102 files and about 250 s, red on load, for the phase before it.

## Getting to Done

**The cold audit found the promise still listing a test of the deleted search** and
missing the new end-to-end proof; confirming the plan's promises at close brought the
list up to date, and the stale test was deleted.

**The brief's Changes entry broke confirm.** It carried the new sentence and then a
sentence listing the clauses; the brief parser joins an entry's lines, so the entry no
longer matched the registry. The clause note moved to the brief's prose, an amendment
to re-approve.

## What We Learned

- **A brief entry is one sentence; anything after it is read as part of it.** Clause
  notes belong in prose or as clause entries, never in a Changes line.
- **The certain set is cheap.** Two Must-not-break promises meant 7 test files, against
  95 reached ones.

## What We'd Do Differently

- Write a Changes entry as the bare new sentence from the start.

## Insights Worth Carrying Forward

Choosing tests precisely is now the sampler's job (it records what each test
executes); until then a test no row names and no protected promise lists runs only when
a person or the sampler runs it.

## Quality Ratchet

No Biome rule applies. Shape findings: 0 raised (Build Phase 1 reviewed, nothing to
change), 0 judged wrong by a human.

## Metrics

- Trajectory rows: 5, all passing
- The phase's test set: 9 files, 12 s
- Falsification and cleanup skipped with reasons; audit run

Landed on main at a489d4e84, 2026-10-18. Installed with `pnpm install:local`; nothing published.
