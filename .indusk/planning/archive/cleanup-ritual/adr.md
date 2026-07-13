---
title: "Cleanup Ritual"
date: 2026-07-06
status: accepted
---

# Cleanup Ritual

## Goal

**Make code decomposition a mandatory, reviewable step at plan close — the structural twin of falsification — so files stop silently accreting into unmaintainable monoliths, without a mechanical line-count lever that would force the wrong abstraction.**

Today a plan can grow a source file from 400 to 1,400 lines across its phases and nothing ever surfaces it: tests stay green, gates pass, the eval agent sees only locally-reasonable per-commit deltas. Numero lived this exactly — `page.tsx` at 1,439 LOC and `BratPokerTable.tsx` at 1,135 LOC with zero decomposed components, in a project that *had* a documented ≤200-LOC convention. When this ADR ships, `/cleanup {plan}` runs after `/falsify`, reviews what the plan changed, applies the enabled domain extensions' best practices, and authors a `### Phase N: Cleanup` into the plan's `impl.md` that a human reviews and `/work` executes — and `/retrospective` refuses to close the plan without it.

## Y-Statement

**In the context of:**
a plan whose `/work` and `/falsify` have completed, where the code the plan produced may have grown existing files past the point of maintainability or introduced new files that should have been decomposed, and where the only prior defenses against this are advisory conventions that have demonstrably failed to hold.

**Facing:**
the need to enforce decomposition discipline without (a) paying the ~15-edit-site cost and TS↔JS parity-drift risk of adding a fifth per-phase gate type, (b) introducing a mechanical line-count predicate that either forces action on every touch (penalizing genuine in-place refactor) or pushes premature extraction (the wrong abstraction, which costs more than the duplication it removes), and (c) reverting to a purely advisory nudge, which is the exact failure mode we are trying to fix.

**We decided for:**
a plan-close **ritual** modeled precisely on `/falsify` — `/cleanup {plan}` investigates the plan's changed files, flags those over a per-scope line threshold read from a `cleanup` config block, applies best practices sourced from the enabled domain extensions (nextjs/react/etc.), and authors a `### Phase N: Cleanup — {summary}` into the plan's `impl.md` capturing each recommended extraction/refactor as a checklist item (or a reasoned "leave as-is"). `/work` executes the authored phase using the existing verification/context/document gates; `/retrospective` Step 0 hard-blocks unless the Cleanup Phase is terminal or `cleanup: skipped` + `cleanup_reason` is present — enforced by an `isCleanupComplete(planRoot)` helper cloned from `isFalsificationComplete`. It runs AFTER falsification, so the refactor happens under the maximal green test coverage falsification just hardened.

**And against:**
a fifth per-phase mechanical gate (rejected for gate-machinery cost and an unsolvable strictness problem); a blocking LOC ratchet in any form — no-growth, strict-shrink, or require-extraction (rejected because each either forces the wrong abstraction, penalizes real refactor, or is gameable); Biome's `noExcessiveLinesPerFile` (rejected — no baseline mechanism, floods legacy files, and `indusk update` has no channel to distribute biome.json changes); a purely advisory artifact with no gate (rejected — reverts to the numero failure); running cleanup before falsification (rejected — would refactor unproven, possibly-buggy code); and a committed baseline-snapshot file à la Betterer (rejected — churn and maintenance with no precedent in the repo).

**To achieve:**
decomposition that is *visible* (the Cleanup Phase renders in the admin UI like any phase), *deferrable* (the ritual authors, `/work` executes later — no forced inline refactor under time pressure), *traceable* (the plan's phase sequence tells the full story: work → falsify → fix → cleanup → close), *judgment-driven* (the AI recommends only what best practices warrant, and "leave it" is a first-class recorded decision), and *enforced* (the retrospective gate makes skipping a visible confession, not a silent omission), all at near-zero implementation cost because a Cleanup Phase is a normal phase using gates that already exist.

**Accepting:**
that enforcement is skill-level (retrospective Step 0 + helper), not a hard PreToolUse hook — a determined agent can write a lazy `cleanup: skipped` reason, the same residual risk falsification already carries; that the cadence is plan-close, so accretion accumulates across a plan's phases before anyone reviews it (deferring the cheaper per-phase nudge to a later version); and that recommendation *quality* — whether the right units were extracted and over-extraction was avoided — cannot be mechanically verified and rests on human review of the authored phase plus eval-agent scoring.

**Because:**
the whole lesson of the numero incident and this project's own history is that advisory conventions do not hold but *rituals that author reviewable, enforced artifacts do* — falsification already proved this exact shape works, and reusing it gives us teeth, visibility, and human-in-the-loop judgment for the cost of one skill, one helper, and one config block, while sidestepping the mechanical-lever trap that would have made the code worse in the name of making it smaller.

## Context

Converged through conversation on 2026-07-06, originating in a numero table-geometry session where "decompose as we build" was added to a plan ad hoc. The design walked through three framings before settling: (1) a fifth per-phase mechanical gate with a LOC ratchet; (2) an artifact-producing gate where the AI records an extraction decision a human can review; (3) — the accepted shape — a plan-close ritual twinning `/falsify`, the user's insight that "we already have a comp for this." Each reframe removed a class of problem the prior one carried; see [research.md](research.md) for the six-reader grounding (gate-machinery edit-site inventory, config plumbing precedents, Biome's baseline gap, external ratchet-tool families) and [brief.md](brief.md) for the reshape narrative. The behavioral contract is [test-plan.md](test-plan.md) (13 assertions; U1/U2 the untestable recommendation-quality items).

