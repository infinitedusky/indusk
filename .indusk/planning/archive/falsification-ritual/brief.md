---
title: "Falsification Ritual — A Bullshit Detector Between Impl and Retrospective"
date: 2026-04-17
status: accepted
blocked_by: []
blocks: []
---

# Falsification Ritual — Brief

## Problem

`tests-first-planning` (archived 2026-04-16) solved universal deferral: the Trajectory names the tests, and `check-gates` refuses to close a phase whose tests aren't passing. A plan can no longer lie about what it verified.

But the Trajectory only catches one class of lie. Every plan still has a second, bigger one: **the attester only writes the tests they can think of**. Happy-path thinking produces happy-path tests. Edge cases, implicit invariants, "I don't know what I don't know" — none of these show up in the Trajectory, because the author never thought to include them. The plan closes green, and the blind spots ship into production.

The Numero lesson `verification-gates-need-adversarial-framing.md` captures one instance of this — a harness that passed while the code bypassed the interface the plan claimed to validate. But the lesson's deeper point applies everywhere: **named tests can be insufficient, and the author is the last person likely to notice**.

## Proposed Direction

A new skill, **`/falsify {plan}`**, that runs between `/work` completion and `/retrospective`. Its job: take the plan's attested state ("we built X with properties P1, P2, P3…"), flip the author's goal from "prove it works" to "prove it fails", and produce currently-failing tests that *shouldn't* be possible to write if the attestation is really true.

The ritual:

