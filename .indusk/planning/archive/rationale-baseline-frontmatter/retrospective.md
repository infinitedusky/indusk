---
title: "Rationale Baseline Frontmatter — Retrospective"
date: 2026-04-19
status: final
---

# Rationale Baseline Frontmatter — Retrospective

## What We Set Out to Do

A small, urgent hook fix to unblock Numero. The `validate-impl-structure.js` hook's `validateRationaleCompleteness` rule demanded a `### Trajectory Rationale` entry for every trajectory row where `Writable at: Phase N` and `N > 0`. That's correct for plans where Phase 0 IS the writable baseline (the existing stack is the starting point), but **wrong** for plans where Phase 1 is itself the enabling work — refactors, schema migrations, scaffolding plans. Numero's `table-lifecycle-unification` ran into this concretely: 41 of 44 rows were `Writable at: Phase 1` because Phase 1 was "rename DB tables + author compat views," tests couldn't be written against the pre-migration state, and the hook nevertheless demanded rationale for all 41 — firing on every Edit. Agents routed around it via Write-based heredocs (which bypass `PreToolUse:Edit` entirely). That's the rail-integrity problem: a gate designed to catch real authoring mistakes fired on legitimate usage and taught the agent to ignore it.

The fix: add a `rationale_baseline: N` frontmatter key (integer, default `0`). Rows with `Writable at <= baseline` are exempt from the rationale rule. Default behavior preserves today's exact behavior (zero migration risk for existing plans). Plans that need a higher baseline declare it explicitly. Two error messages get baseline-aware wording. Mirror the change across the TS source (`validator.ts`) and the JS hook port (`validate-impl-structure.js`). Document the new key in the trajectory guide.

