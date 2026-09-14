---
title: "Planner Hotfix Mode — Retrospective"
date: 2026-07-06
---

# Planner Hotfix Mode — Retrospective

## What We Set Out to Do

Add `hotfix` as a fifth planner workflow: a sanctioned fast path for production-down emergencies where even `bugfix`'s ceremony is too slow. Fix ships first on its own branch; the plan folder is created retroactively; a mandatory backfill phase forces tests and docs to land afterward instead of never. The explicit design goal was zero new enforcement mechanism — reuse `gate_policy: auto` and the existing Test Trajectory machinery rather than inventing something new.

## What Actually Happened

The core design held, but not in its first form. Three real corrections landed before this could be called done, each caught by actually testing the mechanism rather than assuming the design worked on paper:

1. **The originally-designed two-phase shape (Ship, Backfill-as-terminal) didn't work.** Before writing any hook code, empirical testing against the live `check-gates.js` showed Gate B (phase-close enforcement) never inspects a *terminal* phase's own trajectory rows — it only fires when a *later* phase's implementation item is checked. A two-phase hotfix would have shipped with its central promise (backfill is mandatory) silently unenforced. Fixed by adding a third, trivial Close phase whose only job is to be the "later phase" that triggers the check.
2. **The hotfix template's own Verification-section phrasing didn't satisfy the trajectory validator.** Writing the actual dogfood plan's `impl.md`, `validate-impl-structure.js` rejected the generic skip-reason phrasing for Ship/Close's Verification sections — the cross-reference-integrity rule requires an exact phrase from a fixed four-word vocabulary, and that rule is workflow-agnostic. Found and fixed during the dogfood, corrected in the template.
3. **The `workflow:` detection regex in both hooks was unanchored**, letting a frontmatter `title` containing the literal text "workflow: hotfix" silently override the real workflow value — landing on the *most permissive* workflow instead of the safe default. Found via `/falsify` after the dogfood closed, using the same bug class (and the same fix shape) as a previously-fixed `rationale_baseline` substring bug elsewhere in this codebase.

None of these three would have been caught by writing tests against the *design* — all three were caught by testing the *implementation*, twice with empirical hand-repro before writing any code, once via the falsification ritual after the mechanism was built and dogfooded for real.

Separately, this session also hit a genuine concurrent-session git collision: another live session was actively committing to a different branch (`workbench-setup-command-phase-1`) in the same working directory while this plan's docs were being authored. HEAD ping-ponged mid-session and a commit landed on the wrong branch. Resolved via `git revert` (additive, safe under concurrency) plus recreating the contaminated branch fresh off `origin/main`, rather than any destructive rewrite — moved all subsequent work into isolated `git worktree`s for the rest of the session.

## Getting to Done

The dogfood (`.indusk/planning/archive/stale-indusk-docs-path/`) was the real proof: a genuine bug (20+ stale `apps/indusk-docs` path references left over from an old rename), shipped on `hotfix/stale-indusk-docs-path`, a real PR (#11), a real retroactive plan, a real regression test, and a real falsification pass that found the fix hadn't reached the published npm package or docs site — closing that gap took a whole extra Falsification phase inside the dogfood plan itself, including a blocked-and-deferred row (npm publish, no credentials in this environment) handled honestly rather than marked passing.

## What We Learned

- **Adding a new, more-permissive value to an existing enum-matched frontmatter regex changes the risk calculus of any pre-existing anchoring gap.** The `workflow:` regex's lack of anchoring wasn't new — but before this plan, misdetection fell back to `feature` (the strictest, safest default). After adding `hotfix`, the same gap could misdetect *into* the most permissive workflow. When extending a fixed-vocabulary regex with a new value, re-examine the regex's anchoring specifically in light of what the new value is permitted to skip.
- **When a concurrent-session git collision happens, prefer additive recovery (`git revert`, fresh branch off a known-good point) over destructive rewrite (`git reset --hard`), even under time pressure** — the repo's own safety hook blocked exactly this instinct, correctly. Isolating subsequent work in a `git worktree` per branch eliminates the collision class entirely rather than just recovering from it once.

## What We'd Do Differently

- Verify a new workflow-template's Verification-section phrasing against the trajectory validator's actual accepted vocabulary *before* writing the full template into the skill doc, not while authoring the first real plan against it — would have caught correction #2 a session earlier.
- When adding a value to any existing fixed-vocabulary regex, check anchoring as a standing step, not an afterthought discovered by chance during falsification.

## Insights Worth Carrying Forward

The dogfood plan's own two lessons (`hotfix-content-fix-must-reach-distribution-channel`, `trajectory-no-tests-phrase-is-fixed-vocabulary`) were captured during its own retrospective and aren't duplicated here. This retrospective's two lessons (regex-anchoring risk calculus, additive-recovery-under-collision) are net new.

## Quality Ratchet

No Biome rule opportunity — the regex-anchoring bug is a semantic pattern (frontmatter-key regex needs line-anchoring when values gate enforcement strictness) that doesn't map to any of Biome's built-in rules, and a custom rule for this narrow a pattern isn't worth the maintenance cost for two call sites.

## Metrics

- Sessions spent: 1 (long session covering research → brief → test-plan → ADR → 4 impl phases → falsify → retrospective, plus the nested dogfood plan's full lifecycle)
- Files touched: ~12 across both hook files (source + installed copies), `planner.md`, `git.md`, docs-site reference page, published ADR, CLAUDE.md, 1 new test file (8 assertions)
- Trajectory: 8 rows, all passing
- Nested dogfood plan: `stale-indusk-docs-path`, archived separately with its own 4-row trajectory (3 passing, 1 deferred as `scheduled-review`)
