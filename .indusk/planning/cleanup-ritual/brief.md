---
title: "Cleanup Ritual"
date: 2026-07-06
status: accepted
---

# Cleanup Ritual — Brief

> **Reshaped 2026-07-06** from a "fifth per-phase mechanical gate" to a **plan-close ritual modeled on `/falsify`**. Rationale below; the original mechanical-ratchet framing (and why it was dropped) is preserved in [research.md](research.md).

## Problem

Every existing quality layer inspects behavior (tests), process (gates on docs/context), or the delta (eval agent, per-commit). Nothing inspects the *accumulated shape* of the code a plan produced. File bloat and missing decomposition are accretion failures — each edit adds a locally-reasonable 40 lines and no checkpoint ever sees the 1,400-LOC result. Numero proved it: `page.tsx` at 1,439 LOC and `BratPokerTable.tsx` at 1,135 LOC with zero decomposed components, in a project that *had* the ≤200-LOC convention documented. Advisory conventions demonstrably do not hold on their own.

## Proposed Direction

Add a **Cleanup ritual** — `/cleanup {plan}` — as the structural twin of `/falsify`, running at plan close.

**It mirrors falsification exactly** (see `apps/indusk-mcp/skills/falsify.md`):

1. **Investigate.** The ritual reads the plan's changed files, flags the ones over the configured line threshold (per-scope, from the `cleanup` config block — the threshold *focuses attention*, it is not a blocking cap), and evaluates each against **best practices**.
2. **Best practices are sourced, not invented.** The "what should be extracted / refactored here" comes from the enabled domain extensions' skills — `nextjs` ("minimize `"use client"` boundaries — push them deep"; "server components can't use hooks"), `react` ("one component per file for non-trivial components"), etc. On a Next.js project the concrete recommendation is *pull the interactive `"use client"` island out of the server component into its own file*; on a library like dusk it's *extract a function/module*. The ritual applies the enabled project's own best-practice guidance.
3. **Recommend, with judgment — and the judgment can be "leave it."** Extraction is not universally good; forcing it produces the wrong abstraction (Sandi Metz). So the ritual recommends only what best practices actually warrant — and where the right call is "this file is cohesive, the touch was tiny, leave it," that decision is *recorded* with its reasoning, not silently skipped.
4. **The recommendations become a phase.** The ritual **authors `### Phase N: Cleanup — {summary}`** into the plan's `impl.md` — each recommended extraction/refactor a checklist item, each new extracted unit a Test Trajectory row (the extracted `Chip` gets a test; behavior-parity is the assertion). It does *not* do the refactor inline.
5. **`/work` executes it.** The authored Cleanup Phase is picked up like any other phase, using the **existing** verification / context / document gates. `/retrospective` won't close the plan until the phase is terminal.

**The authored phase IS the reviewable artifact** — a human reads `### Phase N: Cleanup` (rendered in the admin UI like every phase) and can accept, edit, or reject the recommendations before `/work` runs them. This is the "explanation a developer can look at" made concrete, and it's visible, deferrable, and traceable — the same three properties that made falsification's phase-authoring shape beat its old sidecar-log shape.

**Why a ritual, not a gate — the decisive simplification.** Research found a fifth *per-phase gate type* costs ~15 edit sites across 5 files (check-gates.js, validate-impl-structure.js, gate-reminder.js, impl-parser.ts, trajectory/validator.ts) plus the TS↔JS parity-drift risk that already shipped a bug once (1.25.0→1.25.1). The ritual model pays **none** of that: it authors a *normal* phase that uses gates that already exist. Following the documentation-phase-gate ADR's established split — **close-out gates are skill-instruction + an `isXComplete(planRoot)` helper; only per-phase gates are hook-enforced** — Cleanup is a close-out gate, so it needs **zero hook changes and no new gate type**.

**Enforcement (teeth without a mechanical ratchet).** `/retrospective` Step 0 hard-blocks unless one of: a terminal Cleanup Phase exists, OR `cleanup: skipped` + `cleanup_reason` is in the impl frontmatter (the confession path, for trivial plans or genuinely-nothing-to-extract) — exactly falsification's gate shape, via a new `isCleanupComplete(planRoot)` helper mirroring `isFalsificationComplete`. The eval agent additionally scores the authored phase's quality, so a lazy "everything's fine" recommendation surfaces as a finding rather than passing silently.

**The strictness debate is dissolved.** Because there is no blocking LOC predicate, no-growth-vs-strict-shrink-vs-require-extraction is moot. The line threshold is demoted from "a cap that blocks" to "an input that tells the ritual which files to scrutinize." Over-extraction is prevented at the source: the AI recommends per best-practices, a human reviews the phase before it runs, and the eval agent scores it.

## Context

