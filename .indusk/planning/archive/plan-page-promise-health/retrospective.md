---
title: "A promise reads the same on its plan's page"
date: 2026-10-17
---

# A promise reads the same on its plan's page — Retrospective

## What We Set Out to Do

Fix a disagreement found at the close of `daemon-found-not-guessed`: its
promise read broken in the nav and on the Promises page while its own plan
page drew it green. The plan page coloured each promise from its registry
state alone, so an enforced promise was green whatever its health. The brief
promised `a-promise-reads-the-same-on-its-plan-page`: the plan page and the
brief page colour each promise by the health the Promises page shows, read
from the package's rule and the same alarm source as the nav's red dot.

## What Actually Happened

The plan's 28 commits change 27 files (+759/−28). It ran one test phase and
four build phases: the fix, falsification, cleanup and the audit's follow-up.
Seven trajectory rows (A1–A7) are all passing. `planPromiseHealth` in the
package is now the one answer that both the nav's `redPlans` and the plan
pages read. `readPlanParts` carries each promise's health, and `PlanParts`
draws the dot from the Promises page's chip colours.

**Falsification** found that the pages read promises from the plan's branch
but health from the trunk's registry. A behaviour promise new on the branch
had no health entry and fell back to green. It was fixed by handing the
branch's promises to the same rule (A4).

**Cleanup** removed three duplications: the dot colours now live beside the
chip colours, the trunk-skip rule lives only in the package, and one shared
test stand-in replaces six copies of the health-read mock.

**The audit** ran on claude-opus-5-5. A reader that had not seen the build
raised fourteen findings. Sandy took three into Build Phase 4:

- **A5.** The pages were never tested as drawn. Every page test mocked the
  health read to empty, so deleting either page's `health:` line left
  everything green. A5 renders both pages over a real project with only
  telemetry faked, and it goes red when either line is removed.
- **A6.** Falsification's fix skipped any promise name the trunk knew, so a
  promise that is a state promise on the trunk and a behaviour promise on the
  branch still drew green. It now skips only when the trunk already gives the
  promise a health. A trunk answer is never replaced, so a branch edit cannot
  quiet a trunk break.
- **A7.** The plan page counted branch-only promises and the nav did not, so
  the two could disagree. That is the exact signal the test plan gave for the
  `no-rule-of-its-own` clause breaking. The nav's red dot now reads every
  active plan's worktree promises through the same `worktreePromises` reader.

## Getting to Done

The audit's three findings were all real, and the build rituals had missed
each one. A6 is the uncomfortable one: falsification found the
branch-versus-trunk gap and fixed one case of it, and A4's wording claimed
the other case. A row's prose can claim more than its test checks, and only
a reader that compares the two catches it.

A7 widened the scope past the impl's "no change to the nav" line. That was
the right call, because the alternative was dropping branch-only promises and
letting them draw green again. It meant three browser tests that render the
layout needed the shared plan-health stand-in.

## What We Learned

- **A test that mocks the function it is supposed to prove is coverage of
  the mock.** The page tests stubbed `readPlanHealth`, the very wiring the
  promise is about. A node render over a fixture project, with only the
  network read (telemetry) faked, is cheap here and catches the deleted line.
- **When two views must agree, feed them from one input reader, not just one
  rule.** The nav and the plan page shared `planPromiseHealth` but were handed
  different promise lists, so "same rule" was not enough.

## What We'd Do Differently

- Write the page-level row in Test Phase 1. The test plan's note ("the pages
  are not started in these tests") chose the cheaper level, and it left the
  promise's actual surface untested until the audit.

## Insights Worth Carrying Forward

- A fresh-reader audit earns its cost on small bugfixes too: three real gaps
  in a plan with seven rows.

## Quality

- No recurring lint or type mistakes. One import-order fix in Build Phase 4.
  No Biome rule to add.
- **Shape:** raised 0 findings across 4 phases; 0 judged wrong by a person.

## Audit findings not taken

There were eleven, left for Sandy's call and not acted on. The main ones:

- A known-broken state promise's dot is amber where the brief says registry
  colour.
- `data-health` is a new chip attribute.
- The Promises page and the plan page draw from different fields of
  `PROMISE_HEALTH_CHIP`.
- The registry file's `tests:` stays empty until confirm.

See `audit.md`.

## Checks at close

- `pnpm test`: 2 failures, both open on trunk before this plan (`impl-corpus` A4 for `archive/nav-row-legible`, `looks-admin-approvals-hold` A11). It first also named this plan's archived impl: a Build Phase 4 task carried row labels, written by a script that bypassed the impl validator; reworded.
- Nested-context probe (`context-tiers` e2e): 4/4 passing. The wider e2e run's `day-monitor` A24 timed out waiting for Jaeger, which this plan does not touch.
