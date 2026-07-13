---
title: "Cleanup Ritual — Test Plan"
date: 2026-07-06
status: accepted
---

# Cleanup Ritual — Test Plan

> **Reshaped 2026-07-06** to match the ritual model (see [brief.md](brief.md)). The prior mechanical-ratchet assertions (shrink/grow/require-extraction LOC predicates) are gone — there is no blocking LOC predicate anymore. Enforcement is the retrospective Step 0 gate, exactly like falsification.

## Purpose

Lists the behavioral assertions that mean the Cleanup ritual is working. The observable actor is a **developer** running `/cleanup {plan}` and `/retrospective {plan}`, or `/work` executing an authored Cleanup Phase. "The plan can't close" means the retrospective Step 0 gate blocks. "A Cleanup Phase appears" means a `### Phase N: Cleanup` section is present in the plan's `impl.md` (and renders in the admin UI like any phase).

The ritual mirrors `/falsify`: it authors a phase, it does not refactor inline; `/work` executes; `/retrospective` gates on completion. Assertions therefore target the *ritual's observable outputs and the gate*, not a line-count verdict.

## Behavioral Assertions

| ID | Assertion (observable behavior) | Mechanism |
|----|----------------------------------|-----------|
| A1 | Running `/cleanup` on a plan that grew a source file past its scope's line threshold produces a `### Phase N: Cleanup` section in the plan's `impl.md`, naming the flagged file and one or more recommended extractions/refactors. | manual smoke (run the ritual on a fixture plan) + vitest (the authored section parses as a valid phase) |
| A2 | A plan whose `impl.md` has an unrun Cleanup Phase (items unchecked) and no `cleanup: skipped` frontmatter cannot pass the retrospective Step 0 gate — the gate reports cleanup incomplete. | vitest unit (`isCleanupComplete` helper) + skill-logic test |
| A3 | A plan whose Cleanup Phase is terminal (all items checked, trajectory rows terminal) passes the retrospective Step 0 gate. | vitest unit (`isCleanupComplete` helper) |
| A4 | A plan with `cleanup: skipped` + a non-empty `cleanup_reason` in its impl frontmatter passes the retrospective Step 0 gate; `cleanup: skipped` with no reason (or empty reason) is still blocked. | vitest unit (skip-check helper — mirrors the falsification skip-check) |
| A5 | An authored Cleanup Phase is a structurally valid phase: `validate-impl-structure.js` accepts it and `check-gates.js` permits the plan to advance once its items + gates are checked — with **no change to either hook** (it is a normal phase using existing gates). | vitest (subprocess invocation of both hooks on a fixture impl containing a Cleanup Phase) |
| A6 | The ritual scrutinizes a file under a tighter-scoped threshold (e.g. `components/**` at 200) but not an identically-sized file outside every scope (global default 400) — a 300-line changed file is flagged inside the scope and not outside it. | vitest integration (threshold helper over a git fixture + config with one scope) |
| A7 | A plan whose `.indusk/config.json` has no `cleanup` block still runs the ritual against the built-in default threshold — the ritual is not silently disabled by config absence. | vitest unit (config reader default) |
| A8 | The ritual only considers files the plan changed (diff vs merge-base); a huge untouched legacy file elsewhere in the repo is never flagged. | vitest integration (git fixture: over-threshold file unchanged between base and HEAD) |
| A9 | On a project with `nextjs`/`react` extensions enabled, the ritual's recommendations invoke those extensions' best practices (server/client boundary split, one-component-per-file); on a library project with neither, they do not — the "what to extract" follows the enabled domain extensions. | vitest source-grep (skill defers to enabled domain skills) + manual smoke on a Next.js fixture |
| A10 | numero's ≤200-LOC + test-sibling convention on `packages/game-ui/src/components/**` is expressible entirely by editing numero's `cleanup` config block — no numero code or InDusk code change. | manual smoke (author config, run ritual on a numero fixture branch) |
| A11 | On dusk itself, running the ritual on a plan that touched a >400-LOC source file authors a Cleanup Phase, and executing it lands the file decomposed. | manual smoke (dogfood during this plan's own /work) |
| A12 | `indusk update` on a pre-existing project adds the `cleanup` config defaults idempotently (adds on first run, reports "already set" on re-run) without disturbing user content — mirroring the `agents.stale_ttl_minutes` migration. | vitest integration (subprocess `indusk update` against a tmp project, run twice) |
| A13 | A plan cannot pass the retrospective Step 0 gate unless BOTH the falsification requirement AND the cleanup requirement are satisfied (each terminal-or-skipped); satisfying only one still blocks. | vitest unit (composed gate: `isFalsificationComplete`-or-skip AND `isCleanupComplete`-or-skip) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The ritual recommends *the right* extractions — real cohesive units per best practices — and does not over-extract (recommend 8-line fragment "components" or premature abstractions). | Decomposition quality is a judgment call with no mechanical oracle; the same reason `/falsify`'s hunt quality isn't unit-tested. | The recommendations are authored into a phase a **human reviews before `/work` runs it** (accept/edit/reject); the eval agent scores the authored phase per-commit; best practices are sourced from the enabled domain extensions rather than invented. Reviewed as signal, not gated mechanically. |
| U2 | A "leave this file as-is" decision is genuinely reasoned (cohesive + tiny touch), not a lazy rubber-stamp to skip work. | Distinguishing sound restraint from avoidance requires judging intent; no mechanical test. | Same as U1 — the decision + reasoning is recorded in the reviewable phase (or the `cleanup_reason` frontmatter), visible in the retrospective audit and scored by the eval agent. The `cleanup: skipped` confession path is deliberately visible, like `falsification: skipped`. |

## Notes

- **Enforcement parity with falsification is the design's spine.** A2–A4 are the falsification gate assertions with "falsification"→"cleanup" substituted; if these pass, the ritual has real teeth without any hook change. `isCleanupComplete` / the skip-check should be written as near-clones of the falsification helpers and tested the same way.
- **A5 is the "no gate-machinery cost" assertion.** It proves the reshape's central claim: a Cleanup Phase is just a phase, so neither blocking hook nor the trajectory validator needs editing. If A5 requires a hook change to pass, the ritual model has leaked into gate machinery and the design is wrong.
- **No mechanical LOC verdict is tested** because none exists. The threshold (A6/A7/A8) only governs *which files the ritual looks at*, never a pass/fail on line count. If a future version adds a soft per-phase accretion nudge (brief fork 2), that gets its own advisory (non-blocking) assertion.
- **Ordering fixed (ADR): cleanup runs AFTER falsification** — `/work` → `/falsify` → `/work` → `/cleanup` → `/work` → `/retrospective` (refactor under the maximal green coverage falsification hardened). A13 encodes that the retrospective gate requires *both* terminal/skipped. v1 is plan-close ritual only — no per-phase accretion nudge (brief fork 2 deferred).
- Best-practice sourcing verified present: `apps/indusk-mcp/extensions/nextjs/skill.md` and `extensions/react/skill.md` carry the server/client + one-component-per-file guidance A9 relies on.