Grounded by six-reader research at [research.md](research.md). Origin: numero table-geometry session (2026-07-06) where decompose-as-we-build was added to a plan ad hoc. This makes it a system-level ritual instead of per-plan remembering. Design converged through conversation: mechanical per-phase gate → artifact-producing gate → **falsification-twin ritual** (this doc), the user's insight that "we already have a comp for this."

## Scope

### In Scope
- **`/cleanup {plan}` skill** at `apps/indusk-mcp/skills/cleanup.md`, structured as `falsify.md`'s twin: investigate changed files → apply enabled-extension best practices → author `### Phase N: Cleanup — {summary}` with extraction/refactor items + trajectory rows for new units, OR set `cleanup: skipped` + `cleanup_reason`. Pure skill — reads `git diff` + config itself; no blocking CLI/MCP tool required.
- **`cleanup` config block** in `.indusk/config.json` — per-scope line thresholds + optional `test_sibling`, read by the skill to focus attention. TS reader with defaults (the `agents.stale_ttl_minutes` precedent); init scaffolds; update migrates idempotently.
- **`isCleanupComplete(planRoot)` + skip-check helpers** mirroring the falsification helpers; **retrospective Step 0 gate** extended to require cleanup (accept terminal Cleanup Phase OR skip-frontmatter).
- **work skill** references the Cleanup Phase in the close-out sequence (like it does for falsification); **planner/falsify** cross-reference the ritual order.
- Optional convenience: a small helper (CLI or lib) that lists a plan's changed files over threshold-by-scope — reused by the skill and available to the eval agent. Non-blocking.
- Docs: ritual guide (twin of the falsification-ritual guide), CLI/skill reference, changelog. Dogfood on dusk (indusk-mcp has its own >400-LOC files).

### Out of Scope
- **Any fifth per-phase gate type / hook change / mechanical blocking ratchet** — explicitly dropped in the reshape.
- Auto-refactoring codemods (the authored phase is executed by `/work` + the agent, not a machine).
- Biome rule distribution to consumers (update.ts doesn't touch biome.json; separate decision).
- Per-phase advisory accretion nudge (see fork below — possible complement, not v1 core).
- Admin-UI-specific cleanup rendering (the Cleanup Phase already renders as a phase; falsification-phase rendering precedent exists).

## Success Criteria
- `/cleanup {plan}` on a plan that grew a file past its scope threshold authors a `### Phase N: Cleanup` naming the file, the best-practice basis, and the recommended extractions — OR records a reasoned "leave as-is."
- `/retrospective` refuses to close a plan whose Cleanup Phase is unrun and which has no `cleanup: skipped` frontmatter — same block as a missing falsification.
- A trivial plan (typo, changelog) closes via `cleanup: skipped` + reason with no friction.
- On a Next.js fixture the recommendations reference the `nextjs`/`react` extension best practices (server/client split, one-component-per-file); on a library fixture with neither extension, they don't — recommendations follow the enabled domain extensions.
- dusk itself runs the ritual; at least one dusk plan's Cleanup Phase extracts/refactors a real >400-LOC source file.
- numero's ≤200 + test-sibling convention on `packages/game-ui/src/components/**` is expressible purely by editing numero's `cleanup` config block.

## Depends On
- Nothing hard. **Loosely coordinates with `.indusk/planning/documentation-phase-gate/`** (ADR proposed) — that plan also touches `/retrospective` Step 0; the two close-out-gate helpers must compose. It also supplies the load-bearing pattern this plan adopts: close-out gate = skill + `isXComplete` helper, not a hook.

## Blocks
- Consumer decomposition/refactor work (e.g. numero table-geometry) getting this discipline systematically instead of per-plan ad-hoc CI checks.

## Open Design Forks (for the ADR)
- **Order relative to falsification.** `/work` → `/falsify` → `/work` → **`/cleanup`** → `/work` → `/retrospective` (cleanup AFTER — refactor under the maximal green coverage falsification just hardened; my lean, moderate confidence) vs cleanup BEFORE falsification (falsify the freshly-decomposed structure). "Refactor under green tests" argues for AFTER.
- **Threshold as attention-focus only, or also a soft nudge earlier?** Core v1 is plan-close only. A cheap per-phase advisory nudge (gate-reminder.js-style, non-blocking: "heads up — page.tsx crossed 200 this phase") would surface accretion earlier without a blocking gate — addresses the plan-close-cadence gap. Include or defer?
- **Does the ritual need any helper tooling, or is it pure-skill?** Falsify is pure-skill (reads impl.md itself). Cleanup could be pure-skill (runs `git diff` + `wc -l` + reads config) — or ship a small `list-oversized-changed-files` helper for reuse by the eval agent. Leaning pure-skill + optional helper.
- **Trajectory rows for extractions**: does each extracted unit require a new test (trajectory row), or is behavior-parity against existing tests sufficient? Refactoring discipline says extract under green tests; new public units arguably warrant their own.