Brief estimate: ~5 lines of real code change + 5 lines of test + 1 doc paragraph. The brief explicitly named the dogfooding angle — "this plan IS exactly a refactor-style plan, so its own impl.md should USE `rationale_baseline: 1` once the fix lands." That ended up not being needed (the plan's own rows are all Phase 0), but the prediction of a small surgical change was accurate.

## What Actually Happened

The plan landed largely as scoped, in a single ~30-minute work session, with a meaningful Phase 4 added by the falsification ritual. Final shape:

- **Phase 1** (validator + parity): TS source extended (`ValidateTrajectoryOptions.rationaleBaseline?: number`), `validateRationaleCompleteness` accepts `{ baseline?: number }`, JS hook port mirrored, both error messages baseline-aware. 5 unit tests + 5 subprocess-based parity fixtures. 89 tests green at completion.
- **Phase 2** (docs): Added a new "Trajectory Rationale and the `rationale_baseline` key" section to `apps/indusk-docs/src/guide/test-trajectory.md`, including a frontmatter key reference table. Surprisingly, this section also documented the previously-undocumented `rationale: required` opt-in itself — the doc page had named four validator rules but the fifth (rationale-completeness) was conditional and unmentioned. Bumped the rule count four → five.
- **Phase 3** (ship): Bumped to 1.25.0, changelog under `### Added`, published. T6 (live Numero smoke) marked `skipped` with the rationale that "natural smoke deferred to first Numero follow-up plan; landing the first impl.md with `rationale_baseline: 1` IS the smoke." User confirmed this framing.
- **Phase 4** (falsification fix-in-scope): `/falsify` immediately confirmed hypothesis 1 — the JS hook port's regex `/rationale_baseline:\s*(\d+)/` was not line-anchored, so a frontmatter whose `title:` contained the literal substring `rationale_baseline: 1` (e.g., a documentation plan about the key itself) silently inherited that baseline. Fixed by anchoring to start-of-line: `/^rationale_baseline:\s*(\d+)/m`. Two regression tests (substring rejected + legitimate top-level key honored). Bumped to 1.25.1, published.

**Files touched (4 source + 4 docs/plan):**
- `apps/indusk-mcp/src/lib/trajectory/validator.ts` (+15 lines)
- `apps/indusk-mcp/hooks/validate-impl-structure.js` (+12 lines)
- `.claude/hooks/validate-impl-structure.js` (mirror)
- `apps/indusk-mcp/src/lib/trajectory/validator.test.ts` (+170 lines, 5 tests)
- `apps/indusk-mcp/src/__tests__/rationale-baseline-parity.test.ts` (NEW, 5 fixtures)
- `apps/indusk-mcp/src/__tests__/rationale-baseline-falsify-substring.test.ts` (NEW, 2 fixtures)
- `apps/indusk-docs/src/guide/test-trajectory.md` (+50 lines)
- `apps/indusk-docs/src/changelog.md` (2 entries: Added 1.25.0, Fixed 1.25.1)
- `CLAUDE.md` (Key Decisions entry + Current State sentence)

The brief's blast-radius prediction held — the change touched exactly the two implementations the brief named, plus the two test surfaces and one doc page. No drift into adjacent systems.

## Getting to Done

The unplanned work was Phase 4 itself — the falsification ritual catching a real bug introduced by this plan, in this same session, ten minutes after 1.25.0 published. That's the exact discipline pattern `eval-scorecard-format-fix`'s retro identified as load-bearing: the ritual is most valuable RIGHT after authoring while the cheat-sheet effect is at its weakest (still familiar with the code) and at its strongest (most likely to recreate the author's blind spots).

Two things are worth noting about the falsification round:

1. **The hypothesis was real but specifically not visible during authoring.** I mirrored the existing file's regex pattern (`gate_policy:`, `rationale:`, `trajectory:`, `workflow:` all share the same unanchored shape) without thinking about it. The pattern works for those keys because they're presence/enum checks where false-positive risk is structurally lower (a `gate_policy:` substring inside a quoted string would have to spell `strict|ask|auto` exactly to get past the regex; the random-substring odds are vanishingly low). The new key was an *integer-valued* parse — false-positive risk is much higher because any `\d+` somewhere in the string passes. Different parse semantics, same regex shape, different risk profile. The author (me) didn't make that distinction during authoring.

2. **The fixture exposed an unrelated test-shape gap.** The first version of the falsification test used a `feature` workflow without OTel/Context/Document gate sections. The structural-completeness check fired *before* the rationale check would have, masking the actual hypothesis. Had to re-author the fixture with `workflow: bugfix` (which has fewer required gates) so only the rationale rule could possibly cause rejection. **This is a generalizable lesson** — falsification fixtures need to be minimal: ANY validator rule that fires before the targeted one obscures the test signal.

There were no surprises beyond Phase 4. The TS↔JS parity test pattern (subprocess-based, real hook invocation, shared fixtures, identical pass/fail decisions) worked the first time and gave high confidence in mirror correctness. The CLAUDE.md gotcha about JS-port-mirrors-TS calls out parity coverage as load-bearing — this plan operationalized it concretely for the first time.

One minor friction: state-cell parsing on T6 rejected my multi-content "skipped — natural smoke deferred to..." string because `check-gates.js` requires the State cell to be exactly one of the literal state names. Moved the reason into the `Asserts` cell prefixed with `Skip-reason:` and used bare `skipped` in State. Worth knowing for future plans with explicitly-deferred smoke rows: keep the State cell pure.

## What We Learned

1. **Regex shape risk depends on what the value carries, not the key.** Unanchored frontmatter regexes for presence/enum keys are low-risk; for integer-valued keys they are high-risk because any `\d+` substring in any quoted YAML value passes silently. When introducing a new value-bearing key into a file with existing pattern-match parsing, anchor your regex even if the siblings aren't anchored — the precedent is wrong for this case.

2. **The falsification ritual's value is highest immediately after authoring.** Phase 4 in this plan caught a real, shipped-to-npm bug ten minutes after the publish that introduced it. The ritual's worst enemy is delay (cheat-sheet effect grows weaker, but so does memory of where the seams are). Run `/falsify` on the same session as the impl-complete moment whenever possible.

3. **Falsification fixtures must be MINIMAL — ANY rule firing before the target obscures signal.** First version of the substring-attack fixture used a `feature` workflow that tripped structural-gate completeness, masking the rationale-rule check entirely. Switched to `bugfix` workflow with only the gates the bugfix workflow requires. The fixture must be *just barely* well-formed enough that the targeted rule is the only thing that can fail.

4. **Test Trajectory state cells reject multi-content strings.** `check-gates.js` validates the State cell against an exact-match enum (`planned | writable | written | passing | skipped | blocked | unknown`). Inline reason text after a hyphen breaks parsing. Put rationale in `Asserts`, keep `State` to the bare keyword. (This is now a known-gotcha worth adding to CLAUDE.md.)

5. **Documenting a new opt-in key is a chance to document its host opt-in.** This plan's docs-phase bumped the validator-rule count from four to five because the rationale rule was previously unmentioned in the guide. Adding a *child* configuration key surfaced that the *parent* opt-in (`rationale: required`) was undocumented. Worth checking when adding sub-configuration: is the umbrella feature itself well-documented?

## What We'd Do Differently

1. **Anchor the regex on first authorship, not on falsification.** I knew the regex was a substring match and I mirrored the existing file's pattern. Should have noticed during authoring that the new key's value is integer-typed and applied `^...m` from day one. The false-positive risk for value-bearing keys is structurally different from presence/enum keys — that distinction should travel with me to future frontmatter parsing.

2. **Author falsification fixtures with the minimum-viable-impl pattern.** Default scaffold should be `workflow: bugfix` + only the gates the bugfix workflow demands. Save iterations on fixture shape — the fixture is *not* the unit under test, the validator is.

3. **The brief's "Recursive dogfood opportunity" note didn't fire for this plan but might for sibling plans.** This plan's own impl.md uses `rationale_baseline: 0` (default, all rows Phase 0). Next time a refactor-style plan ships, dogfood the new key in its own frontmatter as a confidence check. (Implicitly: Numero's three queued plans will be the natural dogfood instances.)

## Insights Worth Carrying Forward

- **Frontmatter parsing rule of thumb:** integer-valued keys MUST be line-anchored (`/^key:.../m`); enum keys CAN get away with substring matches because the value space is bounded. Never apply enum-key parsing patterns to value-bearing keys without re-evaluating false-positive surface.
- **Falsification fixture discipline:** craft the minimum-viable-impl shape so only the targeted validator rule can fail. A fixture that's structurally incomplete will fail the structural rule first and silently pass the targeted one.
- **Run `/falsify` on the same session as `/work` completion.** Cheat-sheet effect is real, but delay's cost (cold context, lost intuition about seams) is higher. Pay the cheat-sheet tax to capture the same-session bugs.
- **TS↔JS parity tests via subprocess are cheap and load-bearing.** The pattern (shared fixtures → run TS validator + spawn JS hook → compare pass/fail decisions) worked on first try and is reusable for any future TS-source-with-JS-port mirror in this codebase. ~50 lines of test for production-grade parity coverage.
- **The Test Trajectory `State` column is a strict enum.** Reasons go in `Asserts` (or a new dedicated column), never in `State`.
- **Document the umbrella when adding a sub-key.** If you're documenting a new configuration option that opts into an existing feature, check whether the existing feature is itself well-documented — there's a high prior that you'll find a gap to fix in the same edit.
