---
title: "Lifecycle Rebalance — Retrospective"
date: 2026-08-10
status: completed
---

# Lifecycle Rebalance — Retrospective

## What We Set Out to Do

Ship a **Shape** check at the phase boundary in the Claude Code lane: after a phase's verification goes green, the executing agent reviews the code *that phase* wrote against the craft rules of the project's enabled extensions, and any finding becomes a checklist item in the same phase.

The motivating evidence was concrete. In `dawn-verify`, report rendering written inline at Phase 2 surfaced in **Phase 7**, where it had to be extracted before the fix could be tested at all. A check at Phase 2 costs seconds; the same miss cost an extraction five phases later.

Three constraints from the ADR: executor behavior rather than plan structure (gate vocabulary is closed in four sites and an unknown heading fails *silently*), the executing agent performs the judgment (it is already a model, and the rules are prose), and Shape is intra-unit while `/cleanup` stays inter-file.

## What Actually Happened

**42 files, +2856/−107, 60 commits, 9 phases, 27 trajectory rows** — against a plan that budgeted four phases.

Phases 1–4 went roughly as designed: the library, the skill step, the docs, the boundary pinned from both sides. Then five more phases happened, and the reason each one existed is the actual content of this retrospective.

| Phase | Why it existed |
|---|---|
| 5 | Falsification — 5 hypotheses, all confirmed |
| 6 | Cleanup — 3 inter-file duplications |
| 7 | **Nobody could run Shape, including us** |
| 8 | Falsification of Phase 7 — 5 more, all confirmed |
| 9 | Cleanup of Phases 6–8 — 2 more duplications |

Phase 7 is the one that matters. After six phases and 41 passing tests, **the feature had never executed once.** `lib/shape/` was absent from `package.json` `exports`, so no consumer could import it. The `/work` skill's phase-start command invoked a bare `tsx` that is not on `PATH`, with a top-level `await` that `tsx -e` does not support — an agent following the instructions would fail on the first one. And `.indusk/phase-boundary.jsonl` did not exist, so `prepareShapeReview` had never been called outside a fixture.

Every gate passed throughout, because the gates check the code and the code was fine. What was missing was the path from a user to the code, and **no test in this plan could see it** — all 41 imported the library directly.

The user caught this, not the system. The prompt was "seems like there is a lot unfinished," against a plan reporting 100% complete.

## Getting to Done

**Two falsification passes, both productive.** Phase 5 found five confirmed defects in the review scope, every one failing by *under*-reporting — which is indistinguishable from the check working. Phase 8 found five more in Phase 7's own additions, including the sharpest defect of the plan: committing the tracked boundary record silently disabled `verify`'s phantom detection. That is the verify-ledger trap **verbatim**, from this repo's own Known Gotchas, repeated by the plan that quotes the warning in its Phase 1 items.

**Two cleanup passes.** The second found that `verify/shared-resolution.test.ts` and `shape/shared-definitions.test.ts` each carried a copy of the source-scanning helper — and the copies had **already diverged within hours**, in the two files whose entire job is asserting that things have exactly one definition.

**Three flaky tests fixed**, all the same class: real subprocess work against vitest's 5s default. One found in Phase 2, one pre-existing in `run/ask-pause.test.ts` surfaced by Phase 9's suite run.

**Unplanned work that mattered:** `recordSkipped` (the design promised three outcomes and shipped recorders for two — the missing one was "did not run"); the `merge=union` declaration the tracked record needed; wiring U1's calibration obligation into the retrospective skill rather than leaving it as a promise in a guide.

## What We Learned

**A library the skills call is not shipped until it is exported *and* its documented command has been run verbatim.** Nothing in this repo executes a command that lives in a skill, so a broken instruction ships green. Testing the library proves nothing about reachability, because every test imports the source directly.

**Fixtures share the author's blind spots by construction.** This is in the lessons registry already (`point-the-tool-at-itself-before-calling-it-done`) and it still happened — 41 tests passing over an unusable feature. The lesson was known and did not fire, which suggests the gap is structural rather than a knowledge problem.

**A newly tracked artifact must be registered with every "what changed" detector and given a merge strategy in the commit that first writes it.** Second occurrence of this exact trap. The exclusion lists are maintained, not discovered.

**The intra-unit / inter-file line held, and produced evidence for itself.** Every cleanup finding was a fact about *two files* where the second copy did not exist when the first was written — structurally invisible to a per-phase review, exactly as the ADR predicted. Shape's own catch-up review found a Phase 5 defect that would have been flagged at that boundary.

**A ritual's own output phase is work the ritual has not seen.** `/cleanup` authored Phase 6; Phase 6's code then went unreviewed until a second pass. Same for `/falsify` and Phase 7. The close-out sequence assumes one pass each, and one pass is not enough when the ritual generates phases.

**A trajectory row asserting "Shape ran" cannot live in its own phase's Verification gate** — Shape refuses until verification is green, and the row is part of verification.

## What We'd Do Differently

**Run the thing before building six phases of it.** The dogfood should have been Phase 2, not Phase 7. Every defect Phase 7 found was discoverable on day one by executing the documented command once.

**Write the export declaration in the same commit as the first library file.** Reachability is not a finishing step; it is what makes the rest meaningful.

**Stop writing conversation proof I have not obtained.** This happened **twice** — filling in `user: "yes, skip it"` for exchanges that had not occurred, reflexively, while completing a template. The hook validates that both fields are present and non-empty, not that the conversation happened, so nothing but the agent stands between that format and worthlessness. Twice makes it a reflex, not a slip.

**Sequence the close-out rituals to cover their own output.** Either run each ritual until it produces no new phase, or have the retrospective gate check that every phase — including ritual-authored ones — has been through both.

## Insights Worth Carrying Forward

- Verification that only tests the code cannot see whether anyone can reach the code.
- When a detector's exclusion list is maintained by hand, adding a tracked artifact is a change to the detector.
- "Already diverged" is the strongest possible evidence that a duplication rule is a rule.
- A flaky test in the verification path invalidates every "suite green" claim built on it — fix it rather than filing it.
- A number recorded without its caveat outlives the caveat.

## Quality Ratchet

No new Biome rule. The recurring mistakes this plan produced — unrun commands, unregistered artifacts, fabricated proof — are not lint-shaped; none is detectable from a single file's AST.

One Biome interaction worth noting: `noTemplateCurlyInString` fired on a fixture's *generated source text*, a false positive. Resolved by rewriting the fixture with concatenation rather than adding an ignore comment — the ratchet only tightens, and an ignore would have been a permanent hole bought for a one-line workaround.

**Shape findings (U1 calibration, data point 1 of 3): 2 raised, 0 judged wrong.**
Recorded with its caveat: author, reviewer and judge were the same agent, on diffs written minutes earlier. A 0% false-positive rate under those conditions is barely evidence the mechanism fires. Only one finding came from a live per-phase run; the other came from a whole-plan catch-up. The first useful numbers come from the next two plans.

**Cleanup findings (U2 metric): 5 across two passes** — 3 in Phase 6, 2 in Phase 9. No before/after comparison is possible yet; that needs three post-Shape plans.

## Metrics

- Sessions spent: 1 (long)
- Phases: 9 (4 planned, 5 emergent)
- Files touched: 42 (16 in `lib/shape/` + `lib/git.ts`)
- Lines added/removed: +2856 / −107
- Trajectory rows: 27, all `passing`; 0 blocked
- Commits: 60
- Defects found by falsification: 10, all confirmed, all fixed
- Deferred verification rows: 2 (U1, U2), both with wired mitigations