The load-bearing precedent is the `documentation-phase-gate` ADR's established split: **close-out gates are skill-instruction + an `isXComplete(planRoot)` helper; only per-phase gates are hook-enforced (exit 2).** Cleanup is a close-out gate, so it needs zero hook changes. The two plans' retrospective Step 0 extensions must compose (both add a requirement to the same gate).

## Decision

1. **`/cleanup {plan}` skill** at `apps/indusk-mcp/skills/cleanup.md`, authored as a near-clone of `falsify.md`'s structure: read the plan's changed files (diff vs merge-base), flag files over their scope's threshold, apply the enabled domain extensions' best practices to identify decomposition/refactor moves, and **author `### Phase N: Cleanup — {summary}`** with each move as a checklist item + a Test Trajectory row per newly-extracted unit. The ritual does NOT refactor inline. If nothing warrants action, set `cleanup: skipped` + `cleanup_reason` (the confession path).
2. **The ritual runs AFTER falsification**: `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. Refactor under the green coverage falsification hardened.
3. **`cleanup` config block** in `.indusk/config.json`: `{ max_file_loc: <default>, scopes: [{ include, max_file_loc, test_sibling }] }`. Read by the skill to *focus attention* (which files to scrutinize) — it is NOT a blocking cap. TS reader with default constants (the `agents.stale_ttl_minutes` precedent); `init` scaffolds the block; `update` migrates existing projects idempotently.
4. **`isCleanupComplete(planRoot)` + a skip-check helper**, cloned from the falsification helpers, in the same lib module family. **Retrospective Step 0 gate** extended to require cleanup: pass iff (Cleanup Phase terminal) OR (`cleanup: skipped` + non-empty `cleanup_reason`). The composed gate requires BOTH falsification and cleanup satisfied.
5. **Pure-skill core** — the skill runs `git diff` + line-counting + config reads itself (no blocking CLI/MCP tool). An optional small `list-oversized-changed-files` helper (lib + thin CLI) may be added for reuse by the eval agent; non-blocking, decided during impl.
6. **No new gate type, no hook change, no mechanical LOC verdict.** The authored Cleanup Phase is a normal phase; `validate-impl-structure.js` and `check-gates.js` are untouched.
7. **v1 is plan-close only** — no per-phase accretion nudge. Deferred to a possible follow-up.
8. **Best practices are sourced from enabled domain extensions**, not hardcoded — the skill directs the agent to the loaded domain skills for "what to extract"; on a project with neither `nextjs` nor `react`, the guidance degrades to "extract functions/modules."

## Alternatives Considered

### Fifth per-phase mechanical gate (original framing)
Rejected. Research found ~15 edit sites across 5 files (check-gates.js, validate-impl-structure.js, gate-reminder.js, impl-parser.ts, trajectory/validator.ts) plus TS↔JS parity-drift risk that already shipped a bug (1.25.0→1.25.1) — and it still left the mechanical-strictness problem unsolved.

### Blocking LOC ratchet (no-growth / strict-shrink / require-extraction)
Rejected in all three variants. Strict-shrink forces action on tiny touches and can push premature extraction; require-extraction penalizes genuine in-place refactor (which has no new file) and most strongly forces the wrong abstraction; no-growth alone drives no improvement (a monolith sits unchanged forever). A line-count predicate cannot distinguish good decomposition from bad, and rewards performative shrinking over real simplification.

### Biome `noExcessiveLinesPerFile`
Rejected as the mechanism. It exists (promoted to Biome 2.5 `style` group) but has no baseline/grandfather concept (open RFC since 2023) — a cap either floods every legacy file red or mass-writes suppression comments into source. And `indusk update` has no channel to push biome.json rules to existing consumers. May still be *offered* as opt-in editor feedback in new-code scopes — an impl-time nicety, not the gate.

### Advisory artifact with no enforcement
Rejected. An explanation the agent writes about its own work, with no gate, is the numero failure mode restated — the documented ≤200 convention was exactly this and it did not hold.

### Cleanup before falsification
Rejected. Refactoring before proving correctness restructures possibly-buggy code; falsification's newly-authored regression tests are strongest as coverage the refactor runs under, which requires cleanup to come after.

### Committed baseline-snapshot file (Betterer-style)
Rejected. Auto-updating snapshots churn with line movement and require adopting a separate runner; exclude-list baselines (rubocop-todo/PHPStan/detekt) need manual regeneration. No precedent for a committed tool-ratcheted baseline in the repo, and the merge-base already serves as a zero-maintenance baseline for the ritual's file-flagging.

## Consequences

### Positive
- Near-zero implementation cost: one skill + one gate helper + one config block. No gate-machinery edits, no hook changes, no TS↔JS parity surface.
- Reuses a proven pattern wholesale — falsification's visible/deferrable/traceable phase-authoring shape and its retrospective-gate enforcement.
- Over-extraction is prevented at the source: the AI recommends per best practices, a human reviews the authored phase before `/work` runs it, and "leave it" is a first-class recorded decision.
- Genuine in-place refactor is fully supported — there is no LOC predicate to satisfy, so simplifying 80 lines to 20 with no new file is a valid recommendation.
- Teeth without a blunt lever: the retrospective gate makes skipping a visible confession; the eval agent scores the authored phase.

### Negative
- Plan-close cadence: accretion accumulates across a plan's phases before the ritual reviews it, colder context than per-phase review would give. (Mitigated only by the deferred per-phase nudge.)
- Skill-level enforcement, not a hard hook — a determined agent can lazily `cleanup: skipped`. Same residual risk falsification carries; mitigated by the visible confession + eval scoring.
- Adds another `/work` re-entry to the plan-close sequence (falsify-work-cleanup-work-retro), lengthening the tail of every non-trivial plan.

### Risks
- **Recommendation quality is mechanically unverifiable** (U1/U2). The ritual could over-extract or rubber-stamp. Mitigation: human review of the authored phase (accept/edit/reject before execution), eval-agent scoring per commit, best practices sourced from enabled extensions rather than invented.
- **`cleanup: skipped` becomes a rubber stamp.** Mitigation: the skip is visible in the retrospective audit and eval-scored, exactly like `falsification: skipped`.
- **Retrospective Step 0 collision with documentation-phase-gate.** Both extend the same gate. Mitigation: compose the requirements (AND), coordinate merge order, and write the helper so requirements are additive.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/cleanup-ritual.md` — the ritual guide, twin of `guide/falsification-ritual.md` (motivation, how to run, what the Cleanup Phase contains, the skip path).
- New: `apps/docs/src/reference/skills/cleanup.md` — skill reference.
- Update: the retrospective skill reference — Step 0 now requires cleanup as well as falsification.
- Update: the falsification-ritual guide and any "plan lifecycle" page — insert cleanup after falsification in the close-out sequence.

### Diagrams
- Mermaid sequence in `guide/cleanup-ritual.md`: the plan-close sequence `work → falsify → work → cleanup → work → retrospective`, showing the ritual authoring a phase that `/work` later executes.

### Changelog
- "Added the `/cleanup` ritual — plan-close decomposition review that authors a Cleanup Phase (twin of `/falsify`); `/retrospective` now gates on it. New `cleanup` config block for per-scope line thresholds."

### ADR in Docs
- Publish to `apps/docs/src/decisions/cleanup-ritual.md`.

## References
- [research.md](research.md) — six-reader grounding (gate machinery, config plumbing, Biome, ratchet prior art)
- [brief.md](brief.md) — reshape narrative (mechanical gate → artifact → ritual)
- [test-plan.md](test-plan.md) — 13 behavioral assertions + U1/U2
- `apps/indusk-mcp/skills/falsify.md` — the template this ritual clones
- `.indusk/planning/documentation-phase-gate/adr.md` — the close-out-gate-via-helper precedent and the retrospective Step 0 composition constraint
- `apps/indusk-mcp/extensions/{nextjs,react}/skill.md` — the best-practice source for "what to extract"
