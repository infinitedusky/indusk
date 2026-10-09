---
title: "model-per-phase — Retrospective"
date: 2026-10-09
---

# model-per-phase — Retrospective

## What We Set Out to Do

Build each phase on the model its tier names in the config without anyone switching models by hand, escalate a phase that keeps failing, and end every plan boundary by naming the command for a new session (brief: four promises, one existing promise that must not break).

## What Actually Happened

Shipped as planned in three build phases plus the test phase: `workflow.tiers` and `workflow.steps.<step>.tier`, the `**Tier**: <tier> — <reason>` line and its validator rule, `indusk plans model`, `/work` handing each phase to a subagent on that model with a three-miss escalation, and `indusk plans next-session` (also the last line of `plans approve`). 36 files, +1444/−53 on the branch. The model was observed once (A5): an Agent called with `model: "haiku"` reported `claude-haiku-5-5`, so the skill hands phases to subagents instead of printing `/model`.

## Getting to Done

- **Falsification found four real holes in the first build** (Build Phase 3): an Edit of only the tier line skipped the validator entirely (its fast path exits when the edit text has no heading or item); the escalation the skill told `/work` to write added a second tier line and the first one won; a tier the config had no model for was answered `session`; and a bad tier config crashed `plans model` with a stack trace while the hook accepted the same project.
- **Cleanup found one defect and one gap** (Build Phase 4): `nextSession` re-decided what the build's `nextBuildStep` already decides and disagreed with it on blockers, phases waiting on a person and open rows; and nothing tied the hook's copy of the tier rule to the package's. The parity test found, on its first run, a third divergence (the hook did not flag an unknown step key).
- **Closing the plan**: `promises confirm` refused eight times. The tokens were in the tests but not at the code that keeps each promise, and the A5 row's Test cell (a path with prose in it) read as three files. The row now says it is a live check recorded in the impl, and the promise is proven by A1–A4.
- Twice I ran `biome --write` over all of `src/` and it reformatted six unrelated files; both times I reverted before committing. No effect on history.

## What We Learned

- A validator whose fast path is "the edit text has no structure markers" is a list of the edit shapes it understands. A rule over a new line shape must add its marker or an Edit of that line alone is never checked (now in `hooks/CLAUDE.md`).
- A port that cannot import its source needs a parity test from day one: the first run of one found a divergence the build had already shipped.
- "The system chooses the model" has a gap the plan states but does not close: only `/work` phases switch automatically; plan, falsify, cleanup and retrospective still use whatever model the session is on (`workflow.steps.<step>.tier` is read and validated, nothing acts on it yet).

## What We'd Do Differently

- Ask, when writing a rule, which edit shapes reach it. The Write-shaped tests of Test Phase 1 passed for a rule that Edits never reached.
- Reuse the build's decision functions from the first commit instead of re-deriving a subset; the cleanup phase found it only because the two had already diverged.
- Put the promise token at the code site when the code is written, not at confirm.

## Insights Worth Carrying Forward

The whole-plan review step proposed in the conversation after this plan (a fresh subagent on the strongest tier reading the plan's documents and diff, advisory) is the natural next plan and builds on this one's tier config and subagent hand-off: `plan-review-subagent`.

## Quality Ratchet

No Biome rule would have caught the defects; they were behavioural. Nothing added.

Shape findings: 0 raised across the four phases, 0 judged wrong by a human. (Shape was run as a reading by the working agent in each phase, with the review recorded in the impl; falsification and cleanup then found issues Shape did not, as designed: they are cross-edit and cross-file.)

## Metrics

- Phases: Test Phase 1, Build Phases 1–4 (3 and 4 authored by falsification and cleanup).
- Trajectory rows: A1–A18, all passing.
- Files changed on the branch: 36; +1444/−53.
- Promises confirmed and enforced: 4.

## Closing notes

- No ADR (bugfix workflow), so no decision page and no Key Decisions line.
- The convention first went in the root Conventions; the 20 %-under-budget test (`context-tiers-register`) failed at 14,867 B, so it moved down a tier instead: the planning rules (`templates/planning/CLAUDE.md`) carry it, and `/work` itself prints the next-session line at each phase close. Root is back to 14,628 B.

Landed on main at 8c2ac263, 2026-10-09.
