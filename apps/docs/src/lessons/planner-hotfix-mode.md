---
title: "Lessons from planner-hotfix-mode"
date: 2026-07-06
---

# Lessons from `planner-hotfix-mode`

Adding a fifth planner workflow surfaced three real corrections before it could be called done — none of them found by testing the design, all of them found by testing the implementation. Two lessons worth carrying forward from this plan specifically (the dogfood's own lessons — fixing content that lives in distributed channels, and the trajectory validator's fixed-vocabulary requirement — live on [its own lessons page](/lessons/stale-indusk-docs-path)).

## A new, more-permissive enum value changes the cost of an old anchoring gap

`check-gates.js` and `validate-impl-structure.js` both detect a plan's `workflow:` value with a regex that wasn't line-anchored. That gap wasn't new — it existed for `bugfix`/`refactor`/`feature`/`spike` before this plan touched either file. But an unanchored regex's `.match()` returns whichever occurrence comes first in the frontmatter block, not necessarily the one on the real key's line — so a `title` field containing the literal text "workflow: hotfix" (exactly the kind of title a plan *about* hotfix mode would have) could silently override the real value.

Before this plan, misdetection fell back to `feature` — the strictest, safest default. After adding `hotfix`, the same gap could misdetect *into* the most permissive workflow instead. The bug was pre-existing; the blast radius of triggering it got strictly worse the moment a more permissive option entered the vocabulary. Found via `/falsify`, fixed with the same anchoring shape (`/^key:\s*(...)/m`) already established for a different frontmatter key (`rationale_baseline`) elsewhere in this codebase.

The generalizable point: adding a value to an existing fixed-vocabulary regex isn't just "does the new value parse correctly" — it's "does the new value change what a *pre-existing* parsing gap now costs."

## Test the mechanism, not the design

Three corrections landed in this plan, and all three shared a pattern: the *design* looked right on paper and only broke when actually exercised.

- The original two-phase template (Ship, Backfill-as-terminal) looked complete — until empirically spawning the live `check-gates.js` hook against a real fixture showed Gate B never inspects a terminal phase's own trajectory rows. Caught before any hook code was written, by testing the mechanism instead of trusting the plan.
- The hotfix template's Verification-section phrasing looked like a reasonable skip-reason — until the trajectory validator rejected it at write time while authoring the actual first dogfood plan.
- The `workflow:` regex looked fine in isolation — until a deliberately adversarial fixture (a title mentioning the feature by name) was actually run against it during falsification.

None of these would have surfaced from re-reading the design more carefully. All three surfaced from running the actual code against a fixture built to break a specific assumption. The dogfood — a real bug, a real PR, a real falsification pass — is what closed the gap between "looks correct" and "is correct."
