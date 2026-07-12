# Cleanup Ritual — Decision Summary

ADR accepted 2026-07-06. Planning docs at `.indusk/planning/cleanup-ritual/` in the repo. User guide: [Cleanup Ritual](/guide/cleanup-ritual).

## The Goal

Make code decomposition a **mandatory, reviewable step at plan close** — the structural twin of falsification — so files stop silently accreting into unmaintainable monoliths, **without a mechanical line-count lever that would force the wrong abstraction.**

Today a plan can grow a source file from 400 to 1,400 lines across its phases and nothing surfaces it: tests stay green, gates pass, the eval agent sees only locally-reasonable per-commit deltas. Numero lived this exactly — `page.tsx` at 1,439 LOC and `BratPokerTable.tsx` at 1,135 LOC with zero decomposed components, in a project that *had* a documented ≤200-LOC convention. When this ADR ships, `/cleanup {plan}` runs after `/falsify`, reviews what the plan changed, applies the enabled domain extensions' best practices, and authors a `### Phase N: Cleanup` into the plan's `impl.md` that a human reviews and `/work` executes — and `/retrospective` refuses to close the plan without it.

## The Y-Statement

> **In the context of** a plan whose `/work` and `/falsify` have completed, where the code the plan produced may have grown existing files past maintainability or introduced files that should have been decomposed, and where the only prior defenses are advisory conventions that have demonstrably failed to hold;
>
> **facing** the need to enforce decomposition discipline without (a) paying the ~15-edit-site cost and TS↔JS parity-drift risk of a fifth per-phase gate type, (b) introducing a mechanical line-count predicate that either forces action on every touch or pushes premature extraction (the wrong abstraction, which costs more than the duplication it removes), and (c) reverting to a purely advisory nudge — the exact failure mode being fixed;
>
> **we decided for** a plan-close **ritual** modeled precisely on `/falsify` — `/cleanup {plan}` investigates the plan's changed files, flags those over a per-scope threshold from a `cleanup` config block, applies best practices sourced from the enabled domain extensions, and authors a `### Phase N: Cleanup — {summary}` into `impl.md` capturing each recommended extraction/refactor as a checklist item (or a reasoned "leave as-is"). `/work` executes the phase using existing gates; `/retrospective` Step 0 hard-blocks unless the phase is terminal or `cleanup: skipped` + `cleanup_reason` is present. It runs AFTER falsification, so refactor happens under maximal green coverage;
>
> **and against** a fifth per-phase mechanical gate; a blocking LOC ratchet in any form (no-growth / strict-shrink / require-extraction); Biome's `noExcessiveLinesPerFile`; a purely advisory artifact with no gate; running cleanup before falsification; and a committed baseline-snapshot file à la Betterer;
>
> **to achieve** decomposition that is *visible* (renders in the admin UI like any phase), *deferrable* (the ritual authors, `/work` executes later), *traceable* (the phase sequence tells the story), *judgment-driven* (the AI recommends only what best practices warrant; "leave it" is first-class), and *enforced* (the retrospective gate makes skipping a visible confession) — at near-zero cost because a Cleanup Phase is a normal phase using gates that already exist;
>
> **accepting** that enforcement is skill-level (retrospective Step 0 + helper), not a hard hook — a determined agent can write a lazy skip, the same residual risk falsification carries; that the cadence is plan-close, so accretion accumulates before review; and that recommendation *quality* cannot be mechanically verified and rests on human review plus eval scoring;
>
> **because** the whole lesson of the numero incident is that advisory conventions do not hold but *rituals that author reviewable, enforced artifacts do* — falsification already proved this exact shape works, and reusing it gives teeth, visibility, and human-in-the-loop judgment for the cost of one skill, one helper, and one config block, while sidestepping the mechanical-lever trap that would have made the code worse in the name of making it smaller.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **A ritual, not a gate type** | A fifth per-phase gate costs ~15 edit sites across 5 files plus TS↔JS parity-drift risk (which already shipped a bug, 1.25.0→1.25.1). A Cleanup Phase is a *normal* phase using gates that already exist — zero hook changes, zero new gate type. This follows the `documentation-phase-gate` split: close-out gates are skill-instruction + an `isXComplete(planRoot)` helper; only per-phase gates are hook-enforced. |
| **Authors a phase; `/work` executes it** | The output is a modified `impl.md`, never an inline refactor. This makes cleanup visible (phases render in the admin UI), deferrable (no forced refactor under time pressure), and traceable (the phase sequence tells the full story). Identical to falsification's phase-authoring shape. |
| **Runs AFTER falsification** | `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective`. Refactoring happens under the maximal green coverage falsification just hardened. Restructuring unproven code risks hiding a bug behind a new boundary. |
| **Threshold is attention-focus, not a cap** | The `cleanup` config block (`max_file_loc` default 400 + per-scope overrides, read by `listOversizedChangedFiles`) tells the ritual which files to scrutinize. There is **no mechanical LOC gate anywhere.** A flagged file means "look here," not "this fails." |
| **Best-practice-guided, not blanket extraction** | Over-extraction produces the wrong abstraction (Sandi Metz: duplication is cheaper than the wrong abstraction). "What to extract" comes from the enabled domain extensions (`nextjs`: push `use client` boundaries deep; `react`: one component per file), not hardcoded. On a library with neither, it degrades to "extract a function/module." |
| **"Leave as-is" is first-class** | When a file is cohesive or the touch was tiny, the ritual records that decision *with reasoning* as a checklist item — reviewable and eval-scored — not a silent skip. No manufactured extractions to shrink a number. |
| **Retrospective Step 0 gate** | `checkRetrospectiveReadiness(planRoot, implContent)` composes the falsification and cleanup requirements. Cleanup passes iff a terminal Cleanup Phase exists (`isCleanupComplete`) OR `cleanup: skipped` + non-empty `cleanup_reason` (`isCleanupSkipped`). Helpers live in `apps/indusk-mcp/src/lib/cleanup/gate.js`, cloned from the falsification helpers. |
| **v1 is plan-close only** | No per-phase accretion nudge — deferred to a possible follow-up. Accepts colder review context in exchange for a much smaller surface. |

