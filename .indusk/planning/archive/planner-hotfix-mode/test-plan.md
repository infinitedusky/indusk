---
title: "Planner Hotfix Mode — Test Plan"
date: 2026-07-01
status: accepted
---

# Planner Hotfix Mode — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean hotfix mode is working. Each assertion names the mechanism by which it will be tested. The assertions become the source rows for the impl's `## Test Trajectory` table.

## Behavioral Assertions

| ID | Assertion (observable behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Writing a hotfix Phase 1 with every gate section deferred (`skip-reason: hotfix — deferred to Phase 2 backfill`) is accepted, not blocked, when the plan's gate policy is `auto`. | vitest subprocess (spawn `validate-impl-structure.js` with a synthetic Write event, assert exit code 0) |
| A2 | The identical Phase 1 content is blocked, with an error naming the missing gate content, when gate policy is `strict` or `ask` — hotfix does not get a blanket bypass of gate-policy discipline; the bypass only works because the hotfix template sets `auto` itself. | vitest subprocess (assert exit code 2, stderr names the blocked section) |
| A3 | Before this plan ships: writing `workflow: hotfix` in an impl.md is silently treated as a full feature plan — all four gate categories required, none skippable even when Phase 1's content would otherwise qualify for hotfix's lighter set. | vitest subprocess (regression baseline — captures today's real behavior against the unmodified hooks) |
| A4 | After this plan ships: the same `workflow: hotfix` frontmatter is recognized on its own terms — verification + document required, otel conditional on the project's `otel.role`, context not required — not feature's full set. | vitest subprocess |
| A5 | A hotfix plan's Ship phase, with zero trajectory rows targeting it, can be closed / advanced past without any test needing to pass first. | vitest subprocess (`check-gates.js`, assert exit code 0 on phase-advance edit) |
| A6 | In a hotfix plan shaped Ship → Backfill → Close, checking Close's own trivial item is blocked while Backfill's trajectory row is unresolved (state `planned`/`writable`/`written`), with an error naming the row — and succeeds once that row reaches `passing`. (Correction: an earlier draft of this assertion described Backfill itself as directly blocked from closing; empirical testing found `check-gates.js`'s Gate B only fires on a *later* phase's item-check, so the mandatory-backfill guarantee requires the trailing Close phase to exist as that trigger — see `research.md`.) | vitest subprocess (`check-gates.js`, assert exit code 2 with row named, then exit 0 once `passing`) |
| A7 | Running the existing `/falsify` and `/retrospective` skills against a completed hotfix plan works end-to-end, with no special-casing added to either skill. | manual smoke — dogfood: author a toy hotfix plan against a real trivial bug in this repo, carry it through create → PR → backfill → falsify → retrospective |
| A8 | Following the documented hotfix flow produces a branch named `hotfix/{slug}` — not `fix/{slug}`, and not a worktree directory. | manual smoke (same dogfood as A7 — observe the branch actually created) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|--------------------|-----------------------|
| U1 | Creating the retroactive plan folder for a hotfix fires a `hotfix-shipped` highlight, so the eval agent can later materialize a Graphiti episode for "a hotfix went out." | Skill behavior is prose instructions interpreted by the agent, not code — there's no harness that runs a full Claude session against a skill prompt and asserts which MCP tools it calls, for any skill in this project. | The A7 dogfood is a real run-through of the skill; if the highlight call is missing during that dogfood, it will be visibly absent from `.indusk/highlights.jsonl` and caught during this plan's own retrospective. Longer-term, the existing eval-agent scorecard rubric is the standing compensating control for "did the agent follow the skill's prescribed behavior" across all skills, not just this one. |

## Notes

- A known, pre-existing, out-of-scope limitation: nothing structurally stops an agent from marking a Phase 2 trajectory row `skipped` without a real justification, which would defeat the backfill intent. This is not new to hotfix mode — the same gap exists for every workflow today (only formally-declared "Deferred Verification" rows require the three-field `reason`/`would require`/`mitigation` justification; a plain `skipped` state on an ordinary trajectory row does not). Not fixing this here — it's a systemic property of the trajectory system, flagged for awareness, not a defect this plan introduces.
- A3 and A4 are a before/after pair on the same fixture set — A3 must be captured (and shown red for the right reason: silent fallthrough to `feature`'s stricter set) before any hook code changes, so the fix in A4 has something real to flip green against.
