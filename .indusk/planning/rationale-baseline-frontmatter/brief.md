---
title: "Rationale Baseline Frontmatter"
date: 2026-04-19
status: accepted
workflow: bugfix
---

# Rationale Baseline Frontmatter — Brief

## Problem

The `validate-impl-structure.js` hook's `validateRationaleCompleteness` rule demands a `### Trajectory Rationale` entry for every trajectory row where `Writable at: Phase N` and `N > 0`. The rule's comment says "Phase 0 rows (writable today against the current stack) do not need rationale."

That bakes in an assumption: every plan uses Phase 0 as its writable baseline. True for feature plans where the existing stack is the starting point. **Wrong** for plans where Phase 1 itself is the enabling work — refactors, schema migrations, scaffolding plans — because in those plans the "writable today against the current stack" baseline is Phase 1, not Phase 0.

Real failure surfaced on Numero's `table-lifecycle-unification`: 41 of 44 rows were `Writable at: Phase 1` because Phase 1 was "rename DB tables + author compat views." Tests couldn't be written against the pre-migration state without literally reverting production code. The plan's own Rationale subsection documented the convention explicitly:

> Default: every test is authored at the earliest writable phase (Phase 1 in this plan) — no rationale needed. Entries in this subsection exist only for rows deferred past Phase 1.

The hook nevertheless demanded rationale for all 41 rows, fired on every Edit to impl.md, and agents routed around it via Write-based heredocs (which bypass `PreToolUse:Edit` entirely). That's the rail-integrity problem: a gate designed to catch real authoring mistakes fired on legitimate usage and taught the agent to ignore it.

This pattern isn't unique to one plan. **Every plan where Phase 1 is a mandatory enabling migration** (schema changes, dependency scaffolding, environment setup, codegen) will have the same shape and trip the same hook.

## Proposed Direction

Add a `rationale_baseline: N` frontmatter key (integer, default `0`). Only trajectory rows with `Writable at > baseline` require a rationale entry.

The hook reads the baseline from frontmatter and adjusts the filter:

```ts
const baseline = Number(frontmatter.rationale_baseline ?? 0);
const rowsNeedingRationale = trajectory.rows.filter(
  (r) => Number.isFinite(r.writableAt) && r.writableAt > baseline,
);
```

Plus the two error messages get baseline-aware wording ("later than Phase ${baseline}" instead of hardcoded "Phase 0").

Default behavior (`baseline=0`) matches today's behavior exactly — no migration risk for existing plans. Plans that need a higher baseline declare it explicitly in their frontmatter.

The `tests-first-planning` ADR (or wherever indusk documents trajectory frontmatter) gains a one-paragraph entry naming the new key, when to use it, and the default.

## Context

- Source of truth: `apps/indusk-mcp/hooks/validate-impl-structure.js` — propagated to consumer projects via `indusk update` (mirror at `.claude/hooks/validate-impl-structure.js`).
- Companion file: `apps/indusk-mcp/src/lib/trajectory/validator.ts` — TS source mirror of the hook, also needs the baseline-aware filter for parity.
- Companion JS files (per CLAUDE.md gotcha about JS-port-mirrors-TS): `check-gates.js`, `gate-reminder.js` may also reference the same rationale logic — audit during impl to see if they need the same treatment.
- The fix's own dogfooding opportunity: this plan IS exactly a refactor-style plan (changing existing rule), so its own impl.md should USE `rationale_baseline: 1` once the fix lands. That's the test-it-on-itself moment.
- Why this is small but high-leverage: ~5 lines of real code change + 5 lines of test + 1 doc paragraph. But it removes the precedent of "hooks are optional when inconvenient" before that pattern calcifies into "we always use heredoc to bypass."

## Scope

### In Scope
- Add `rationale_baseline` frontmatter parsing to `validate-impl-structure.js` (hook + package source)
- Update the two error messages to be baseline-aware
- Update `apps/indusk-mcp/src/lib/trajectory/validator.ts` (TS source mirror) with the same logic
- Update `apps/indusk-mcp/src/lib/trajectory/parser.ts` if needed for frontmatter exposure
- Document the key: where indusk documents trajectory frontmatter (likely `apps/indusk-docs/src/guide/test-trajectory.md` or similar)
- Two new tests covering the baseline behavior + one regression test for the default
- Audit the JS-port mirrors (`check-gates.js`, `gate-reminder.js`) for any same-treatment needs
- Bump indusk-mcp version + publish + upgrade global

### Out of Scope
- Multi-phase baselines (e.g., "rows are writable at Phase 1 OR Phase 3 but not Phase 2") — nobody has needed this; one integer baseline is sufficient
- Per-row overrides of the rationale-exempt status — if a row needs an exception from the baseline, it should have a real rationale entry (existing escape hatch)
- Migrating existing plans to use the new key (consumer-side follow-up; this plan ships the mechanism)
- Lint/flag heredoc-bypass patterns as anti-pattern (separate small follow-up plan worth considering)

## Success Criteria

- A plan with `rationale_baseline: 1` and all rows at `Writable at: Phase 1` and an empty Rationale subsection passes the hook (and the validator) cleanly
- A plan with `rationale_baseline: 1` and one row at `Writable at: Phase 3` and an empty Rationale subsection fails with an error message naming the single Phase-3 row
- An existing plan without the key continues to behave identically to today (baseline defaults to 0)
- Indusk-mcp ships the fix; Numero (and other consumer projects) can pull it via `indusk update` and immediately use the new key in upcoming plans (`restart-recovery`, `coc4-verification-debt-audit`, `drop-compat-views`)

## Depends On

None — independent of any other queued work.

## Blocks

- Numero's three follow-up plans named in Numero's brief (`restart-recovery`, `coc4-verification-debt-audit`, `drop-compat-views`) — each has Phase 1 as enabling work and would trip the hook the same way `table-lifecycle-unification` did. They CAN proceed without the fix (heredoc bypass exists) but would set the wrong precedent.
- Future schema-migration / scaffolding plans across any indusk-using project.