## Rejected Alternatives

**Fifth per-phase mechanical gate** (the original framing). Research found ~15 edit sites across 5 files (`check-gates.js`, `validate-impl-structure.js`, `gate-reminder.js`, `impl-parser.ts`, `trajectory/validator.ts`) plus TS↔JS parity-drift risk that already shipped a bug once — and it *still* left the mechanical-strictness problem unsolved.

**Blocking LOC ratchet — all three variants.** Strict-shrink forces action on tiny touches and pushes premature extraction; require-extraction penalizes genuine in-place refactor (which has no new file) and most strongly forces the wrong abstraction; no-growth alone drives no improvement (a monolith sits unchanged forever). A line-count predicate cannot distinguish good decomposition from bad, and rewards performative shrinking over real simplification.

**Biome `noExcessiveLinesPerFile`.** It exists (Biome 2.5 `style` group) but has no baseline/grandfather concept (open RFC since 2023) — a cap either floods every legacy file red or mass-writes suppression comments into source. And `indusk update` has no channel to push biome.json rules to existing consumers. May still be offered as opt-in editor feedback in new-code scopes — an impl-time nicety, not the gate.

**Advisory artifact with no enforcement.** An explanation the agent writes about its own work, with no gate, is the numero failure mode restated — the documented ≤200 convention was exactly this, and it did not hold.

**Cleanup before falsification.** Refactoring before proving correctness restructures possibly-buggy code; falsification's newly-authored regression tests are strongest as coverage the refactor runs under, which requires cleanup to come after.

**Committed baseline-snapshot file (Betterer-style).** Auto-updating snapshots churn with line movement and require a separate runner; exclude-list baselines (rubocop-todo/PHPStan/detekt) need manual regeneration. No precedent for a committed tool-ratcheted baseline in the repo, and the merge-base already serves as a zero-maintenance baseline for file-flagging.

## Consequences

**Positive.** Near-zero implementation cost — one skill, one gate helper, one config block; no gate-machinery edits, no hook changes, no TS↔JS parity surface. Reuses a proven pattern wholesale (falsification's visible/deferrable/traceable phase-authoring plus its retrospective-gate enforcement). Over-extraction is prevented at the source: the AI recommends per best practices, a human reviews the phase before `/work` runs it, and "leave it" is a recorded decision. Genuine in-place refactor is fully supported — there is no LOC predicate to satisfy, so simplifying 80 lines to 20 with no new file is valid.

**Negative.** Plan-close cadence means accretion accumulates across a plan's phases before the ritual reviews it — colder context than per-phase review, mitigated only by the deferred per-phase nudge. Skill-level enforcement, not a hard hook — a determined agent can lazily `cleanup: skipped` (same residual risk falsification carries; mitigated by the visible confession + eval scoring). Adds another `/work` re-entry to the close-out sequence, lengthening the tail of every non-trivial plan.

**Risks.** Recommendation quality is mechanically unverifiable (the untestable U1/U2 items) — the ritual could over-extract or rubber-stamp; mitigated by human review of the authored phase, eval-agent scoring per commit, and best practices sourced from enabled extensions rather than invented. `cleanup: skipped` could become a rubber stamp; mitigated by the visible, eval-scored confession, exactly like `falsification: skipped`. Retrospective Step 0 collides with `documentation-phase-gate` (both extend the same gate); mitigated by composing the requirements with AND and writing the helper so requirements are additive.

## Bookend Symmetry

`/cleanup` is falsification's twin, and the two together bracket plan close:

- **`/falsify`** — flip the goal from "prove it works" to "find a failing test." Hunts correctness gaps.
- **`/cleanup`** — flip the goal from "does this work?" to "how do I make this well-shaped?" Hunts accretion.

Same agent, same phase-authoring mechanism, same retrospective gate, same skip-as-confession escape hatch. Inverse purpose. Cleanup runs second, under the coverage falsification hardened.

## See Also

- [Cleanup Ritual user guide](/guide/cleanup-ritual) — motivation, the ritual steps, the skip path, the close-out diagram
- [Falsification Ritual decision](/decisions/falsification-ritual) — the twin ADR this one mirrors
- [Falsification Ritual guide](/guide/falsification-ritual) — the ritual running immediately before cleanup
- `.indusk/planning/cleanup-ritual/adr.md` in the repo — the authoritative design record with all decisions and alternatives
- `apps/indusk-mcp/skills/cleanup.md` — the `/cleanup` skill itself
