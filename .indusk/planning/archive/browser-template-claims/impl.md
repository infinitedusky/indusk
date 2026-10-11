---
title: "Browser template claims — an entry covers what it names"
date: 2026-10-11
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
cleanup: skipped
cleanup_reason: "reviewed all 6 changed files (listOversizedChangedFiles flagged two: changelog.md at 1061 lines is append-only and this plan added one entry, otel.md at 448 lines is a reference page this plan touched in two paragraphs). instrumentation.web.ts is 171 lines and already split into parsePropagateTo, normalizeExactEntry and entrySource, one job each; the two test files are under the cap and each case has one subject; the docs guard's helper and constant live in the one test file that uses them, with no second copy anywhere. Nothing warrants extraction."
accepted: 2026-10-11T02:45:46.202Z
accepted_by: person
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
| T1 | With an exact entry that names a path (`https://api.example.com/v1`), a request to `/v1/seats` carries the click's trace; requests to `/v2/seats` and `/v10/seats` on the same origin carry none | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T2 | With a pattern entry that names a path (`https://*.dev.example.com/v1`), a request under `/v1` on a matching host carries the trace and one under `/v2` on the same host carries none | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T3 | With `https://*.dev.example.com:443`, a request to `https://plan-a.dev.example.com/api` carries the trace; with `https://*.dev.example.com:8443`, a request to port 8443 carries it and one to the default port carries none | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T4 | A request made from a `.then()` callback and one from a timer in a click handler are not in the click's trace | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard pinning the documented limit: the template has no async-aware context manager | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T5 | The OpenTelemetry reference page and the otel skill do not say that a `.then()` chain, a timer or compiled-down async code follows the click | Test Phase 1 | Build Phase 1 | passing | unit | the falsified claim: the reference page said a `.then()` chain compiled below ES2017 follows the click | apps/indusk-mcp/src/__tests__/otel-docs-claims.test.ts |
| T6 | With an exact entry `https://api.example.com/Admin` and a pattern entry `https://*.dev.example.com/Admin`, a request to `/Admin` carries the trace and a request to `/admin` (a different resource) carries none; host and scheme case in an entry still do not matter | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T7 | The docs guard from T5 flags a reworded regression of the falsified claim — "A request from a `.then()` chain follows the click, not only synchronous ones." — and still passes the current wording of the limit | Build Phase 2 | Build Phase 2 | passing | unit | the guard guarding the falsified claim: T5 exempted any sentence containing "no" or "not", so a rewording that kept the claim would pass | apps/indusk-mcp/src/__tests__/otel-docs-claims.test.ts |
| T8 | An entry that carries a query or a fragment covers what it names the way the same entry without it does, for an exact entry and a pattern entry alike: `https://api.example.com/v1?x=1` and `https://*.dev.example.com/v1?x=1` each cover `/v1/seats` and not `/v2/seats` | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-propagation-entry-covers-what-it-names | apps/indusk-mcp/templates/instrumentation.web.test.ts |

## Checklist

### Test Phase 1: Author T1–T5 against today's template and docs

**Tier**: med — the work step's default

**Goal**: author T1–T5; T1, T3 and T5 fail on their own assertions today; T2 and T4 pass today (see Regression Guards).

