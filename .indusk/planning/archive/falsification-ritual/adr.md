---
title: "Falsification Ritual — A Bullshit Detector Between Impl and Retrospective"
date: 2026-04-17
status: accepted
---

# Falsification Ritual

## Y-Statement

**In the context of:**
InDusk plans that close with green Trajectories but still ship blind spots because the author only wrote the tests they could think of.

**Facing:**
The "I don't know what I don't know" problem — happy-path thinking produces happy-path tests, and the author is the last person likely to notice edge cases, implicit invariants, or rubber-stamp gates.

**We decided for:**
A new skill `/falsify {plan}` that runs between `/work` and `/retrospective`, flipping the agent's goal from "prove it works" to "find a failing test." Each iteration is a targeted hunt: investigate the code, form a specific hypothesis about what should break, write the test that confirms it, run it. The loop terminates when the agent can no longer form a specific in-scope hypothesis to test — not when it runs out of candidates to throw at the wall.

**And against:**
Requiring a separate adversarial persona, automated property-derivation tooling, a Trajectory-level `Kind: adversarial` column, and a validator rule that blocks `/retrospective` purely structurally.

**To achieve:**
Bookend symmetry with the Test Trajectory — start of plan writes failing tests that pass on success, end of plan writes failing tests that shouldn't be writable if success is real — and a built-in ritual that forces the system to find problems with itself before moving on.

**Accepting:**
The same agent produces different outputs under a different goal (so no persona switch is needed), the ritual may grow the plan mid-closure (impl flips back to `in-progress` when a gap is fixed in-scope), and `/retrospective` becomes harder to reach (hard-blocks without `/falsify`, with an explicit skip-reason escape hatch).

**Because:**
Prove-failure is asymmetrically cheaper than prove-success (one counterexample falsifies), the deterrent effect of knowing `/falsify` will run tightens claims at authoring time, and the ritual is cheap enough to ship standalone today without waiting on `complementary-personas` or perspective-switching machinery.

## Context

`tests-first-planning` (archived 2026-04-16) solved universal deferral structurally — phases can't close with failing tests. But it left a deeper problem untouched: **the author only writes tests they can think of**. Happy-path thinking produces happy-path Trajectory rows, and edge cases, implicit invariants, and the "PokerV2 harness passes while bypassing the interface" class of bugs still slip through.

The session on 2026-04-17 between Sandy and the agent crystallized the shape through iteration. Starting from the Numero lesson `verification-gates-need-adversarial-framing.md` — a concrete technique — we refined toward a principle:

- **Describe-style vs serve-style tests**: tests should *express* the goal (as currently-failing assertions), not *describe* it (as labels on work).
- **Same agent, flipped goal**: the adversarial perspective doesn't require a persona switch. The same brain, asked to prove failure instead of prove success, surfaces properties it skipped while building. Goal-flip is the mechanism.
- **Bookend symmetry**: the Trajectory writes currently-failing tests at plan start that will pass on success. This ritual writes currently-failing tests at plan close that shouldn't be writable if success is real. Same primitive, inverse purpose.
- **"Building the plane while flying"**: the ritual can grow the plan mid-closure. Gaps that should have been in scope become new phases, not backlog items.
- **The deterrent is a welcome byproduct, not the purpose**: the core purpose is a mechanism for forcing the system to find problems with itself before moving on. Everything else (tighter claims, better initial writing, N-way validation) falls out of that.

This ADR formalizes the four open questions from the brief plus the baseline shape decisions.

## Decision

### 1. Name and placement

Skill name: **`/falsify {plan}`**. Placement: between `/work` completion and `/retrospective`. It is a distinct skill (not an extension of either neighbor) because the activity is distinct — it can *change* the plan, which neither `/work` (which executes the plan as written) nor `/retrospective` (which reflects after the plan is settled) does cleanly.

### 2. The ritual

The skill's core loop is **bounty hunting, not candidate generation**. The agent is not writing hopeful tests and seeing what fails — the agent is actively investigating the code to find a specific failure and writing the test that proves it. Each iteration hunts a specific target.

