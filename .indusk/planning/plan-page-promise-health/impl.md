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
approved_brief: "a6d6079ceab5321750014d569f76563aafa3d42e6455e69a3a27d3aef9e773dc"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T18:18:43.483Z"
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
| A1 | A plan whose enforced behaviour promise has a break no incident records shows that promise's dot in the broken colour on its plan's page, not the healthy green it shows today | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-promise-reads-the-same-on-its-plan-page/broken-reads-broken | apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts, apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A2 | On a plan's page, a promise that broke and was fixed, one seen holding, one with no signal, one known broken and a state promise each show the colour the Promises page gives them, and the enforced behaviour promise nothing has reported on is grey, not green | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike | apps/indusk-admin/src/__tests__/plan-parts.test.tsx |
| A3 | For a project with a production source holding and a local break, the plan's parts read each promise's health exactly as the nav's red dot does, from the alarm source, so a laptop break alone does not turn the plan page red | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-promise-reads-the-same-on-its-plan-page/no-rule-of-its-own | apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts |
| A4 | On a plan's page, an enforced behaviour promise that the plan's checkout registers and the trunk's registry does not (added, or changed to a behaviour promise, on the plan's branch and confirmed there) reads no signal, not green; today the health is computed over the trunk's registry alone, so it has no entry and falls back to the enforced state's green | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-promise-reads-the-same-on-its-plan-page/each-health-alike | apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts |

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

- [x] The package's own test reads health through the package's answer rather than a copy of the nav's rule.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts`: the `alarmHealth` helper is replaced by `planPromiseHealth`, and the `as unknown as` cast on `readPlanParts` is gone now that the option and field exist. No assertion changes.

  </details>

- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] The three tests pass, the files that depend on the changed modules still pass, and the plan and brief pages' looks still hold.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plan-parts-health.test.ts && pnpm exec vitest related --run src/lib/promises/health.ts src/lib/plans/parts.ts && pnpm exec tsc --noEmit`; `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx && pnpm exec vitest related --run src/components/plan/PlanParts.tsx "src/app/p/[project]/plan/[name]/page.tsx" "src/app/p/[project]/plan/[name]/brief/page.tsx"`; `indusk looks lint admin`. A1, A2, A3 to `passing` in the same edit.

  </details>

#### Build Phase 1 Context

- [x] The admin's context file says a plan's promise chips take their colour from the package's health, as the nav does.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the plan-parts rule ("A plan's page shows its brief's three parts from `plans/parts` and computes none"): add "each promise's dot is its health from `planPromiseHealth` (the alarm source, as the nav's red), its registry state only when telemetry says nothing". Root `CLAUDE.md` gets no line: a bugfix with no ADR.

  </details>

#### Build Phase 1 Document

- [x] The admin reference says the plan page's promise dots show each promise's health.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, the plan page's Promises part: the dot is the promise's health in the Promises page's colours, its registry state for a state or structure promise. Changelog (Unreleased, Fixed): "A plan's page no longer shows a broken promise as healthy."

  </details>

### Build Phase 2: Falsification — a promise the trunk does not yet register

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase tests whether a promise with no signal can still look healthy on its plan's page. The page reads each promise from the plan's own branch, but its health from the trunk's list of promises, so a behaviour promise that exists only on the branch gets no health and falls back to the green of an enforced promise. The fix answers health for those promises too, through the same rule, so once this phase closes a promise nothing has reported on is never green on its plan's page.

- [x] A behaviour promise that only the plan's branch registers gets its health from the package's rule, so it reads no signal until telemetry reports on it.
  <details><summary>Technical</summary>

  Answers A4. `planPromiseHealth(registry, reads, extra: PromiseEntry[] = [])` in `apps/indusk-mcp/src/lib/promises/health.ts` also runs `healthOf(p, alarmRead(reads) ?? null, registry.incidents)` for each `extra` promise the trunk's registry lacks, so its incidents and source stay the nav's; a behaviour promise outside the read window has no marks and reads `unverified`. `readPlanHealth(projectPath, checkout)` in `apps/indusk-admin/src/lib/plan-health.ts` passes the checkout registry's promises absent from the trunk's (none when `checkout` is the project); `plan/[name]/page.tsx` and `brief/page.tsx` pass `checkout`. `redPlans` keeps calling it with no `extra`.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] The test for a branch-only behaviour promise fails before the fix and passes after it, and the earlier three still pass.
  <details><summary>Technical</summary>

  A4: fixture through `helpers/promises-fixture.ts` with a trunk registry lacking an enforced behaviour promise that a second (checkout) registry holds, owned by the plan; `readPlanParts(checkout, plan, { health: planPromiseHealth(trunk, reads, extra) })` with a holding alarm read that has no marks for it — the promise's `health` is `unverified`, never absent (absent draws `DOT.enforced`, `bg-ok`). `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plan-parts-health.test.ts && pnpm exec vitest related --run src/lib/promises/health.ts && pnpm exec tsc --noEmit`; `cd apps/indusk-admin && pnpm exec vitest related --run src/lib/plan-health.ts "src/app/p/[project]/plan/[name]/page.tsx" "src/app/p/[project]/plan/[name]/brief/page.tsx"`. A4 to `written` when authored red, `passing` in the closing edit.

  </details>

