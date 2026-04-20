---
title: "Falsify Phase Authoring — Test Plan"
date: 2026-04-20
status: accepted
---

# Falsify Phase Authoring — Test Plan

## Purpose

The assertions here become the impl's Test Trajectory. Scope is bugfix — tight assertion set (5 behavioral rows + 1 untestable), mechanisms favor unit + manual-dogfood. The skill file itself is markdown instructions to the agent, so its "behavior" is demonstrated through dogfood on real plans, not executable-test coverage.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| **A1** | Running `/falsify {plan}` against a plan whose impl has all prior phases terminal appends a new phase to impl.md (named with a recognizable falsification prefix like `### Phase N+1: Falsification — {summary}`) containing trajectory rows for the hypothesis tests + implementation items for the fixes + standard Verification / Context / Document gates. | manual dogfood (run `/falsify admin-ui-hosting` after shipping this plan and inspect the resulting impl.md diff) |
| **A2** | Running `/falsify {plan}` does NOT execute any tests — no vitest runs, no subprocess spawns beyond what investigation needs (read, grep, glob). The skill's output is the modified impl.md, nothing else. | manual dogfood (observe no test-runner output during the skill session) |
| **A3** | After `/falsify` runs, the plan's impl status is still `in-progress` (not flipped to `completed`) because the newly authored phase is unchecked. | manual dogfood (check frontmatter after `/falsify`) |
| **A4** | `/work {plan}` picks up the falsification phase exactly like any other phase — authors writable-at-phase tests at phase start, runs items, flips trajectory states at phase close. No special-case handling for falsification-origin phases. | manual dogfood (run `/work admin-ui-hosting` after `/falsify` authors a phase; observe normal phase-close behavior) |
| **A5** | `/retrospective {plan}` closes a plan whose impl has all phases terminal — including a falsification phase authored under the new flow — without requiring a `falsification.md` file in the plan folder. | manual dogfood (take a plan through `/falsify` → `/work` → `/retrospective`, assert retrospective completes without looking for `falsification.md`) |
| **A6** | A legacy plan that already has a `falsification.md` file (e.g., an archived plan) still passes `/retrospective`'s Step 0 gate via the existing `isFalsificationComplete` check — no regression. | vitest unit (feed a fixture planRoot with `falsification.md` marked complete; assert gate passes) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| **U1** | "The new flow feels better than the old flow" — the subjective argument that phase-authoring beats ritual-with-log for discipline preservation under time pressure. | Subjective. A controlled A/B with humans is outside the scope of a skill-change plan. | The three pending retros (admin-ui-hosting, indusk-admin-ui, eval-agent-mcp-access) each get a natural side-by-side: we'll feel the difference across three plans in a short window. Retrospective captures whether the new flow held up or dragged. |

## Notes

- **Most mechanisms are "manual dogfood"** — the skill file is markdown instructions, not executable code. The only things that can be unit-tested are the retrospective gate's `isFalsificationComplete` path (A6 regression) and any helper we add.
- **A6 is the only hard regression test** — we need to prove the legacy-`falsification.md` plans don't break when the retrospective gate grows the new "all phases terminal" branch. Fixture-based vitest, cheap to write.
- **No "admin UI renders the new phase correctly" assertion** — the admin UI renders all phases via the existing phases parser; a falsification phase is just a phase. If the phase appears, it renders. We catch failures there via A4's dogfood (which opens the admin UI on the affected plan and sees the phase).
- **Phase-naming convention is free-form for agents**. The skill instructs the agent to use a recognizable prefix (`### Phase N: Falsification — ...`) but the validator doesn't enforce a specific word. Adding validator enforcement is a v2 polish if naming drift becomes a problem.
- **No assertion about the skill's "terminate when I can't form another hypothesis" exit criterion** — that discipline stays in the skill text but isn't programmatically testable. It's the same commitment the current skill makes; we carry it forward verbatim.