1. Read the impl, the Trajectory, and any "done" claims (the attested state).
2. **Investigate the code.** Read the actual implementation, the test coverage, the invariants the attestation claims. Look for a concrete thing that *should be broken* — a specific edge case not covered, a race that wasn't addressed, an interface that's bypassed, a claim that has a hole.
3. **Form a specific hypothesis.** Not "what if something doesn't work?" — "this specific condition, with these specific inputs, will violate this specific invariant." The hypothesis names the failure before any test is written.
4. **Write the test that confirms the hypothesis.** The test expresses the claim "if my hypothesis is right, this test fails; if my hypothesis is wrong, this test passes." One test per hypothesis.
5. **Run it.**
   - If it **fails** → hypothesis confirmed, found a real gap. Present the user with three outcomes (see Section 4).
   - If it **passes** → hypothesis was wrong. The attestation held against that specific attack. Go back to step 2 with a new, different hypothesis — not a retry, not a guess. The loop does not accumulate hopeful candidates; each iteration is a targeted investigation.
6. Terminate when no in-scope hypothesis can be formed — i.e., the agent has investigated and can no longer construct a specific, concrete claim about what should fail (Section 3).

The distinction matters because candidate-generation is cheap and useless — you can always write twenty more tests that might fail. Bounty-hunting is expensive and valuable — each failed hypothesis narrows the space of things that can still be broken. The ritual terminates when the agent genuinely can't find a specific attack vector to aim at, not when it runs out of candidates to throw at the wall.

The agent is the same working agent that built the plan — just asked to actively hunt failures instead of confirm success. No persona switch, no adversarial identity assumed.

### 3. Loop exit criterion

**Hybrid: agent proposes termination, user confirms.** The agent continues hunting until it self-declares "I cannot form a specific hypothesis about what should be broken that's still in-scope." At that point it presents the user with a summary of hypotheses investigated, failing tests confirmed (and their outcomes), and the areas of the code it searched without finding an attack vector. The user either confirms termination or points at an area the agent didn't investigate — not a candidate to try, but a region to hunt in.

Rejected alternatives:
- **Agent self-declares alone** — risks premature termination when the agent runs out of ideas rather than running out of gaps.
- **User approves every hypothesis before the test runs** — too much cost per loop iteration; kills the rhythm.
- **Fixed attempt count (e.g., "three fruitless hunts in a row")** — rigid; productive falsification doesn't fit a budget, and the right answer is "did we investigate thoroughly," not "did we try N times."

### 4. Three outcomes per failing test

When a failing test is found, the agent presents three options with a recommendation:

1. **Fix in scope** — add a new phase to the current impl, flip status back to `in-progress`, return to `/work`. Use when the gap is small, clearly in-scope for the original plan's goal, and the fix is direct.
2. **Spawn a new plan** — create `.indusk/planning/{new-slug}/brief.md` with the failing test as its core motivation. Link it via `blocks:` in the current plan's brief so the debt is visible. Use when the gap is large, touches unrelated areas, or deserves its own planning lifecycle.
3. **Accept as finding** — record the failing test in the falsification log (Section 5) and continue. The retrospective will surface it. Use rarely — usually should be one of the above. Accept only when the gap is small, unambiguously out-of-scope, and the cost of a new plan isn't justified.

The recommendation is the agent's to make; the decision is the user's.

### 5. Output storage

**Both a local log file and Graphiti episodes.** Reasons:

- `.indusk/planning/{plan}/falsification.md` — a human-readable record of the session: properties tried, failing tests found, outcome chosen for each, final termination rationale. Survives in the plan's archive alongside research, brief, ADR, impl, retrospective.
- Graphiti episode `falsification-{plan}-{n}` per outcome, captured via `mcp__indusk__graph_capture` to dual-write to the semantic log. Lets future plans (and the eval agent) learn from falsification patterns — what kinds of gaps got found, what attestations were fragile, which property-derivations were productive.