#### Build Phase 2 Context

- [x] The admin's context file says a promise only the plan's branch registers takes its health from the same rule.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the plan-parts rule this plan's Build Phase 1 Context item extended: add "— a promise only the plan's checkout registers too, so no signal is never the enforced green".

  </details>

#### Build Phase 2 Document

- [x] The admin reference says a behaviour promise new on the plan's branch shows no signal until telemetry reports on it.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, the plan page's Promises part: one clause after the health sentence Build Phase 1 wrote.

  </details>

### Build Phase 3: Cleanup — one source for each health fact, one mock for the health read

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This plan taught a plan's page to colour each promise by its health. Along the way three things were written twice across files: the dot colours copy the Promises page's chip colours by hand, the admin's health reader repeats a "skip promises the trunk already knows" filter the package's rule already applies, and six page tests each carry the same seven-line stand-in for the health read where a shared test helper already holds its siblings. Once this phase closes, each of those facts lives in one place and the page behaves exactly as it does now.

- [x] Give the Promises page's chip colours a dot colour for each health, and have the plan page's promise dots read it instead of keeping their own copy.
  <details><summary>Technical</summary>

  Add a `dot` field (`bg-bad`, `bg-ink-soft`, `bg-ok`, `bg-idle`, `bg-warn`, `bg-idle`) to each entry of `PROMISE_HEALTH_CHIP` in `apps/indusk-admin/src/components/bars/labels.ts`; delete `HEALTH_DOT` from `apps/indusk-admin/src/components/plan/PlanParts.tsx` and draw `PROMISE_HEALTH_CHIP[p.health].dot`. Basis: one source of truth across files — `HEALTH_DOT`'s own doc comment says it is "the colours of `PROMISE_HEALTH_CHIP`", a promise kept by a comment, so a chip colour change would leave the plan page's dots behind with nothing failing but A2. `DOT` (registry state) stays in `PlanParts.tsx`: it has no counterpart elsewhere.

  </details>
- [x] Drop the admin health reader's own filter for promises the trunk already registers, and hand the package every promise the plan's checkout registers.
  <details><summary>Technical</summary>

  In `apps/indusk-admin/src/lib/plan-health.ts`, `readPlanHealth` builds `known` and filters `own.promises` by it; `planPromiseHealth` in `apps/indusk-mcp/src/lib/promises/health.ts` does the same skip (`if (known.has(p.name)) continue`). Pass `own?.promises ?? []` and delete the reader's `known`/`extra`, so the rule of which promise the trunk answers for lives only in the package, where the doc comment on `planPromiseHealth` states it. Behaviour unchanged; A4 holds it.

  </details>
- [ ] Move the six identical stand-ins for the plan page's health read into the shared cockpit test helper, beside the stand-ins for the other readers.
  <details><summary>Technical</summary>

  Add `planHealthMock()` returning `{ __esModule: true, readPlanHealth: async () => ({}) }` to `apps/indusk-admin/src/__tests__/helpers/cockpit-fixture.ts`, next to `planningReaderMock`/`promisesReaderMock`; replace the inline `vi.mock("@/lib/plan-health", …)` in `cockpit-phone.test.tsx` and `plan/[name]/{page,header,decision,master,workflows}.test.tsx` with `vi.mock("@/lib/plan-health", async () => (await import("@/__tests__/helpers/cockpit-fixture")).planHealthMock())`, keeping the one-line comment. Basis: rule of three (six copies) and the fixture's established idiom. The `@infinitedusky/indusk-mcp/plans/parts` stand-in beside it is also repeated but predates this plan and one of the six copies differs; left for its own change.

  </details>
