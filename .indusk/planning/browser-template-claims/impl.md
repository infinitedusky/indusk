---
title: "Browser template claims — an entry covers what it names"
date: 2026-10-11
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Browser template claims — an entry covers what it names

## Goal

A propagation entry sends the click's trace to the requests it names and to no others, whether it is exact or a pattern, with or without a path or a default port; and the reference page says only what the template does about async handlers (brief promise 1; the falsification of `browser-telemetry-leftovers`).

## Scope

### In Scope
- `apps/indusk-mcp/templates/instrumentation.web.ts`: path-keeping for exact entries, default-port tolerance for pattern entries.
- `apps/docs/src/reference/tools/otel.md`: the falsified `.then()` line, and the two entry rules.
- `apps/indusk-mcp/extensions/otel/skill.md` and the changelog: the same rules.

### Out of Scope
- An async-aware context manager (zone.js was tried and declined; `known-issues.md` carries the follow-up).
- Anything in `init`.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | T1–T4 in the browser project; T5 in the node suite | today's template and docs |
| Build Phase 1 | the entry rules in the template; the corrected docs | Test Phase 1's tests |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | With an exact entry that names a path (`https://api.example.com/v1`), a request to `/v1/seats` carries the click's trace; requests to `/v2/seats` and `/v10/seats` on the same origin carry none | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T2 | With a pattern entry that names a path (`https://*.dev.example.com/v1`), a request under `/v1` on a matching host carries the trace and one under `/v2` on the same host carries none | Test Phase 1 | Test Phase 1 | planned | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T3 | With `https://*.dev.example.com:443`, a request to `https://plan-a.dev.example.com/api` carries the trace; with `https://*.dev.example.com:8443`, a request to port 8443 carries it and one to the default port carries none | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T4 | A request made from a `.then()` callback and one from a timer in a click handler are not in the click's trace | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard pinning the documented limit: the template has no async-aware context manager | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T5 | The OpenTelemetry reference page and the otel skill do not say that a `.then()` chain, a timer or compiled-down async code follows the click | Test Phase 1 | Build Phase 1 | planned | unit | the falsified claim: the reference page said a `.then()` chain compiled below ES2017 follows the click | apps/indusk-mcp/src/__tests__/otel-docs-claims.test.ts |

## Checklist

### Test Phase 1: Author T1–T5 against today's template and docs

**Tier**: med — the work step's default

**Goal**: author T1–T5; T1, T3 and T5 fail on their own assertions today; T2 and T4 pass today (see Regression Guards).

- [ ] Confirm this plan's worktree (`indusk plans start` made it at `dusk-worktrees/browser-template-claims`)
- [ ] T1–T4 in `templates/instrumentation.web.test.ts`, with the existing `clickAndFetch` helper (a `thenCallback` option for T4's handler shape)
- [ ] T5 in `src/__tests__/otel-docs-claims.test.ts`: read `apps/docs/src/reference/tools/otel.md` and `apps/indusk-mcp/extensions/otel/skill.md`; fail when a sentence names a `.then()` chain, a timer, `setTimeout` or "ES2017" together with following the click
- [ ] Confirm each red test fails on its own assertion rather than a missing import

#### Regression Guards

- **T2** — a pattern entry already keeps its path as a prefix (the compiled regex carries the path); the row pins that the change to exact entries leaves it so.
- **T4** — the template has never carried async context across a `.then()`; the row pins the limit the documentation now states.

#### Test Phase 1 Verification

- [ ] T1–T5 authored; T1, T3, T5 red on their own assertions, T2 and T4 pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts`)

### Build Phase 1: The entry rules and the corrected docs

**Tier**: med — the work step's default

**Goal**: an exact entry keeps its path; a pattern entry's default port is optional; the docs state the limit truthfully.

- [ ] `templates/instrumentation.web.ts`: an entry without `*` is normalized through `new URL(entry)` to `origin + pathname` (trailing slash trimmed, path kept); an entry with `*` and an explicit default port (`:443` under `https`, `:80` under `http`) makes the port optional in its pattern; other ports stay literal (T1, T3)
- [ ] `apps/docs/src/reference/tools/otel.md`: the "A limit" paragraph says only a request made synchronously in the click handler follows the click, and drops the `.then()`/ES2017 clause; the entry rules say an entry with a path covers that path and what is under it, and that a default port may be written or left off for patterns as for exact entries (T5)
- [ ] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here

#### Build Phase 1 Verification

- [ ] T1–T5 pass; the earlier template rows (the file's existing cases, named A1–A3 and A9–A13 by the earlier plan) still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts src/__tests__/init-browser-telemetry.test.ts`); tsc and biome clean on changed files

#### Build Phase 1 Context

- [ ] `apps/indusk-mcp/extensions/otel/skill.md`: an entry with a path covers that path and what is under it; only a request made synchronously in the click handler follows the click

#### Build Phase 1 Document

- [ ] `apps/docs/src/changelog.md`: Fixed — "A propagation entry with a path no longer widens to the whole origin, a pattern entry with a default port matches, and the reference no longer says a `.then()` chain follows the click"

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/templates/instrumentation.web.ts` | entry rules |
| `apps/indusk-mcp/templates/instrumentation.web.test.ts` | T1–T4 |
| `apps/indusk-mcp/src/__tests__/otel-docs-claims.test.ts` | new — T5 |
| `apps/docs/src/reference/tools/otel.md`, `apps/indusk-mcp/extensions/otel/skill.md`, `apps/docs/src/changelog.md` | the corrected claims |

## Dependencies

- None.

## Notes

- This plan's rows are T-prefixed because the template test file already carries cases named A1–A13 from `browser-telemetry-leftovers`.
