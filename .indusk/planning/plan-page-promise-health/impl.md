---
title: "A promise reads the same on its plan's page"
date: 2026-10-17
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "aba611bbb56f660c8976c8a6c17dadff5082af263a031426f2d61c92f103100b"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T17:59:19.867Z"
---

# A promise reads the same on its plan's page

## Goal

Make true the [brief](brief.md)'s promise `a-promise-reads-the-same-on-its-plan-page`: a plan's page and its brief page colour each promise by the health the Promises page shows, from the same rule. Today `PlanParts` (`apps/indusk-admin/src/components/plan/PlanParts.tsx`) colours a promise from its registry state alone (`DOT[p.state]`), so an enforced promise is green whatever its health, including a broken one.

## Scope

### In Scope
- One package answer for each promise's health from the alarm source (the half of `redPlans` the nav uses), handed to `readPlanParts` and carried on each part promise.
- The plan page and the brief page read the health once and pass it in; `PlanParts` colours the dot from it, with the same foundation colours the Promises page uses, falling back to the registry state for a promise telemetry says nothing about.

### Out of Scope
- A word beside each dot (it would change the approved looks).
- Any change to the Promises page, the nav or the health rule itself.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the three rows, red | `readPlanParts`, `PlanParts`, `healthRows`, `alarmRead` as they stand |
| Build Phase 1 | `planPromiseHealth` in `lib/promises/health.ts`; `readPlanParts`' `health` option and `PartPromise.health`; `PlanParts`' health colours; both pages reading health | the red rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan whose enforced behaviour promise has a break no incident records shows that promise's dot in the broken colour on its plan's page, not the healthy green it shows today | Test Phase 1 | Build Phase 1 | written | unit | clause: a-promise-reads-the-same-on-its-plan-page/broken-reads-broken | apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts, apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A2 | On a plan's page, a promise that broke and was fixed, one seen holding, one with no signal, one known broken and a state promise each show the colour the Promises page gives them, and the enforced behaviour promise nothing has reported on is grey, not green | Test Phase 1 | Build Phase 1 | written | unit | clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A3 | For a project with a production source holding and a local break, the plan's parts read each promise's health exactly as the nav's red dot does, from the alarm source, so a laptop break alone does not turn the plan page red | Test Phase 1 | Build Phase 1 | written | unit | clause: a-promise-reads-the-same-on-its-plan-page/no-rule-of-its-own | apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts |

## Checklist

### Test Phase 1: The plan page's colours, written red

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase writes the three tests that say what the plan page must show: a broken promise in the broken colour, every other health in the colour the Promises page gives it, and the same answer the nav's red dot gives. Each runs against the package and the component as they are today and fails on what it asserts, since neither carries a promise's health yet. The build phase then makes them pass.

- [x] The three tests are written and each fails on what it asserts.
  <details><summary>Technical</summary>

  A1 and A3 in new `apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts`: a fixture project through `helpers/promises-fixture.ts` with a plan owning an enforced behaviour promise; `readPlanParts(root, plan, { health })` with `health` from fake source reads (local break, no incident; for A3 also a `production` read holding) — today the option is ignored, so `promises[0].health` is undefined and the assertion fails. A1's and A2's drawing halves in `apps/indusk-admin/src/__tests__/plan-parts.test.tsx`: render `PlanParts` with parts whose promises carry `health` (`red`, `fixed`, `green`, `unverified`, `amber`, a state promise with none) and assert each dot's colour class is the Promises page's for that health (`bg-bad`, `bg-ink-soft`, `bg-ok`, `bg-idle`, `bg-warn`; the state promise its registry colour) — today every enforced promise is `bg-ok`. Each file carries `promise: a-promise-reads-the-same-on-its-plan-page` and each test its clause comment.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Test Phase 1 Verification