- [ ] Review the package's health module, which is over the size threshold, and leave it as it is.
  <details><summary>Technical</summary>

  Reviewed `apps/indusk-mcp/src/lib/promises/health.ts` (572 lines, cap 400) — left as-is: this plan added the 25-line `planPromiseHealth`, which composes `alarmRead`, `healthRows` and `healthOf` and is what `redPlans` beside it now reads; moving it out would separate the nav's roll-up from the per-promise answer it is built on. Splitting the module's older reading and incident halves is not this plan's output.

  </details>
- [ ] Review the changelog, which is over the size threshold, and leave it as it is.
  <details><summary>Technical</summary>

  Reviewed `apps/docs/src/changelog.md` (1116 lines, cap 400) — left as-is: an append-only log; this plan added one Fixed line.

  </details>
- [ ] Review the remaining changed files, all under the threshold, and leave them as they are.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/parts.ts` (an optional `health` option threaded through), `plan/[name]/page.tsx` and `brief/page.tsx` (one argument each — the two call sites are the same two lines, but each page already repeats the `readPlanParts` call around them; folding them belongs to whatever unifies the two pages' reads), and the two test files `plan-parts.test.tsx` and `plan-parts-health.test.ts` (each tests one side of the boundary; no shared fixture between the admin's browser project and the package's node tests).

  </details>

#### Build Phase 3 Verification

- [ ] The plan page draws every promise in the same colour as before, the branch-only promise still reads no signal, and every page test still passes with the shared stand-in.
  <details><summary>Technical</summary>

  No row flips — structure-preserving refactor under A1–A4. `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/plan-parts.test.tsx && pnpm exec vitest related --run src/components/bars/labels.ts src/components/plan/PlanParts.tsx src/lib/plan-health.ts src/__tests__/helpers/cockpit-fixture.ts && pnpm exec tsc --noEmit`; `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/plan-parts-health.test.ts`; `pnpm check`.

  </details>

#### Build Phase 3 Context

- [ ] Nothing to add to the project's instructions: the change is internal and the rule the admin's context file states is unchanged.
  <details><summary>Technical</summary>

  (none — internal decomposition) `apps/indusk-admin/CLAUDE.md` already says a plan's promise dot is its health from the package's one rule; where the colour constant lives is not a rule.

  </details>

#### Build Phase 3 Document

- [ ] Nothing to change in the docs: no page, command or behaviour a reader sees changes.
  <details><summary>Technical</summary>

  (none — internal decomposition) `apps/docs/src/reference/admin-ui/overview.md` describes colours, not where they are defined.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/health.ts` | `planPromiseHealth`; `redPlans` through it |
| `apps/indusk-mcp/src/lib/plans/parts.ts` | `health` option, `PartPromise.health` |
| `apps/indusk-admin/src/components/plan/PlanParts.tsx` | dot from health, else state |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx`, `brief/page.tsx` | read health, pass it in (and the checkout, Build Phase 2) |
| `apps/indusk-admin/src/lib/plan-health.ts` | the plan page's health read; promises only the checkout registers (Build Phase 2) |
| `apps/indusk-mcp/src/__tests__/plan-parts-health.test.ts`, `apps/indusk-admin/src/__tests__/plan-parts.test.tsx` | the three rows |
| `apps/indusk-admin/CLAUDE.md`, `apps/docs/src/reference/admin-ui/overview.md`, `apps/docs/src/changelog.md` | context and docs |

## Dependencies

- None.

## Notes

- Found 2026-10-17 at the close of `daemon-found-not-guessed`: its promise read broken in the nav and on the Promises page from the live check's deliberate breaks, while its plan page showed it green.
- Falsification, 2026-10-17. Investigated without a hypothesis forming: an unreachable or blind alarm source (every behaviour promise reads no signal, not green); retired and known-broken promises (grey and amber, as on the Promises page); a malformed or partial trunk registry (`registryOf` takes the partial one); the health cache shared with the layout (one key per project, the same reads). Not authored, as the accepted brief settles them: a promise broken locally while production holds it is red in the Promises page's local column but not on its plan's page — the brief's `no-rule-of-its-own` clause chose the nav's alarm source, and its first expectation, which said "broken on the Promises page … never looks healthy", was amended 2026-10-17 to name the alarm source; and `HEALTH_DOT` copies `PROMISE_HEALTH_CHIP`'s colours by hand rather than deriving them, which is `/cleanup`'s.