- [x] Confirm this plan's worktree (`indusk plans start` made it at `dusk-worktrees/browser-template-claims`)
- [x] T1–T4 in `templates/instrumentation.web.test.ts`, with the existing `clickAndFetch` helper (a `thenCallback` option for T4's handler shape)
- [x] T5 in `src/__tests__/otel-docs-claims.test.ts`: read `apps/docs/src/reference/tools/otel.md` and `apps/indusk-mcp/extensions/otel/skill.md`; fail when a sentence names a `.then()` chain, a timer, `setTimeout` or "ES2017" together with following the click
- [x] Confirm each red test fails on its own assertion rather than a missing import
  - Confirmed 2026-10-11: T1 `/v2/seats carries none: expected '00-…' to be null`; T3 `:443 written in the entry matches a request whose URL leaves it off: expected null not to be null`; T5 (reference page) `expected [ Array(1) ] to deeply equal []`. T2 and T4 pass (Regression Guards). T5 is two cases, one per page: the otel skill page passes today, only the reference page is red.

#### Regression Guards

- **T2** — a pattern entry already keeps its path as a prefix (the compiled regex carries the path); the row pins that the change to exact entries leaves it so.
- **T4** — the template has never carried async context across a `.then()`; the row pins the limit the documentation now states.

#### Test Phase 1 Verification

- [x] T1–T5 authored; T1, T3, T5 red on their own assertions, T2 and T4 pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts`)
  - Ran 2026-10-11: templates project 2 failed (T1, T3), 8 passed (incl. T2, T4), 1 skipped (A11 of the earlier plan); node file otel-docs-claims 1 failed (T5, reference page), 1 passed (skill page). `tsc --noEmit` clean; biome clean on the two files.

### Build Phase 1: The entry rules and the corrected docs

**Tier**: med — the work step's default

**Goal**: an exact entry keeps its path; a pattern entry's default port is optional; the docs state the limit truthfully.

- [x] `templates/instrumentation.web.ts`: an entry without `*` is normalized through `new URL(entry)` to `origin + pathname` (trailing slash trimmed, path kept); an entry with `*` and an explicit default port (`:443` under `https`, `:80` under `http`) makes the port optional in its pattern; other ports stay literal (T1, T3)
- [x] `apps/docs/src/reference/tools/otel.md`: the "A limit" paragraph says only a request made synchronously in the click handler follows the click, and drops the `.then()`/ES2017 clause; the entry rules say an entry with a path covers that path and what is under it, and that a default port may be written or left off for patterns as for exact entries (T5)
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`instrumentation.web.ts`, `otel-docs-claims.test.ts`, the template test): nothing found. The entry compiler split into three named functions with one job each — `parsePropagateTo` (list → patterns, warnings), `normalizeExactEntry` (an entry without `*`, spelled as a request URL), `entrySource` (what an entry names → RegExp source); the docs test's sentence filter is one named function.

#### Build Phase 1 Verification

- [x] T1–T5 pass; the earlier template rows (the file's existing cases, named A1–A3 and A9–A13 by the earlier plan) still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts src/__tests__/init-browser-telemetry.test.ts`); tsc and biome clean on changed files
  - Ran 2026-10-11: templates project 10 passed, 1 skipped (the earlier plan's A11); `otel-docs-claims` 2/2; `init-browser-telemetry` 4/4; `vitest related` 1 file 2/2; `tsc --noEmit` clean; biome clean on templates and the new test; `indusk promises check` clean.

#### Build Phase 1 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md`: an entry with a path covers that path and what is under it; only a request made synchronously in the click handler follows the click

#### Build Phase 1 Document

- [x] `apps/docs/src/changelog.md`: Fixed — "A propagation entry with a path no longer widens to the whole origin, a pattern entry with a default port matches, and the reference no longer says a `.then()` chain follows the click"

### Build Phase 2: Falsification — path case, the docs guard, the promise's code site

**Tier**: med — the work step's default

**Goal**: verify whether the attested state holds against three failure modes found by reading Build Phase 1's code: an entry's path compared case-insensitively (the `i` flag the entry compiler carries from when only hosts were compared), so `/Admin` also covers `/admin`; a docs guard whose "not" exemption lets a reworded claim through; and the promise's code site, which no code names yet, so `indusk promises confirm` would refuse. T6 and T7 are authored red first.

- [x] T6 and T7 authored red in the two existing test files, each failing on its own assertion (`/admin` carries a traceparent under an entry that names `/Admin`; the reworded sentence is not flagged)
  - Confirmed 2026-10-11: T6 `https://api.example.com/Admin: /admin (another resource) carries none: expected '00-…' to be null`; T7 `a reworded claim is flagged: expected [] to have a length of 1 but got +0`.
- [x] `templates/instrumentation.web.ts`: the entry compiler lower-cases the scheme and authority of an entry (a request URL's are always lower-case) and compiles without the `i` flag, so the path is compared as written (T6)
- [x] `src/__tests__/otel-docs-claims.test.ts`: exempt only a sentence that says the request is in its own trace, not in the click's trace, or outside the click; a bare "not" no longer exempts (T7)
- [x] `templates/instrumentation.web.ts`: a comment at `parsePropagateTo` saying `promise: a-propagation-entry-covers-what-it-names`, so the promise's code site exists when the plan closes
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`instrumentation.web.ts`, `otel-docs-claims.test.ts`, the template test): nothing found. `entrySource` keeps one job (what an entry names → source) and now lower-cases only scheme and authority in one place; the docs guard's exemption became a named constant with a stated meaning.

#### Build Phase 2 Verification

- [x] T6 and T7 fail on their own assertions first, then pass; T1–T5 and the earlier plan's cases still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts`); `indusk promises confirm browser-template-claims` no longer refuses for a missing code site; tsc and biome clean on changed files
  - Ran 2026-10-11: templates project 11 passed, 1 skipped (the earlier plan's A11), twice; `otel-docs-claims` 3/3; `vitest related` 1 file 3/3; `tsc --noEmit` clean; biome clean on the changed files. `indusk promises confirm browser-template-claims` named one refusal, row T6 still `written` (no longer the missing code site); the promise files were restored afterwards because confirm is the retrospective's step.

#### Build Phase 2 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md`: a path in an entry is compared case-sensitively; host and scheme are not

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/tools/otel.md`: the same sentence beside the path rule; changelog line extended

### Build Phase 3: The cold audit's one confirmed defect — a query on a pattern entry

**Tier**: med — the work step's default

**Goal**: the promise says an exact entry and a pattern entry treat an entry the same way; the cold audit showed a query or fragment on an entry is dropped for an exact entry and kept literally (so it matches nothing) for a pattern entry. T8 is authored red first. The audit's other findings are recorded in the retrospective, not fixed here.

- [x] T8 authored red in `templates/instrumentation.web.test.ts`, failing on its own assertion (the pattern entry with `?x=1` covers no request)
  - Confirmed 2026-10-11: `https://*.dev.example.com/v1#top: /v1/seats carries traceparent: expected null not to be null`; the exact entry's case in the same test passes.
- [x] `templates/instrumentation.web.ts`: the query and fragment are cut from an entry before it is compiled, for every entry, so an exact entry and a pattern entry agree
- [x] `templates/instrumentation.web.ts`: the header comment (the file's top) says an entry is an origin with its scheme, may carry a path, and may write a default port, with the pointer to the rules above `parsePropagateTo`
- [x] Shape — review the files this phase changed against the enabled extensions' craft rules; findings become items here
  - Reviewed 2026-10-11 (`instrumentation.web.ts`, the template test): nothing found. The cut sits in `parsePropagateTo` beside the trailing-slash trim, one statement with a comment saying why; the header comment now matches the rules.

#### Build Phase 3 Verification

- [x] T8 fails on its own assertion first, then passes; T1–T7 and the earlier plan's cases still pass (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.templates.config.ts && pnpm exec vitest run src/__tests__/otel-docs-claims.test.ts`); tsc and biome clean on changed files
  - Ran 2026-10-11: templates project 12 passed, 1 skipped (the earlier plan's A11), twice; `otel-docs-claims` 3/3; tsc and biome clean.

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/extensions/otel/skill.md`: a query or fragment written on an entry is ignored, for exact and pattern entries alike

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/tools/otel.md`: the same sentence beside the path rule; changelog line extended

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
