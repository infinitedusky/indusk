---
title: "Falsify Phase Authoring"
date: 2026-04-20
status: accepted
---

# Falsify Phase Authoring — Brief

## Problem

Today `/falsify` is a test-running ritual: it investigates the plan, forms hypotheses, writes tests inline, runs them, picks an outcome per hypothesis (fix-in-scope / spawn-plan / accept-finding), and logs to a separate `.indusk/planning/{plan}/falsification.md` file. Two problems with this shape:

1. **Falsification isn't visible in the admin UI.** The admin UI renders phases from impl.md. The `falsification.md` file is invisible — a plan's falsification run happens off-screen, disconnected from the phase sequence that tells the story of the plan.
2. **Running tests inline forces immediate execution.** The user can't say "I'll falsify this next week" without either blocking retrospective or partially completing the ritual. The ritual's value (catching the author's own blind spots) shouldn't be gated on having time to run tests RIGHT NOW.

The effect: falsification is skipped under time pressure, or the log becomes an afterthought written late in a session when the author's eye is already dull. The discipline is load-bearing for quality — and the current shape makes it easy to skip.

## Proposed Direction

Change `/falsify` from a test-running ritual into a **phase-authoring action**. When the agent forms hypotheses during investigation, instead of writing tests inline and picking outcomes, it appends a new phase to impl.md whose checklist is:

1. The hypothesis tests, expressed as normal trajectory rows (`T-ID | Asserts | Writable at | Passes at | State`) — one per hypothesis.
2. The implementation items to fix whatever the tests reveal — in the same checklist shape as any other phase's work.
3. Standard Verification / Context / Document gates referencing the trajectory rows.

The phase looks exactly like every other impl phase — no new phase TYPE, no new validator rules, no admin-UI styling change. The plan stays `in-progress` until `/work` picks up the falsification phase (and any subsequent fix phases it spawns) and closes them normally.

`/retrospective` already waits for all impl phases to be terminal (via `check-gates.js`). With falsification phases appearing in impl.md as regular phases, the existing gate naturally enforces "falsification done" without a separate check. The dedicated `isFalsificationComplete` / `isFalsificationSkipped` logic in the retrospective skill becomes vestigial — can stay for legacy plans that have existing `falsification.md` files, but new plans don't use it.

## Context

- Current behavior: [`apps/indusk-mcp/skills/falsify.md`](../../../apps/indusk-mcp/skills/falsify.md) (source) + [`.claude/skills/falsify/SKILL.md`](../../../.claude/skills/falsify/SKILL.md) (installed copy) — describes the investigate-hypothesize-test-log loop with three outcomes per failure.
- Current log library: [`apps/indusk-mcp/src/lib/falsification/log.ts`](../../../apps/indusk-mcp/src/lib/falsification/log.ts) — `appendHypothesis`, `markTerminated`, `isFalsificationComplete`, `isFalsificationSkipped`. Stays for backwards compatibility with existing `falsification.md` files (e.g., `.indusk/planning/archive/falsification-ritual/falsification.md`).
- Current retrospective gate: [`apps/indusk-mcp/skills/retrospective.md`](../../../apps/indusk-mcp/skills/retrospective.md) Step 0 — checks `isFalsificationComplete(planRoot)` or `isFalsificationSkipped(implContent).skipped`. Updated to also accept "all impl phases terminal" as a gate-pass condition.
- Falsification-ritual guide: [`apps/indusk-docs/src/guide/falsification-ritual.md`](../../../apps/indusk-docs/src/guide/falsification-ritual.md) — user-facing explainer.
- This change is a **behavior change to the `/falsify` skill**, not an API break. Plans authored under the old flow with existing `falsification.md` files keep working.

## Scope

### In Scope

- Rewrite [`apps/indusk-mcp/skills/falsify.md`](../../../apps/indusk-mcp/skills/falsify.md) to describe the phase-authoring flow: investigate → hypothesize → append new phase to impl.md → done.
- Propagate to [`.claude/skills/falsify/SKILL.md`](../../../.claude/skills/falsify/SKILL.md) via `indusk update` (or direct edit in this repo).
- Update [`apps/indusk-docs/src/guide/falsification-ritual.md`](../../../apps/indusk-docs/src/guide/falsification-ritual.md) to match.
- Update [`apps/indusk-mcp/skills/retrospective.md`](../../../apps/indusk-mcp/skills/retrospective.md) Step 0 gate to treat "all impl phases terminal" as an acceptable pass condition in addition to the existing `isFalsificationComplete` / `isFalsificationSkipped` paths. Backwards-compatible.
- Keep the `falsification/log.ts` library in place unchanged for legacy reads. No deprecation.
- Changelog entry (1.27.4 or 1.28.x if shipped with local-telemetry) describing the behavioral change.

### Out of Scope

- Deprecating or removing the `falsification/log.ts` library (kept for legacy plans).
- Changes to `validate-impl-structure.js` (no new phase type or validator rule).
- Changes to `check-gates.js` (phase-close rules unchanged).
- Admin-UI styling for falsification phases (renders as a normal phase; special styling is a future polish).
- Migrating existing archived plans with `falsification.md` files to the new pattern (they stay as-is).
- A new MCP tool for "where are my unresolved falsification phases across all plans" (future polish).

## Success Criteria

1. `/falsify {plan}` authored against an impl.md that is otherwise complete appends a new Phase N+1 named with a recognizable falsification prefix (e.g., `### Phase N+1: Falsification — {short summary}`), containing trajectory rows for hypothesis tests + implementation items for fixes + verification/context/document gates.
2. Running `/falsify` does NOT execute tests inline. It investigates, forms hypotheses, and writes the phase. Zero test runs happen from the skill itself.
3. The plan's impl status stays `in-progress` after `/falsify` runs (since the new phase is unchecked).
4. `/work {plan}` picks up the falsification phase like any other phase — authors writable-at-phase tests at phase start, closes when all verification items are checked.
5. `/retrospective {plan}` can close the plan when all impl phases (including the falsification phase and any fix-in-scope phases it spawns) are terminal, without requiring a `falsification.md` file.
6. A plan that already has `falsification.md` (legacy) still passes `/retrospective`'s Step 0 gate via the existing `isFalsificationComplete` check.
7. The falsification-ritual guide doc explains both the new shape (for new plans) and the legacy shape (for archived plans), so readers of either generation understand what they're seeing.

## Depends On

- None. The change is purely in skill files + a docs page + a lightly-updated retrospective gate.

## Blocks

- **Retrospective queue for admin-ui-hosting / indusk-admin-ui / eval-agent-mcp-access.** All three shipped but haven't had `/falsify` run. Under the new pattern, each gets a falsification phase authored + worked before retro. Under the old pattern, each gets a `falsification.md` ritual run before retro. The new pattern is cleaner.
- **`local-telemetry`'s eventual `/falsify` step.** Ships under the new pattern — falsification phase authored after Phase 7.