1. Read the impl, the Trajectory, and the attested state ("plan says X is done; these properties hold").
2. **Loop**:
   - Derive one implicit property of the attestation. ("If X is really done, then under condition Y, behavior Z must happen.")
   - Express it as a test that would fail *right now* if the attestation has a gap.
   - Run it.
   - If it fails → you've found a gap. Decide:
     - **Fix in scope** — add a phase to the current impl, flip state back to `in-progress`, let `/work` resume.
     - **Out of scope** — spawn a new plan pointing at the gap (link it via `blocks:` so the current plan's retrospective notes the debt).
     - **Accept as finding** — if the gap is small enough and documented in retrospective (rare; usually should be one of the above).
   - If it passes → the property holds for now. Try another property.
3. Terminate when you can no longer produce a failing test whose claim is in-scope. Every failing test you *can* still produce must trace to an out-of-scope plan or an accepted finding.
4. Hand control to `/retrospective`.

### Why the ritual works

It's a bullshit detector: a device for forcing the system to find problems with itself before moving on. Three reasons it holds up:

- **Prove-failure is cheaper than prove-success.** One counterexample falsifies; coverage requires the whole space. Flipping the goal from "make it work" to "make it break" puts asymmetric effort on the side that's more productive post-completion.
- **It addresses unknown unknowns.** The author cannot enumerate properties they didn't think of. But once the goal is "find a failure," the same brain will surface properties it skipped while building. The flip is the mechanism — even the *same agent* produces different outputs under a different goal.
- **The deterrent matters too.** Knowing `/falsify` will run changes what gets written in the first place. Claims tighten, scopes narrow, edge cases move from "we'll handle it later" to "let's write the phase now." That's a welcome byproduct — it's not the purpose, but it happens.

### Bookend symmetry with the Trajectory

The Test Trajectory (from `tests-first-planning`) writes currently-failing tests at plan *start* — each row is a hypothesis that will be proved by the impl. `/falsify` writes currently-failing tests at plan *end* — each one a hypothesis that the attested state is incomplete. Start and end use the same primitive (currently-failing tests) for inverse purposes. That symmetry is the plan's testing contract, front and back.

### Same agent, different goal

Importantly, `/falsify` does not require a different perspective (no persona switch, no adversarial agent identity). The same working agent that built the plan can run the ritual, because what changes isn't *who's thinking* — it's *what they're asked to produce*. Under the goal "prove failure," the agent's attention turns to edges the "prove success" goal didn't prioritize. `complementary-personas` may later provide richer framings, but the baseline ritual works today with whatever agent is in the session.

### Building the plane while flying

The ritual explicitly allows the plan to grow mid-falsification. If a failing test surfaces a gap that should have been in the impl, the plan's impl gets a new phase, state flips back to `in-progress`, and `/work` resumes. This is intentional — it's the opposite of locking the plan at "done" and pushing discovered gaps to a separate backlog. The plan is allowed to learn during its own closure.

## Context

### Origin

- Numero lesson: [`verification-gates-need-adversarial-framing.md`](../../../.claude/lessons/verification-gates-need-adversarial-framing.md) — the PokerV2 harness example showed how named tests can rubber-stamp. This plan operationalizes the lesson as a ritual.
- Session on 2026-04-17 between Sandy and the agent: the idea crystallized through iteration. Starting from "gates that can't pass for the wrong reason" (a technique), we arrived at "a mechanism for forcing the system to find problems with itself" (a principle). The key refinements:
  - *Describe-style vs serve-style tests* — tests should express the goal, not just label it
  - *Same agent, flipped goal* — the adversarial perspective doesn't require persona switching; goal-flipping is the mechanism
  - *Bookend symmetry* — front of plan writes failing tests that will pass; back of plan writes failing tests that shouldn't be writable
  - *"Building the plane while flying"* — the ritual can grow the plan it's closing

### Relation to existing plans

| Plan | Relation |
|------|----------|
| `tests-first-planning` (archived) | Front half of the bookend. This plan is the back half. |
| `complementary-personas` | One natural instantiation of `/falsify` — personas can run the ritual with richer perspectives. Not a dependency. |
| `agent-roles` | First plan that could dogfood `/falsify` after impl completes. Could also be the second plan authored under the new shape if we ship `/falsify` before agent-roles closes. |
| Numero's codebase | The lesson originates there. This plan lands the ritual in InDusk so every project using the dev system inherits it. |

## Scope

### In Scope

- New skill `/falsify` at `apps/indusk-mcp/skills/falsify.md`
  - Reads the current plan (argument or detect from context)
  - Walks the attested state — impl goal + Trajectory rows + any "done" claims
  - Produces the goal-flipped prompt: "write a test that will fail right now, that shouldn't be possible to write if the attested state is true"
  - Loop control: user presses "another" or the skill detects "can't produce in-scope failing test"
  - Handles the three outcomes per failing test (fix in scope, spawn new plan, accept as finding)
- Skill integration: `/work` completion hands off to `/falsify` before declaring plan ready for retrospective; `/retrospective` refuses to run until `/falsify` has terminated cleanly (or been explicitly skipped with a recorded reason)
- User-facing guide: `apps/indusk-docs/src/guide/falsification-ritual.md`
  - The ritual itself: steps, loop termination, three outcomes
  - The principle: bullshit detector, prove-failure asymmetry, unknown unknowns
  - Worked example: a plan that *attested* to "state is fully recoverable on crash" and the failing test that surfaced a partial-write vulnerability
- Community lesson: point `verification-gates-need-adversarial-framing.md` at the guide so the Numero origin and the InDusk ritual are cross-linked
- Test integration with `agent-roles`: run `/falsify` against agent-roles once its impl completes, let it exercise the ritual on a real plan, use the output as the ritual's first public dogfood

### Out of Scope

- Requiring persona switching for `/falsify` (same agent works)
- Automated property derivation (the agent thinks; tooling doesn't generate properties)
- A validator rule that blocks `/retrospective` structurally (for v1, the discipline is skill-level; harder enforcement is possible later if the ritual is skipped too often)
- Changes to the Trajectory shape (Trajectory handles front half; `/falsify` is the back half without touching Trajectory structure)
- `Kind: adversarial` column on Trajectory (rejected earlier in the conversation — the ritual produces *new* rows if needed, not a new column on existing rows)

## Success Criteria

- `/falsify {plan}` exists, documented, and invokable
- Running `/falsify agent-roles` after agent-roles impl completes produces at least one failing test that surfaces a real gap (either fixed in-scope or spawning a new plan)
- `/retrospective` refuses to run until `/falsify` has terminated or been explicitly skipped
- The guide page exists, is linked from the planner docs and the Numero lesson, and explains both the mechanics and the principle
- Six months from now, a plan author running `/work` completion naturally expects `/falsify` as the next step — it's built into the rhythm, not a reminder

## Depends On

- Nothing. Ships standalone, on top of the already-shipped Trajectory shape.

## Blocks

- Nothing strictly. But `complementary-personas` will benefit — by the time personas land, the falsification ritual is already the convention, and personas become one productive *instantiator* of the ritual rather than needing to introduce the ritual themselves.

## Open Questions for ADR

1. **What's the exit criterion for the loop?** Options: (a) agent self-declares "can't produce in-scope failing test," (b) user approves termination, (c) a fixed number of attempts (e.g., "three in a row that are out of scope"). My lean: (a) + (b), agent proposes termination and user confirms.
2. **Should `/retrospective` hard-block without `/falsify`, or soft-warn?** Hard-block is strict; soft-warn leaves discipline to the team. My lean: hard-block, with a skip-reason escape hatch (same pattern as gate_policy ask-mode conversation proof).
3. **Is the falsification output stored anywhere?** Each failing test the ritual produces (and what happened to it: fixed / spawned / accepted) is worth preserving. Options: (a) a new file `.indusk/planning/{plan}/falsification.md`, (b) a section added to retrospective.md, (c) Graphiti episodes keyed by the plan. My lean: (a) + (c) — a local log for the human record, Graphiti for cross-plan learning.
4. **Does `/falsify` ever run at phase boundaries, not just plan close?** Could fire at each phase-close to catch gaps earlier. But that doubles the ritual cost and may produce noise. My lean: plan-close only for v1; phase-close is a future optimization if the skill is cheap enough.