- [x] The tests this phase writes exist and each fails on its own assertion, not on a missing import.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plan-parts-health.test.ts` and `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx` — A1, A2, A3 red on their assertions. Rows' State to `written` in the same edit.

  </details>

### Build Phase 1: The plan page colours each promise by its health

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase gives a plan's parts each promise's health, from the same rule and source as the nav's red dot, and has the plan page and the brief page colour each dot by it. A promise telemetry says nothing about keeps the colour of its registry state. When it closes, a broken promise is red on its plan's page, as on the Promises page, and nothing about the pages' layout has changed.

- [x] The package answers each promise's health from the alarm source, and a plan's parts carry it.
  <details><summary>Technical</summary>

  `planPromiseHealth(registry, reads): Record<string, PromiseHealth>` in `apps/indusk-mcp/src/lib/promises/health.ts`, `healthRows(registry, alarmRead(reads) ?? null)` mapped to `health`; `redPlans` reads through it so the nav and the plan page share one answer. `readPlanParts` (`apps/indusk-mcp/src/lib/plans/parts.ts:129`) takes `options.health?: Record<string, PromiseHealth>` and sets `health` on each `PartPromise` that has one. Export from the subpaths the admin already imports (`promises/health`, `plans/parts`).

  </details>
- [x] The plan page and the brief page read the health once and colour each promise's dot by it.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx:77` and `.../brief/page.tsx:42`: `readHealth(projectPath, registry)` as the layout does (`app/p/[project]/layout.tsx:94`), then `readPlanParts(checkout, name, { archived, health: planPromiseHealth(registry, reads) })`. `PlanParts.tsx:33-39`: a `HEALTH_DOT` map `satisfies Record<PromiseHealth, string>` (`red: "bg-bad"`, `fixed: "bg-ink-soft"`, `green: "bg-ok"`, `unverified: "bg-idle"`, `amber: "bg-warn"`, `grey: "bg-idle"`), the colours of `PROMISE_HEALTH_CHIP` in `components/bars/labels.ts`; the dot is `HEALTH_DOT[p.health]` when present, else `DOT[p.state]`. Markup unchanged; `data-health` on the chip for tests. Update every browser test's `readPlanParts` mock that the change reaches.

  </details>

- [x] The package's own test reads health through `planPromiseHealth` rather than a copy of the nav's rule.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts`: the `alarmHealth` helper is replaced by `planPromiseHealth`, and the `as unknown as` cast on `readPlanParts` is gone now that the option and field exist. No assertion changes.

  </details>

#### Build Phase 1 Verification

- [ ] The three tests pass, the files that depend on the changed modules still pass, and the plan and brief pages' looks still hold.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plan-parts-health.test.ts && pnpm exec vitest related --run src/lib/promises/health.ts src/lib/plans/parts.ts && pnpm exec tsc --noEmit`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx && pnpm exec vitest related --run src/components/plan/PlanParts.tsx "src/app/p/[project]/plan/[name]/page.tsx" "src/app/p/[project]/plan/[name]/brief/page.tsx"`; `indusk looks lint admin`. A1, A2, A3 to `passing` in the same edit.

  </details>

#### Build Phase 1 Context

- [ ] The admin's context file says a plan's promise chips take their colour from the package's health, as the nav does.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the plan-parts rule ("A plan's page shows its brief's three parts from `plans/parts` and computes none"): add "each promise's dot is its health from `planPromiseHealth` (the alarm source, as the nav's red), its registry state only when telemetry says nothing". Root `CLAUDE.md` gets no line: a bugfix with no ADR.

  </details>

#### Build Phase 1 Document

- [ ] The admin reference says the plan page's promise dots show each promise's health.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, the plan page's Promises part: the dot is the promise's health in the Promises page's colours, its registry state for a state or structure promise. Changelog (Unreleased, Fixed): "A plan's page no longer shows a broken promise as healthy."

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/health.ts` | `planPromiseHealth`; `redPlans` through it |
| `apps/indusk-mcp/src/lib/plans/parts.ts` | `health` option, `PartPromise.health` |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | dot from health, else state |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx`, `brief/page.tsx` | read health, pass it in |
| `apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts`, `apps/indusk-admin/src/__tests__/plan-parts.test.tsx` | the three rows |
| `apps/indusk-admin/CLAUDE.md`, `apps/docs/src/reference/admin-ui/overview.md`, `apps/docs/src/changelog.md` | context and docs |

## Dependencies

- None.

## Notes

- Found 2026-10-17 at the close of `daemon-found-not-guessed`: its promise read broken in the nav and on the Promises page from the live check's deliberate breaks, while its plan page showed it green.
