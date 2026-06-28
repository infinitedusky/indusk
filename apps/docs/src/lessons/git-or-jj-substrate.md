---
title: "Lessons from git-or-jj-substrate"
date: 2026-06-28
---

# Lessons from `git-or-jj-substrate`

The dual-SCM plan shipped in 1.28.9 and was reversed six weeks later by [Git-Only Substrate](../decisions/git-only-substrate). The shipping-and-reversal sequence is the lesson — and it produced three more carrying-forward observations the successor plan's lessons page doesn't fully cover.

## Plans that ship and get superseded are substrate, not failures

This was the second plan in dusk's history archived under this pattern (the other: `handoff-multi-agent` superseded by `handoff-multi-agent-section-shape` mid-flight). Three signals where it happens:

1. **Falsification finds the headline claim was wrong** — this plan's Phase 6 H1 invalidated the brief's "eval-trigger already works on git" assertion
2. **Direction shifts from "support both" to "drop one"** — git-only-substrate reversed the dual-SCM model entirely
3. **Better design emerges before publish** — handoff-multi-agent → section-shape

In all three cases the predecessor's substrate work persisted into the successor. The dual-SCM work proved `lib/scm/` was the right abstraction layer; git-only just deleted the jj branch. Plans don't have to "succeed permanently" to be valuable — they can be substrate that informs the next plan.

**The discipline that follows**: when reviewing a plan that proposes substrate work, ask whether shipping it would be valuable EVEN IF it gets superseded six weeks later. If yes, ship. If no, sharpen the brief until the substrate value is decoupled from the long-term direction.

## Brief author bias is the most expensive bug class in plan authoring

The brief asserted three things about `eval-trigger.js`:

1. *"It tries jj first and falls back to git rev-parse HEAD for the change ID"*
2. *"It matches both `jj describe` and `git commit` as trigger commands"*
3. (Implicit) *"It's installed correctly by `indusk init`"*

All three were wrong. The change-ID extractor used `jj log` with no git fallback; the filter rejected `git commit`; `init.ts` had a hardcoded `hookFiles` array that omitted `eval-trigger.js`.

Each claim looked plausible to the brief author because the *design intent* was that the hook should support both SCMs. The actual code didn't match the intent. The bug was found in Phase 6 falsification, costing ~4 hours of investigation + fix work. Verification at brief time would have been ~20 minutes — a ~12× cost ratio.

**The discipline**: a brief is not accepted until every "X already works / X currently does Y" claim is annotated with a source-code line range, a quoted snippet, or a test name. Reading source code while writing a brief is a different cognitive operation than reading it during impl: the brief author is biased toward confirming the plan. See the `brief-author-bias-ground-truth-verification` personal lesson for the full discipline.

## Two-round falsification compounds

Phase 6 found H1 + H2 (load-bearing claim wrong + UX gap). Phase 7 re-falsified Phase 6's fixes and found H3 + H4 + H5 — three more real production-relevant bugs in code that had just been written and tested.

Each round produced different failure modes:
- Round 1: load-bearing brief claim wrong; CLI UX gaps
- Round 2: substring false-positive on shell command strings; missing exit_code check on PostToolUse hooks; init-before-SCM footgun with no user signal

The marginal cost of a second round was ~half a day. The marginal value: 3 more real bugs caught + a structural discipline established (the InDusk eval-trigger hook now has both word-boundary regex AND exit_code skip — both Phase 7 findings).

**The discipline**: any plan touching infrastructure that fires on user actions (hooks, watchers, schedulers) gets a minimum of two falsification rounds. The compounding signal is real and orthogonal — round N's findings aren't a subset of round N-1's.

## Related Personal Lessons

Three lessons from this plan were promoted to `.claude/lessons/` (cross-project applicability):

- `brief-author-bias-ground-truth-verification.md` — ground-truth-verify every "X already works" claim before brief acceptance
- `anchor-shell-trigger-patterns-no-substring.md` — never use `String.includes` for shell-command trigger detection; use anchored regex
- `graceful-degrade-architecture-trap.md` — graceful-degrade for substrate decisions defers the harder commitment question and pays compounding cost

These are the cross-project versions of the predecessor-specific observations above.
