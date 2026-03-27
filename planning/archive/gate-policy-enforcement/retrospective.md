---
title: "Gate Policy Enforcement — Retrospective"
date: 2026-03-27
---

# Gate Policy Enforcement — Retrospective

## What We Set Out to Do
Make the `ask` gate policy actually enforced at both write time and execution time. Previously, `ask` and `auto` were behaviorally identical — the agent could pre-fill `(none needed)` anywhere.

## What Actually Happened
Both hooks were updated cleanly:
- `validate-impl-structure.js` now rejects `(none needed)` at write time in `ask` mode
- `check-gates.js` now requires conversation proof format in `ask` mode

The skill updates (work, plan, toolbelt) were straightforward — documenting the three modes and the conversation proof format.

## Getting to Done
Implementation was clean. The verification items for Phase 1 (manual testing of hook blocking behavior) were never run — they remain unchecked. The hooks were tested organically during subsequent plans (excalidraw-extension, vitepress-extension) which used `gate_policy: ask` and exercised the enforcement.

## What We Learned
- Conversation proof format (`asked: "..." — user: "..."`) is parseable by hooks and readable by humans
- The three-mode system (strict/ask/auto) covers the spectrum from fully supervised to fully autonomous
- Organic testing through real usage (subsequent plans) is more thorough than scripted manual tests

## What We'd Do Differently
- Would have added automated tests for the hooks rather than manual test items in the impl checklist
- The unchecked verification items are a gap — should convert to unit tests

## Insights Worth Carrying Forward
- Hook-based enforcement is the right layer for process rules — it's harder to bypass than instructional text
- Manual test items in impl checklists tend to get skipped. Prefer automated tests or remove them.

## Outstanding Work
- 5 manual verification items in Phase 1 remain unchecked. These should be converted to automated hook tests in a future plan.
