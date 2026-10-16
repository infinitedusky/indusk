---
title: "The nav says where a plan is — Retrospective"
date: 2026-10-16
status: completed
---

# The nav says where a plan is — Retrospective

## What We Set Out to Do

Make a plan's row in the admin nav name the step its page shows, and read *Released* only once a release shipped it. A plan built but not yet falsified read *completed* in the nav while its page said Falsify.

## What Actually Happened

- The rule for "which step is a plan at" moved from a private function in `plans/waiting` to an exported `stepAt` in `plans/steps`; the nav (`navMarkOf`/`planStage`) and Needs you both ask it. `statusToNavMark` is gone.
- Falsification was skipped with a reason (all 140 archived plans read *Closed*; no failing input found). Cleanup was skipped (small, cohesive files).
- The audit reader found two more readers of the impl's `status:` word (the project card's "work in progress" and the copied plan markdown). They were added as Build Phase 2 and fixed the same way.
- Diff: 21 files, +615/−92 against trunk at this point.

## Getting to Done

- Existing fixtures without a position read *Research* once the nav stopped trusting the status word; three tests were updated to say what their plan truly is.
- The approved-not-yet-built plan counts as "in progress" on the card because the nav marks it working; the card follows the nav rather than a second rule.
- `indusk promises confirm` refused once: `cockpit-nav.test.tsx` lacked the promise token its row names. Added.
- Rows A1, A2, A3, A5 were left `written` after Build Phase 1 and caught at close.

## What We Learned

- A hand-written status word and a derived position are two stores of one fact; any reader of the first trusts the agent to have edited it. Read progress from the derived one, keep the field as the author's declaration.
- A test that compares a reader with the function it calls proves agreement, not correctness (audit finding on A1).

## What We'd Do Differently

- Grep for every reader of the status word in the brief, not only the nav; two were found only by the audit.
- Update trajectory states when a phase closes, not at the end.

## Insights Worth Carrying Forward

Progress comes from the files (position), never from a field an agent must remember to edit.

## Shape numbers

Shape raised 0 findings across both build phases; 0 judged wrong.

## Audit findings left open (advisory)

An unreachable `plan.status` fallback in `navMarkOf` with no test; Needs you's fallback step changed from *Planning* to the next step with no row; A1/A2/A6 prove somewhat less than their promise's wording; the VS Code extension was not checked for status-word readers.

## Release

The project installs its own build; nothing published, no version bump for this close.
Landed on main at ffb58d43, 2026-10-16.