Retrospective links the local log; the retrospective audit (from `audit.ts`) can later be extended to review the falsification log for unresolved findings.

### 6. `/retrospective` blocks without `/falsify`

**Hard-block with an escape hatch.** `/retrospective` refuses to run against a plan whose impl is `completed` unless one of:

- `.indusk/planning/{plan}/falsification.md` exists with a terminated-cleanly outcome, OR
- The impl frontmatter includes `falsification: skipped — reason: {text}` (recorded, not silent)

The skip-reason escape hatch mirrors the `gate_policy: ask` conversation-proof pattern from the gate enforcement system. It preserves the discipline by default but allows explicit opt-out with an audit trail.

Rejected alternative:
- **Soft-warn only** — leaves discipline to team memory. We already learned (the tests-first-planning origin story) that reminders in context don't prevent the failure mode. Structural enforcement is the point.

### 7. Plan-close only, not phase-close (v1)

**`/falsify` runs at plan-close only** — between impl completion and retrospective, not at each phase boundary.

Rejected alternatives:
- **Phase-close + plan-close** — doubles the ritual cost; most mid-plan falsifications would be premature (the property doesn't hold yet because later phases haven't shipped).
- **Phase-close only** — misses the cross-phase invariants that only exist after the full impl is done.

Future optimization: phase-close falsification may become valuable once the skill is cheap and the team wants earlier feedback. Not v1.

### 8. Bookend symmetry with the Trajectory

This decision is not a new one but a formalization: **the Trajectory and `/falsify` use the same primitive (currently-failing tests) for inverse purposes**. The Trajectory writes failing tests whose passing proves success. `/falsify` writes failing tests whose *existence* (when they fail against reality) proves incompleteness. Authoring discipline at both ends of the plan uses the same skill — expressing claims as falsifiable assertions, not descriptions.

### 9. No Trajectory shape changes

This plan **does not** add a `Kind: adversarial` column to the Trajectory, does not add a validator rule requiring adversarial rows, and does not change the four existing Trajectory validator rules. Adversarial framing belongs at plan-close (where `/falsify` produces new rows or new plans); embedding it in the Trajectory itself would produce cargo-cult pair-rows at authoring time.

If `/falsify` produces failing tests that become new Trajectory rows (via the "fix in scope" outcome), those rows get added like any other row — no special column, no special status. The row is positive (it's a test that should pass); it just happens to have originated from the falsification ritual.

### 10. Same agent, no persona switch

**`/falsify` explicitly runs with the same agent that built the plan.** The mechanism is goal-flipping, not perspective-switching. When `complementary-personas` eventually lands, personas become one productive instantiator of `/falsify` (richer, more specialized goal-flips) but not a dependency. The baseline ritual ships today.

## Alternatives Considered

### Falsification requires a different agent/persona

The early framing of this plan (and the original brief's title "adversarial-verification") implied the adversary had to be a different perspective from the attester. Rejected because goal-flipping alone works: the same brain, asked to prove failure, surfaces different properties. Sandy's sleep-example was the decisive argument — the adversary's derivation of "sleep >= 8 hours" from the attestation "I slept well" doesn't require a different person; it requires the person to flip their goal from "affirm" to "check."

### Automated property-derivation tooling

Build machinery that extracts implicit properties from attestations and generates candidate assertions. Rejected because the judgment about which properties matter is exactly the thing the agent should be doing under the flipped goal. Tooling here would replace the cognitive work, not support it.

### Trajectory-level `Kind: adversarial` column

Make "adversarial" a first-class row kind in the Trajectory. Rejected because:
- Cargo-cult pair-rows at authoring time (rows created to fill the column rather than to test something real).
- Adversarial framing is a plan-close activity, not an authoring-time one.
- The four existing validator rules are sufficient for the Trajectory's purpose.

### Structural `/retrospective` block via validator

Have a validator hook that rejects `/retrospective` without a falsification record. Rejected in favor of a skill-level block with explicit skip-reason — same strength of enforcement, but the skip-reason audit trail preserves the ability to opt out in exceptional cases (a 2-line typo fix doesn't need a full falsification ritual).

### Phase-close falsification

Run `/falsify` at each phase boundary as well as plan close. Rejected for v1 because most phases' attestations aren't stable — cross-phase invariants only hold after the full impl ships. Revisit as an optimization if v1 proves valuable.

### Rename to `/adversary` or `/bullshit-detect`

Rejected. `/falsify` is precise (names the activity), neutral (not performative), and short (easy to type). "Adversary" implies a persona; "bullshit-detect" is accurate but casual. `/falsify` matches the philosophical lineage (Popperian falsification as the shape of knowledge growth).

## Consequences

### Positive

- **Unknown unknowns surface structurally.** The author's blind spots get tested by the author-with-flipped-goal, before the plan archives.
- **Deterrent tightens claims at authoring time.** Knowing `/falsify` will run makes writing loose attestations expensive — they're more likely to get caught. Claims tighten or scopes narrow.
- **Plans can grow during their own closure.** Gaps discovered in falsification can become new phases, not backlog items. The plan is allowed to learn.
- **Bookend symmetry makes the shape legible.** Front of plan: failing tests that will pass. Back of plan: failing tests that shouldn't be writable. Same primitive, inverse purpose — a single mental model covers both.
- **Works with the current agent model.** No persona dependency; ships today.

### Negative

- **`/retrospective` becomes harder to reach.** The hard-block adds a step. For small plans (typo fix, doc update), the skip-reason escape hatch is necessary but costs a few seconds of ceremony.
- **Loop termination is judgment-based.** Agent-proposes + user-confirms means the user has to spend attention at close. Not automated.
- **Two outputs to maintain (local log + Graphiti).** Small cost, but a place to drift.

### Risks

- **The agent fails to surface good properties under goal-flip.** Same brain, same training data — may produce the same blind spots under "prove failure" that it did under "prove success." Mitigation: the deterrent effect (tighter claims at authoring time) catches some of this upstream; `complementary-personas` eventually adds richer framings.
- **Falsification becomes ceremonial.** Authors learn to produce three perfunctory failing tests and terminate quickly, defeating the purpose. Mitigation: the loop explicitly continues until agent self-declares exhaustion; user confirms. Over time, retrospective audits of falsification logs can flag patterns (plans that all terminate after N=3 are suspect).
- **Mid-plan growth destabilizes planning.** Plans that keep reopening for discovered gaps never close. Mitigation: the "spawn a new plan" outcome exists precisely for gaps too large to absorb; if a plan is growing past its original scope, the ritual surfaces that as a signal to split.

## Documentation Plan

### Pages
- **New**: `apps/indusk-docs/src/guide/falsification-ritual.md` — user-facing guide covering the ritual, the principle, the three outcomes, and a worked example (e.g., a plan attesting to "state is fully recoverable on crash" with a partial-write failing test surfacing the gap).
- **Update**: `apps/indusk-docs/src/reference/skills/plan.md` (or equivalent) — add a note about the plan close ritual flow (`/work` → `/falsify` → `/retrospective`).
- **New**: `apps/indusk-docs/src/decisions/falsification-ritual.md` — the ADR-derived decision record (written during retrospective knowledge handoff).

### Diagrams
- Sequence diagram in the guide showing the bookend flow: plan authoring (Trajectory) → /work (phases flip green) → /falsify (goal-flipped loop) → /retrospective.

### Changelog
- Entry under Added: `/falsify {plan}` skill and the falsification ritual. Version bump tbd (feature addition; minor bump).

### ADR in Docs
- Yes — publishing at `decisions/falsification-ritual.md` during retrospective handoff.

## References

- `.indusk/planning/falsification-ritual/brief.md`
- `.claude/lessons/verification-gates-need-adversarial-framing.md` — the Numero lesson that's the intellectual origin
- `.indusk/planning/archive/tests-first-planning/` — the Trajectory shape this plan bookends
- `.indusk/planning/complementary-personas/brief.md` — adjacent plan that will provide richer instantiators of the ritual once it ships
