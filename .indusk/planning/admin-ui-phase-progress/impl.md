---
title: "Admin UI Phase Progress — Implementation"
date: 2026-09-16
status: approved
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Admin UI Phase Progress — Implementation

## Goal

One lifecycle definition in indusk-mcp, read by `parsePlan`, the retrospective
gate and the admin; phases keyed `{kind, number}` through progress, Shape and
the boundary record; the admin's phase view built on the package parser; three
tri-state bars (phase, plan, master) that update live; the sidebar root node;
registry prune and a closed leak; scorecards that say why they are empty; the
admin's type-check green and gated; and the convention that a plan adding a
stage renders it, pinned by a test. Per `adr.md` (accepted 2026-09-16), D1–D10.

## Scope

### In Scope
- `lib/lifecycle.ts` + subpath exports `lifecycle`, `impl-headings`, `impl-parser`
- `PhaseRef` through `getPhaseCompletion`, all Shape functions, `PhaseBoundaryRecord.kind?`
- Admin `phases.ts` as an adapter over `parseImplString`; the regexes deleted
- Active-phase rule; phase / plan / master bars; `LiveRefresh`
- Sidebar root node; `indusk ui prune`; labelled project list; leak scan; scorecards empty state
- Admin `tsc` gate; lifecycle render-parity pin; lifecycle single-definition pin
- Docs: decisions page, plan-lifecycle guide, admin-ui overview + cli, shape guide, work skill

### Out of Scope
- Verdicts inline (Day 5), `monitor` (Midnight), dark theme, websockets, API routes, any write surface, workbenches-only filter

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Rows A1–A2, A4–A5, A16, A20–A25 RED; A13 snapshot (guard); admin fixtures carry phase kinds; the register | today's admin, `parseImplString`, `checkRetrospectiveReadiness`, the corpus |
| Build Phase 1 | `lib/lifecycle.ts`; exports `lifecycle` / `impl-headings` / `impl-parser`; `STAGE_ORDER` as a projection (+`test-plan`); `cleanup/gate.ts` on the ritual order; `getPhaseCompletion(parsed, ref)` | `impl-headings.ts` (`PhaseRef`, `GateKind`), `plan-parser.ts`, `cleanup/gate.ts` |
| Build Phase 2 | Shape surface on `PhaseRef`; `PhaseBoundaryRecord.kind?`; work skill + shape guide updated | Build Phase 1's `PhaseRef` plumbing |
| Build Phase 3 | admin `phases.ts` adapter; `PhasesSection` on kinds; A25 gate; A3 parity | Build Phase 1's exports |
| Build Phase 4 | `derivePlanPosition` / `derivePhaseActivity` wired; `ActivePhase`, `PhaseBar`, `PlanBar`, `MasterBar`; render-parity pin | Build Phases 1–3 |
| Test Phase 2 | the Playwright-over-`next dev` harness, A14/A15 RED, or the recorded fallback | Build Phase 4's page |
| Build Phase 5 | `LiveRefresh`, `admin.refresh_ms` | Test Phase 2's harness |
| Build Phase 6 | sidebar root; `pruneRegistry` + `ui prune`; labelled list; leak scan fixes; scorecards empty state | `buildGroups`, `lib/admin/registry.ts`, `isWorkbench` |
| Build Phase 7 | decisions page, changelog, masters; convention in CLAUDE.md | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | A plan whose impl has `### Test Phase 1` and `### Build Phase 1…N` renders each as its own phase on the plan page, in document order, each with only its own checklist under it | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A2 | A trajectory row that passes at Test Phase 1 is listed under Test Phase 1, not under Build Phase 1 | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A3 | Every impl in `.indusk/planning/` and its archive renders the same `(kind, number, name, itemCount)` sequence through the admin adapter as the package parser reports | Build Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/lib/phases-corpus-parity.test.ts |
| A4 | Each phase shows its stages — implementation n of m, Verification, Context, Document, OTel when present — each done, pending, or opted-out with the recorded proof text | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A5 | An OTel gate's items appear under an OTel stage, not folded into the stage before it | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A6 | The active phase is the one with the most recent boundary record among phases with unchecked gate items; all gates checked ⇒ closed regardless of record; no records ⇒ first phase with unchecked items, marked "no boundary record" | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/lib/active-phase.test.ts |
| A7 | A malformed line in `.indusk/phase-boundary.jsonl` renders a visible error block on the plan page and no phase is marked active | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/lib/active-phase.test.ts, apps/indusk-admin/src/components/PlanDetail.test.tsx |
| A8 | Every bar segment is one of done / active / pending / skipped; two plans at different positions render bars of the same segment count | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A9 | The active phase stage is partially filled by its n of m and labelled with its verb ("verifying: 2 of 5"); done stages full, later stages empty | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/bars/PhaseBar.test.tsx |
| A10 | The plan bar shows every position research → archived with the current one marked and labelled with what it awaits; a plan with no research document shows research as skipped | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A11 | An executing plan's plan-bar label is the active phase's activity and name ("executing: verifying Build Phase 2"); an archived plan has no active segment | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A12 | A parent's master bar has one segment per declared subplan, filled by each subplan's position, labelled "n of m closed, k executing"; a declared-but-missing subplan is pending | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/components/bars/MasterBar.test.tsx |
| A13 | `parseAllPlans` and `checkRetrospectiveReadiness` produce identical output over every plan folder before and after the lifecycle module lands (snapshot parity) | Test Phase 1 | Test Phase 1 | planned | apps/indusk-mcp/src/__tests__/lifecycle-parity.test.ts |
| A14 | With a plan page open, checking off an impl item on disk changes the phase bar within one polling interval with no reload, and an open collapsible stays open | Test Phase 2 | Build Phase 5 | planned | apps/indusk-admin/src/__tests__/live-refresh.e2e.test.ts |
| A15 | The page shows a "last updated" time that advances on each refresh and shows "refresh failed" and stops when a refresh rejects | Test Phase 2 | Build Phase 5 | planned | apps/indusk-admin/src/__tests__/live-refresh.e2e.test.ts |
| A16 | The admin has no phase-heading regex; exactly one `PLAN_POSITIONS`, one `GATE_STAGES` and one phase-heading parser exist across the package and the admin | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts |
| A17 | Adding a member to `PlanPosition`, `PhaseActivity` or `GateKind` without a label and renderer fails a test naming the missing member | Build Phase 4 | Build Phase 4 | planned | apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts |
| A18 | `prepareShapeReview` for `{kind: "test", number: 1}` on a test-phase impl returns a review, and `recordReviewedNothingFound` for it appends under `### Test Phase 1`'s block | Build Phase 2 | Build Phase 2 | planned | apps/indusk-mcp/src/lib/shape/test-phase-addressing.test.ts |
| A19 | Test Phase 1 and Build Phase 1 of one plan report separate `getPhaseCompletion` counts and separate `findPhaseStart` records; a record without `kind` resolves as build | Build Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/src/lib/phase-ref-identity.test.ts |
| A20 | The sidebar shows one root node with the parent plans and the unclaimed plans under it; a sub-plan declared under two parents appears under both | Test Phase 1 | Build Phase 6 | planned | apps/indusk-admin/src/components/PlanList.test.tsx |
| A21 | `indusk ui prune --dry-run` lists dead entries and writes nothing; `indusk ui prune` removes exactly those, writes `projects.json.bak.<ISO>`, keeps live entries | Test Phase 1 | Build Phase 6 | planned | apps/indusk-mcp/src/__tests__/ui-prune.test.ts |
| A22 | Every test file under both apps that spawns `init`, `update` or `ui` sets `INDUSK_HOME` | Test Phase 1 | Build Phase 6 | planned | apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts |
| A23 | The project list shows every registered project whose path exists, labelled `workbench` or `normal-mode`; a dead entry is not shown as a project | Test Phase 1 | Build Phase 6 | planned | apps/indusk-admin/src/components/ProjectGrid.test.tsx |
| A24 | A project with no eval directory shows "no evaluations recorded yet" on its scorecards page | Test Phase 1 | Build Phase 6 | planned | apps/indusk-admin/src/components/Scorecards.test.tsx |
| A25 | `pnpm exec tsc --noEmit -p .` in `apps/indusk-admin` exits 0, asserted by a test the suite runs | Test Phase 1 | Test Phase 1 | planned | apps/indusk-admin/src/__tests__/typecheck.test.ts |

### Deferred Verification

- **U1 — the plan bar's segment sizes do not mislead about remaining work**
  - reason: UX judgement; no measurement distinguishes "misleading" from "unfamiliar"
  - would require: usage over several plans at different positions
  - mitigation: Sandy reviews the first rendering against three real plans (one planning, one executing, one archived) before Build Phase 4 closes; the bar carries "steps, not time"; the review's verdict is recorded in Build Phase 4's Verification and decides whether a weighted v2 is filed
- **U2 — the polling interval feels live without loading the daemon**
  - reason: depends on machine and habit
  - would require: two weeks of use
  - mitigation: `admin.refresh_ms` config with documented default 5000 and minimum 1000; a dated note in `.indusk/current.md` Project (shared) to revisit on 2026-09-30

## Checklist

### Test Phase 1: Author every assertion that can be authored, RED; fix the fixtures; snapshot the corpus

**Goal**: author every row whose subject exists today, confirm each fails on its own assertion, record the rest with bodies, and make the admin type-check green so A25 can gate from here on.

- [ ] Create/confirm this plan's worktree (`indusk worktree create admin-ui-phase-progress`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [ ] Open the phase boundary (`recordPhaseStart`, plan `admin-ui-phase-progress`, phase 1) per the work skill
- [ ] Fix the ten `TrajectoryRow` fixture errors: add `writableAtKind: "build"` / `passesAtKind: "build"` to every hand-written row in `FalsificationSection.test.tsx`, `PlanDetail.test.tsx`, `markdown-export.test.ts` (no behaviour change; the fields are required by the parser since test-phase-structure)
- [ ] A25 `apps/indusk-admin/src/__tests__/typecheck.test.ts`: spawn `pnpm exec tsc --noEmit -p .` with `cwd` = the admin package, assert exit 0, print stderr on failure — RED before the fixture fix, green after; node project
- [ ] A1/A2/A4/A5 `apps/indusk-admin/src/components/PhasesSection.test.tsx`: render `PlanDetail` (mocks per convention) with a fixture impl carrying `### Test Phase 1`, `### Build Phase 1`, `### Build Phase 2`, gate blocks for each, one `#### Build Phase 1 OTel` block, a row `| A1 | … | Test Phase 1 | Test Phase 1 | passing |`; assert three `phases-section` children in order, each with only its own items; A1's row under the Test Phase 1 child; per-phase stage rows `implementation 2 of 3`, `Verification done`, `Context pending`, `Document opted-out — asked: …`; OTel items under an `OTel` stage — RED (today: one phase, everything folded)
- [ ] A16 `apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts`: (a) `apps/indusk-admin/src/lib/phases.ts` contains no `/Phase\s/`-shaped regex literal; (b) exactly one `export const PLAN_POSITIONS` and one `export const GATE_STAGES` under `apps/indusk-mcp/src/lib`, both in `lifecycle.ts`; (c) no `STAGE_ORDER` array literal outside `lifecycle.ts`; (d) exactly one `PHASE_HEADING` definition (`impl-headings.ts`) — RED (no `lifecycle.ts`; the admin regex exists)
- [ ] A13 `apps/indusk-mcp/src/__tests__/lifecycle-parity.test.ts`: over every folder in `.indusk/planning/` + `archive/`, run `parseAllPlans` (per-folder `{name, stage, stageStatus, nextStep}`) and `checkRetrospectiveReadiness` (where an impl exists), write the result to `src/__tests__/fixtures/lifecycle-parity.snapshot.json` on first run and compare on later runs — passes on authoring (regression guard); `test-plan` joining `STAGE_ORDER` in Build Phase 1 will change `stage` for plans that stopped at a test plan: the expected diff is reviewed and the snapshot re-baselined **by hand, in that phase's Verification, naming each changed plan**
- [ ] A20 `apps/indusk-admin/src/components/PlanList.test.tsx`: render with a grouping whose root master is titled "Root"; assert a root node containing the parent groups and the unclaimed plans, and a plan declared under two parents rendered twice — RED (no root node today)
- [ ] A21 `apps/indusk-mcp/src/__tests__/ui-prune.test.ts`: temp `INDUSK_HOME` with a `projects.json` of two live dirs and two deleted; `indusk ui prune --dry-run` lists the two dead names and leaves the file byte-identical; `indusk ui prune` removes them, leaves the live two, and a `projects.json.bak.*` exists with the pre-prune content — RED (`unknown command 'prune'`)
- [ ] A22 `apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts`: glob `apps/*/src/**/*.test.ts`; for each file whose text spawns the CLI with `init`, `update` or `ui` (regex over `runCli(`, `spawnSync(`, `execFileSync(` argument arrays), require `INDUSK_HOME` to appear in the file; report offenders — RED (at least `init-workbench.test.ts`, `multi-agent-init.test.ts`)
- [ ] A23 `apps/indusk-admin/src/components/ProjectGrid.test.tsx`: render the grid with three registry entries (one workbench config, one normal-mode config, one whose path is missing); assert two cards, labelled `workbench` / `normal-mode`, and no card for the dead entry — RED (no labels; dead entry rendered as stale)
- [ ] A24 `apps/indusk-admin/src/components/Scorecards.test.tsx`: render the scorecards page's empty branch with `hasEvalDir: false`; assert the text "no evaluations recorded yet" — RED (current empty text differs)
- [ ] Run each authored file; confirm every red fails on its own assertion, not on a missing import; set rows A1, A2, A4, A5, A16, A20–A24 to `written`, A13 and A25 to `passing`

#### Deferred to Test Phase 2

- **A14, A15** — the live rows need a browser driving a real `next dev` over a fixture project. The existing `http-*.test.ts` harness spawns `next dev` but has no browser; the ADR (D10) says the mechanism is decided in the phase that authors them, with a recorded fallback to `manual:` procedures. Test Phase 2 sits before Build Phase 5 so the harness exists before `LiveRefresh` is built. Body sketch for A14:

  ```typescript
  // apps/indusk-admin/src/__tests__/live-refresh.e2e.test.ts (node project, serialized)
  import { chromium } from "playwright";
  import { startNextDev } from "./helpers/next-dev.js";       // extracted from http-smoke.test.ts
  it("A14 — a checkoff on disk reaches the open page within one interval, collapsibles preserved", async () => {
    const { url, projectRoot, stop } = await startNextDev({ fixture: "executing-plan", refreshMs: 1000 });
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`${url}/p/fixture/plan/guinea-pig`);
    await page.getByTestId("phase-bar-active").getByText("implementing: 1 of 3").waitFor();
    await page.getByTestId("collapsible-build-phase-1").click();                 // open it
    checkOffFirstItem(join(projectRoot, ".indusk/planning/guinea-pig/impl.md"));
    await page.getByText("implementing: 2 of 3").waitFor({ timeout: 3000 });     // < one interval + render
    expect(await page.getByTestId("collapsible-build-phase-1").getAttribute("data-open")).toBe("true");
    await browser.close(); await stop();
  });
  ```

#### Deferred to Build Phase 1

- **A3** — imports `parseImplString` from `@infinitedusky/indusk-mcp/impl-parser`, a subpath Build Phase 1 adds; the file cannot load today. Body:

  ```typescript
  // apps/indusk-admin/src/lib/phases-corpus-parity.test.ts (node project)
  import { parseImplString } from "@infinitedusky/indusk-mcp/impl-parser";
  import { extractPhases } from "./phases";
  const impls = globSync("**/impl.md", { cwd: PLANNING_ROOT, absolute: true }); // planning + archive
  it.each(impls)("A3 — %s renders the phases the package parser reports", (file) => {
    const content = readFileSync(file, "utf-8");
    const expected = parseImplString(content).phases.map((p) => [p.kind, p.number, p.name, p.gates.flatMap((g) => g.items).length]);
    const actual = extractPhases(content).map((p) => [p.kind, p.number, p.title, p.itemCount]);
    expect(actual).toEqual(expected);
  });
  ```

- **A19** — calls `getPhaseCompletion(parsed, { kind: "test", number: 1 })` and `findPhaseStart(records, plan, { kind, number })`; both signatures are Build Phase 1's (`getPhaseCompletion`) and Build Phase 2's (`findPhaseStart`). Body:

  ```typescript
  // apps/indusk-mcp/src/lib/phase-ref-identity.test.ts
  const parsed = parseImplString(twoSequenceImpl);   // Test Phase 1: 3 items, 1 checked; Build Phase 1: 4 items, 4 checked
  expect(getPhaseCompletion(parsed, { kind: "test", number: 1 })).toMatchObject({ totalItems: 3, checkedItems: 1 });
  expect(getPhaseCompletion(parsed, { kind: "build", number: 1 })).toMatchObject({ totalItems: 4, checkedItems: 4 });
  const records = [rec({ phase: 1 }), rec({ phase: 1, kind: "test" })];           // legacy record has no kind
  expect(findPhaseStart(records, "p", { kind: "build", number: 1 })).toBe(records[0]);
  expect(findPhaseStart(records, "p", { kind: "test", number: 1 })).toBe(records[1]);
  ```

#### Deferred to Build Phase 2

- **A18** — calls `prepareShapeReview({ …, phase: { kind: "test", number: 1 } })`; the field is a `number` today, so the test does not type-check. Body:

  ```typescript
  // apps/indusk-mcp/src/lib/shape/test-phase-addressing.test.ts
  const review = await prepareShapeReview({ root, plan: "p", phase: { kind: "test", number: 1 }, implBody });
  expect(review.status).toBe("review");                                   // today: "skipped" (gate lookup misses)
  const after = recordReviewedNothingFound(implBody, { kind: "test", number: 1 });
  expect(blockOf(after, "### Test Phase 1")).toContain("Shape (Test Phase 1)");
  expect(blockOf(after, "### Build Phase 1")).not.toContain("Shape (Test Phase 1)");
  ```

#### Deferred to Build Phase 4

- **A6, A7** — import `deriveActivePhase` from `apps/indusk-admin/src/lib/active-phase.ts`, a module Build Phase 4 creates. Body for A6:

  ```typescript
  const phases = parseImplString(impl).phases;   // Build 1 closed, Build 2 open, Build 3 open
  expect(deriveActivePhase(phases, [rec(1, "09:00"), rec(2, "10:00"), rec(3, "09:30")]).ref).toEqual({ kind: "build", number: 2 }); // most recent among open
  expect(deriveActivePhase(phases, [rec(1, "11:00")]).ref).toEqual({ kind: "build", number: 2 });                                     // closed phase's record ignored
  expect(deriveActivePhase(phases, [])).toMatchObject({ ref: { kind: "build", number: 2 }, hint: "no boundary record" });
  ```

  A7: `readBoundaries` over a file with one malformed line throws; the page renders `data-testid="boundary-error"` with the message and no `phase-bar-active`.

- **A8–A12** — render `PhaseBar`, `PlanBar`, `MasterBar` from `components/bars/`, created in Build Phase 4. Bodies assert `data-state` on each segment (`done|active|pending|skipped`), the active label text, equal segment counts across two fixtures (A8), `research` skipped for a plan whose documents start at `brief.md` (A10), `"executing: verifying Build Phase 2"` for an executing fixture and no `[data-state=active]` for an archived one (A11), `"3 of 10 closed, 2 executing"` with a `pending` placeholder segment (A12).
- **A17** — `lifecycle-render-parity.test.ts` imports `PLAN_POSITIONS`, `PHASE_ACTIVITIES`, `GATE_STAGES` from the `lifecycle` subpath and the admin's `LABELS` maps from `components/bars/labels.ts` (Build Phase 4); asserts every member has a non-empty label and that rendering each produces an element — the `satisfies Record<…>` types make a missing member a `tsc` error, this test makes it a named failure.

#### Regression Guards

- **A13** — passes the moment it is authored by design: it snapshots today's `parseAllPlans` + `checkRetrospectiveReadiness` output so Build Phase 1's lifecycle module can be proven behaviour-preserving. The one expected change (`test-plan` joining the stage order) is re-baselined by hand in Build Phase 1's Verification, naming each plan whose `stage` moved.
- **A25** — red at authoring (ten fixture errors), green in the same phase because the fixture fix is test work; from here on it is the gate that keeps the admin's type-check green.

#### Test Phase 1 Verification
- [ ] A1, A2, A4, A5, A16, A20, A21, A22, A23, A24 authored and RED on their own assertions: `cd apps/indusk-admin && pnpm exec vitest run src/components/PhasesSection.test.tsx src/components/PlanList.test.tsx src/components/ProjectGrid.test.tsx src/components/Scorecards.test.tsx` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts src/__tests__/ui-prune.test.ts src/__tests__/registry-leak-scan.test.ts`; then `cd` back
- [ ] A13 and A25 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-parity.test.ts` and `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/typecheck.test.ts`; then `cd` back
- [ ] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims?

#### Test Phase 1 Context
- [ ] Known Gotchas: the admin's `tsc --noEmit` had been red since 2026-08-12 (ten `TrajectoryRow` fixtures without `writableAtKind`/`passesAtKind`) and nothing gated on it — now `typecheck.test.ts` does; hand-written trajectory-row fixtures must carry both kind fields

#### Test Phase 1 Document
- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: trajectory-row fixtures carry `writableAtKind` / `passesAtKind`; the type-check is a test the suite runs

### Build Phase 1: One lifecycle definition and the package exports

**Goal**: `lib/lifecycle.ts` is the one definition of positions, activities and gate stages; `parsePlan` and the retrospective gate read it without changing behaviour except `test-plan` joining the stage order; `getPhaseCompletion` is keyed by `PhaseRef`; the admin can import what it needs.

- [ ] `apps/indusk-mcp/src/lib/lifecycle.ts` per ADR D1:
  ```ts
  export type PlanPosition = "research" | "brief" | "test-plan" | "adr" | "impl-approved" | "executing" | "falsify" | "cleanup" | "retrospective" | "archived" | "monitor";
  export const PLAN_POSITIONS: readonly PlanPosition[] = [ /* in order; monitor last, reserved */ ];
  export const DOCUMENT_POSITIONS = ["research", "brief", "test-plan", "adr", "impl", "retrospective"] as const;  // the STAGE_ORDER projection
  export const RITUAL_ORDER = ["falsification", "cleanup"] as const;   // title-prefix words isRitualPhaseTerminal matches
  export type PhaseActivity = "authoring" | "implementing" | "verifying" | "capturing-context" | "documenting" | "closed" | "falsifying" | "cleaning-up";
  export const PHASE_ACTIVITIES: readonly PhaseActivity[];
  export const GATE_STAGES: readonly GateKind[] = ["Verification", "OTel", "Context", "Document"];  // from impl-headings
  export type SegmentState = "done" | "active" | "pending" | "skipped";
  export function derivePlanPosition(input: { summary: PlanSummary; impl: ParsedImpl | null; readiness: RetrospectiveReadiness | null; archived: boolean }): PlanPositionState;
  export function derivePhaseActivity(phase: ImplPhase, boundary: PhaseBoundaryRecord | null): { activity: PhaseActivity; stages: StageState[] };
  ```
  `derivePlanPosition` rules: `archived` ⇒ position `archived`, no active segment; impl `completed` ⇒ `falsify` / `cleanup` / `retrospective` by `readiness.missing`; impl `in-progress` ⇒ `executing`; impl `approved` ⇒ `impl-approved`; else the latest document position by `DOCUMENT_POSITIONS` with `awaiting` from its status (`draft` ⇒ "awaiting acceptance", `proposed` ⇒ "awaiting acceptance", `accepted` ⇒ "awaiting the next document"); a document position with no file while a later one exists ⇒ `skipped`
- [ ] `plan-parser.ts`: `STAGE_ORDER` becomes `DOCUMENT_POSITIONS` imported from `lifecycle.ts`; `PlanStage` gains `"test-plan"`; `determineStage` looks for `test-plan.md`; `determineNextStep` strings unchanged in shape (`Create test-plan` appears between brief and adr)
- [ ] `cleanup/gate.ts`: `isFalsificationPhaseTerminal` / `isCleanupComplete` take their ritual word from `RITUAL_ORDER`; no behaviour change
- [ ] `impl-parser.ts`: `getPhaseCompletion(parsed, ref: PhaseRef)`; `PhaseCompletion.ref: PhaseRef` (keep `phase: number` as a deprecated alias for one release); `getAllPhaseCompletions` fills `ref`; update callers `tools/plan-tools.ts:63,120`, `bin/commands/check-gates.ts:53`
- [ ] `package.json` `exports`: `./lifecycle`, `./impl-headings`, `./impl-parser` → `dist/lib/*.js` with `types`; `pnpm exec tsc` then grep `dist/lib/lifecycle.js` for `PLAN_POSITIONS` before trusting any cross-package test
- [ ] Author A3 and A19 (bodies in the register), RED; set them `written`

#### Build Phase 1 Verification
- [ ] A16 partially green (b, c, d) and still red on (a) — expected until Build Phase 3: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts`; then `cd` back
- [ ] A13 diff reviewed and re-baselined by hand: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-parity.test.ts` — expected: only plans whose latest document is `test-plan.md` change `stage` (`brief` → `test-plan`); each named here in the checkoff; nothing else differs
- [ ] A3 and A19 authored and RED on their own assertions (A19's completion half may already pass; the boundary half red until Build Phase 2)
- [ ] Existing suites hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/plan-parser src/lib/cleanup src/lib/impl-parser.test.ts src/tools src/bin/commands/check-gates.test.ts` — expected: all pass; then `cd` back
- [ ] Shape (Build Phase 1): review `lifecycle.ts` and the three edited modules; record findings or "nothing to change"

#### Build Phase 1 Context
- [ ] Conventions: **the lifecycle is one definition** — `lib/lifecycle.ts` owns positions (nouns), activities (verbs), gate stages and the ritual order; `parsePlan`, `checkRetrospectiveReadiness` and the admin read it; pinned by `lifecycle-single-definition.test.ts`; `test-plan` is a document position (the stage order was missing it)

#### Build Phase 1 Document
- [ ] `apps/docs/src/guide/plan-lifecycle.md`: the lifecycle definition as the one source — positions, activities, gate stages, ritual order; the noun/verb rule; a Mermaid state diagram of `PLAN_POSITIONS` with `executing` expanding into activities
- [ ] `apps/docs/src/reference/trajectory/parser.md`: the three new subpath exports and what each is for

### Build Phase 2: Shape and the boundary record address a Test Phase

**Goal**: every Shape function takes `PhaseRef`; the boundary record carries an optional `kind` whose absence means build; the work skill's documented invocation matches.

- [ ] `shape/impl-blocks.ts`: `buildPhaseHeadingFor(ref)` / `gateHeadingFor(ref, gate)` match `### Test Phase N` when `ref.kind === "test"` (delete the "deliberately does not match" comment, replace with the rule)
- [ ] `shape/shape.ts`, `shape/findings.ts`, `shape/changed.ts`: `phase: number` → `phase: PhaseRef` in `prepareShapeReview`, `verificationIsGreen`, `verificationGateLines`, `recordReviewedNothingFound`, `recordSkipped`, `recordLeftAsIs`, `appendItemToPhase`, `appendFindingToPhase`, `changedFilesForPhase`; the existence guard compares `kind` and `number`
- [ ] `shape/boundary.ts`: `PhaseBoundaryRecord.kind?: "test" | "build"`; `recordPhaseStart(root, { plan, phase, kind?, sha, at })`; `findPhaseStart(records, plan, ref)` treats a record without `kind` as `build` — the rule stated in the docblock, no file rewritten
- [ ] `skills/work.md` Shape section: the two `recordPhaseStart` snippets gain `kind: "<test|build>"`; the review calls pass `{ kind, number }`; resync `.claude/skills/work/SKILL.md`
- [ ] Author A18 (body in the register), RED; set `written`

#### Build Phase 2 Verification
- [ ] A18 and A19 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/shape/test-phase-addressing.test.ts src/lib/phase-ref-identity.test.ts`; then `cd` back
- [ ] Shape suites hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/shape`; skill parity: `pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts`; then `cd` back
- [ ] Rows A18, A19 set to `passing`
- [ ] Shape (Build Phase 2): review the changed Shape modules — using the new `{ kind: "build", number: 2 }` addressing for the first time; record findings or "nothing to change"

#### Build Phase 2 Context
- [ ] Known Gotchas: phase identity is `{kind, number}` in `getPhaseCompletion`, every Shape function and `findPhaseStart`; a boundary record without `kind` is a build phase by rule (every record before 2026-09 was one); `shape-cannot-see-test-phases` closed

#### Build Phase 2 Document
- [ ] `apps/docs/src/guide/shape.md`: the boundary snippet and the review calls take `{ kind, number }`; a Test Phase is reviewable

### Build Phase 3: The admin renders phases from the package parser

**Goal**: `phases.ts` is an adapter over `parseImplString`; both sequences render in document order with their gate stages; rows attach by kind; the regexes are gone.

- [ ] `apps/indusk-admin/src/lib/phases.ts`: delete `PHASE_HEADING_RE`, `CHECKLIST_ITEM_RE`, the line walk; `extractPhases(content, trajectory?)` maps `parseImplString(content).phases` to the `Phase` view:
  ```ts
  export interface Phase { kind: "test" | "build"; number: number; ordinal: number; title: string; stages: Stage[]; itemCount: number; rows: TrajectoryRow[]; content: string }
  export interface Stage { kind: "implementation" | GateKind; items: { text: string; checked: boolean }[]; state: "done" | "pending" | "opted-out"; proof?: string }
  ```
  rows by `r.passesAtKind === p.kind && r.passesAt === p.number`; `content` is the phase's body between its heading and the next `ANY_PHASE_HEADING` (from `impl-headings`, fence-masked); `splitPhasesAroundFalsification` keys on `RITUAL_ORDER[0]` as a title prefix
- [ ] `PlanDetail.tsx` → extract `PhasesSection` to `components/PhasesSection.tsx` (one component per file); title `Test Phase 1: …` / `Build Phase 2: …`; a `StageList` under the title rendering each stage with `data-stage` and `data-state`; the trajectory table shows `Test Phase 1` / `Build Phase 2` in the Writable/Passes cells
- [ ] `FalsificationSection.tsx`, `lib/markdown-export.ts`: consume `phase.stages` instead of `extractChecklistItems(phase.content)`; delete `extractChecklistItems`
- [ ] Author A3's parity run (body in the register) against the new adapter; fix any impl in the corpus that the two parsers disagree on by reading the disagreement, never by loosening A3

#### Build Phase 3 Verification
- [ ] A1, A2, A3, A4, A5, A16 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/PhasesSection.test.tsx src/lib/phases-corpus-parity.test.ts` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts`; then `cd` back
- [ ] Admin suites hold, including screenshots: `cd apps/indusk-admin && pnpm exec vitest run` — expected: all pass; `PlanDetail` screenshot re-baselined deliberately (the phase view changed) and said so here
- [ ] A25 still green (the adapter is typed against the package)
- [ ] Rows A1, A2, A3, A4, A5, A16 set to `passing`
- [ ] Shape (Build Phase 3): review `phases.ts`, `PhasesSection.tsx`; record findings or "nothing to change"

#### Build Phase 3 Context
- [ ] Known Gotchas, the admin sidebar entry: phases render through `parseImplString` via the `impl-parser` subpath — never a local heading regex; rows attach by `(passesAtKind, passesAt)`

#### Build Phase 3 Document
- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the phase view — both sequences, gate stages with their three states, rows per phase

### Build Phase 4: The active phase and the three bars

**Goal**: the plan page shows which phase is active and why, and three tri-state bars derived from the lifecycle module; a pin fails when a lifecycle member has no renderer.

- [ ] `apps/indusk-admin/src/lib/active-phase.ts`: `deriveActivePhase(phases, records): { ref: PhaseRef | null; hint?: "no boundary record" }` per ADR D4; `planning-reader.ts` reads `.indusk/phase-boundary.jsonl` through `readBoundaries` from the `shape/boundary` subpath and surfaces a throw as `boundaryError: string` on the plan payload, never as `[]`
- [ ] `components/bars/labels.ts`: `POSITION_LABELS satisfies Record<PlanPosition, string>`, `ACTIVITY_LABELS satisfies Record<PhaseActivity, string>`, `STAGE_LABELS satisfies Record<GateKind | "implementation", string>`
- [ ] `components/bars/Bar.tsx` (one primitive: segments with `data-state`, an active label slot, equal widths, a caption slot) and `PhaseBar.tsx`, `PlanBar.tsx`, `MasterBar.tsx` over it; `PlanBar` caption "steps, not time"; `MasterBar` reads `readPlanHierarchy` + each subplan's `derivePlanPosition`, placeholders `pending`
- [ ] `PlanDetail.tsx`: `PlanBar` under the header for every plan; `PhaseBar` for the active phase above `PhasesSection`; `ActivePhase` marker on the phase (`data-testid="phase-bar-active"`, hint text when set); `boundary-error` block when `boundaryError` is set; `ParentPlanView`: `MasterBar` under the master prose
- [ ] Author A6, A7, A8–A12, A17 (bodies in the register), RED, then green as each lands; U1: Sandy reviews the rendering against three plans (one planning, one executing, one archived) before this phase's Verification closes — verdict recorded in the item below

#### Build Phase 4 Verification
- [ ] A6, A7, A8, A9, A10, A11, A12, A17 green: `cd apps/indusk-admin && pnpm exec vitest run src/lib/active-phase.test.ts src/components/bars src/lib/lifecycle-render-parity.test.ts src/components/PlanDetail.test.tsx`; then `cd` back
- [ ] U1 review recorded: Sandy's verdict on the unweighted bar against three real plans, and whether a weighted v2 is filed as a follow-on in the Day master
- [ ] A25 still green; full admin suite green
- [ ] Rows A6–A12, A17 set to `passing`
- [ ] Shape (Build Phase 4): review `active-phase.ts`, `Bar.tsx` and the three bars; record findings or "nothing to change"

#### Build Phase 4 Context
- [ ] Conventions: **a plan that adds a lifecycle position, activity or gate kind also adds its rendering in the same plan, as a Document gate item** — `lifecycle-render-parity.test.ts` fails naming the member until it does; the active phase is the most recent boundary record among open phases, first-open-phase with a visible hint when there are none, and a malformed record file is an error block, never a guess

#### Build Phase 4 Document
- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the three bars — segment states, what each active label says, the master bar's arithmetic, the "steps, not time" caption; the active-phase rule and its hint

### Test Phase 2: The live harness

**Goal**: a browser can drive a real `next dev` over a fixture project inside the suite, or the ADR is amended with the fallback; A14 and A15 exist RED either way.

- [ ] Extract `startNextDev({ fixture, refreshMs })` from `http-smoke.test.ts` into `src/__tests__/helpers/next-dev.ts` (returns `{ url, projectRoot, stop }`), used by the four existing HTTP smokes unchanged
- [ ] Author A14 and A15 in `src/__tests__/live-refresh.e2e.test.ts` (node project, serialized) with `chromium.launch()` from `playwright`; run once against the Build Phase 4 page — RED (no refresh happens; no "last updated")
- [ ] Decide the mechanism by measurement: if the two tests add more than 60 s to the node project or flake in three consecutive runs, replace the file with `manual:`-prefixed rows in the trajectory (`Test` column `manual: docs/admin-ui/live-refresh-smoke.md`) carrying the written procedure, and amend `adr.md` D10 with a dated note; otherwise keep them

#### Test Phase 2 Verification
- [ ] A14, A15 authored and RED on their own assertions (or converted per the item above, with the ADR amended): `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/live-refresh.e2e.test.ts`; then `cd` back
- [ ] The four HTTP smokes still pass on the extracted helper: `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-smoke.test.ts src/__tests__/http-stale-project.test.ts src/__tests__/http-project-research.test.ts src/__tests__/http-project-scorecards.test.ts`; then `cd` back
- [ ] Rows A14, A15 set to `written`

#### Test Phase 2 Context
- [ ] Known Gotchas: the admin's e2e rows drive `next dev` with Playwright from the node project (serialized; `fileParallelism: false` is load-bearing) — or, if converted, that live behaviour is a `manual:` row and why

#### Test Phase 2 Document
- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: the `next-dev` helper and how an e2e row is written (or the manual smoke procedure page, if converted)

### Build Phase 5: Live

**Goal**: the plan page refreshes itself on an interval with a visible "last updated", pauses when hidden, and stops loudly on failure.

- [ ] `components/LiveRefresh.tsx` (`"use client"`): `useEffect` interval → `router.refresh()`; `document.hidden` pauses; a rejected refresh sets `failed` and clears the interval; renders `last updated HH:MM:SS` or `refresh failed — reload`; props `{ intervalMs }`
- [ ] `admin.refresh_ms` in `.indusk/config.json` (default 5000, min 1000) read by `planning-reader.ts`'s config reader; `update.ts` ensure block does **not** write it (absent = default; a config key nobody set is not machine state to share)
- [ ] `app/p/[project]/plan/[name]/page.tsx` wraps its body in `LiveRefresh`; no other page does

#### Build Phase 5 Verification
- [ ] A14, A15 green (or the manual procedure executed once and its result recorded here with date and observed interval): `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/live-refresh.e2e.test.ts`; then `cd` back
- [ ] Full admin suite green; `LiveRefresh` has a component test for the failure state and the hidden-tab pause (mocked router)
- [ ] Rows A14, A15 set to `passing`
- [ ] Shape (Build Phase 5): review `LiveRefresh.tsx`; record findings or "nothing to change"

#### Build Phase 5 Context
- [ ] Architecture, indusk-admin entry: the plan page is live via `router.refresh()` on `admin.refresh_ms` (default 5000); only the plan page; failure stops visibly

#### Build Phase 5 Document
- [ ] `apps/docs/src/reference/admin-ui/overview.md`: live refresh — the interval config, what "last updated" means, why there is no push channel; a Mermaid sequence `LiveRefresh → router.refresh() → server components → disk`
- [ ] U2 note written to `.indusk/current.md` Project (shared): revisit the default on 2026-09-30

### Build Phase 6: Sidebar root, registry, project list, scorecards

**Goal**: the sidebar draws the root; dead registry entries can be pruned and no test leaks into the real registry; the project list labels shape; the scorecards page says why it is empty.

- [ ] `PlanList.tsx` `buildGroups` returns `{ root, groups, rest }`; render one root node (the root master's title) with parent groups and the unclaimed plans beneath it; a sub-plan under two parents renders under both
- [ ] `lib/admin/registry.ts` `pruneRegistry({ dryRun }): { removed: ProjectEntry[]; kept: ProjectEntry[]; backup?: string }` — dead = `!existsSync(entry.path)`; backup `projects.json.bak.<ISO>` before the temp-file-and-rename write; `bin/commands/ui.ts` gains `prune [--dry-run]` printing names and paths
- [ ] `app/page.tsx` / `ProjectGrid.tsx`: show entries whose path exists; label `workbench` / `normal-mode` via `isWorkbench(readConfig(entry.path))`; a dead entry is listed in a collapsed "not found (n) — `indusk ui prune`" note, not as a project card
- [ ] Fix the leakers named by A22: `init-workbench.test.ts`, `multi-agent-init.test.ts` (and any others the scan lists) set `INDUSK_HOME` to a temp dir
- [ ] `scorecards/page.tsx`: pass `hasEvalDir`; the empty branch says "no evaluations recorded yet — the first evaluated commit creates `.indusk/eval/`"

#### Build Phase 6 Verification
- [ ] A20, A21, A22, A23, A24 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/PlanList.test.tsx src/components/ProjectGrid.test.tsx src/components/Scorecards.test.tsx` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/ui-prune.test.ts src/__tests__/registry-leak-scan.test.ts`; then `cd` back
- [ ] `indusk ui prune --dry-run` run once against the real registry from the repo root, its count recorded here; then `indusk ui prune` and the resulting count (expected: from ~1,588 to the live handful; the backup path named)
- [ ] Rows A20–A24 set to `passing`
- [ ] Shape (Build Phase 6): review `buildGroups`, `pruneRegistry`, the grid; record findings or "nothing to change"

#### Build Phase 6 Context
- [ ] Known Gotchas, the admin sidebar entry: the tree has a root node (the root master) with parents and unclaimed plans beneath it; Architecture, indusk-admin: `indusk ui prune [--dry-run]` removes dead registry entries with a backup; every test that spawns `init`/`update`/`ui` sets `INDUSK_HOME` (pinned by `registry-leak-scan.test.ts`)

#### Build Phase 6 Document
- [ ] `apps/docs/src/reference/admin-ui/cli.md`: `indusk ui prune [--dry-run]`
- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the sidebar root node; project list labels and the not-found note; the scorecards empty state and why the directory appears late

### Build Phase 7: Record

**Goal**: the decision is published, the masters and changelog say what shipped, and the convention is where every future plan reads it.

- [ ] `apps/docs/src/decisions/admin-ui-phase-progress.md` (ADR summary; the noun/verb rule; the convention) + sidebar entry beside `dawn-ui-plan-grouping`
- [ ] `apps/docs/src/changelog.md` Unreleased entry per the ADR's Documentation Plan
- [ ] Masters: `.indusk/planning/indusk-v4-day/master.md` step 3 and `.indusk/planning/master.md` roadmap row → impl complete, close-out rituals pending
- [ ] Set impl status `completed`

#### Build Phase 7 Verification
- [ ] (no tests flip at this phase — reason: infra) — this phase writes record only
- [ ] All 25 rows terminal: `cd apps/indusk-mcp && pnpm exec tsx -e 'import { readFileSync } from "node:fs"; import { auditPlanAtClose } from "./src/lib/trajectory/audit.ts"; const a = auditPlanAtClose(readFileSync("../../.indusk/planning/admin-ui-phase-progress/impl.md","utf-8")); console.log(JSON.stringify(a.nonTerminal))'` — expected `[]`; then `cd` back
- [ ] Full suites green in both apps: `pnpm turbo test --filter=@infinitedusky/indusk-mcp --filter=indusk-admin` (admin daemon/bundle suites excepted only if red on `main` at the same commit, and said so)
- [ ] `indusk context check-pointers` — PASS
- [ ] Shape (Build Phase 7): no code this phase; record "no code files changed"

#### Build Phase 7 Context
- [ ] Current State: one line for `admin-ui-phase-progress` — the finished picture as of now, live, from one lifecycle definition; the convention that a plan adding a stage renders it

#### Build Phase 7 Document
- [ ] `apps/docs/src/guide/plan-lifecycle.md`: the convention paragraph — a plan that adds a position, activity or gate kind adds its rendering in the same plan; what the pin does when it does not

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/lifecycle.ts` | new — positions, activities, gate stages, ritual order, `derivePlanPosition`, `derivePhaseActivity` |
| `apps/indusk-mcp/src/lib/plan-parser.ts` | `STAGE_ORDER` → `DOCUMENT_POSITIONS`; `test-plan` stage |
| `apps/indusk-mcp/src/lib/cleanup/gate.ts` | ritual words from `RITUAL_ORDER` |
| `apps/indusk-mcp/src/lib/impl-parser.ts` | `getPhaseCompletion(parsed, ref)` |
| `apps/indusk-mcp/src/lib/shape/{shape,findings,changed,impl-blocks,boundary}.ts` | `PhaseRef` addressing; `PhaseBoundaryRecord.kind?` |
| `apps/indusk-mcp/src/lib/admin/registry.ts`, `src/bin/commands/ui.ts` | `pruneRegistry`, `ui prune` |
| `apps/indusk-mcp/package.json` | exports `lifecycle`, `impl-headings`, `impl-parser` |
| `apps/indusk-mcp/skills/work.md` + `.claude/skills/work/SKILL.md` | `{kind, number}` in the Shape section |
| `apps/indusk-admin/src/lib/{phases,active-phase}.ts`, `planning-reader.ts` | adapter over the package parser; active phase; boundary read; `admin.refresh_ms` |
| `apps/indusk-admin/src/components/{PhasesSection,LiveRefresh}.tsx`, `bars/*` | new |
| `apps/indusk-admin/src/components/{PlanDetail,PlanList,FalsificationSection,ProjectGrid,Scorecards}.tsx`, `lib/markdown-export.ts` | consume the adapter and bars; root node; labels; empty state |
| `apps/indusk-admin/src/__tests__/{typecheck,live-refresh.e2e}.test.ts`, `helpers/next-dev.ts` | new |
| new tests per the trajectory's `Test` column | evidence |
| docs: `guide/plan-lifecycle.md`, `guide/shape.md`, `reference/admin-ui/{overview,cli,component-conventions}.md`, `reference/trajectory/parser.md`, `decisions/admin-ui-phase-progress.md`, changelog; masters; CLAUDE.md | record |

## Dependencies
- None hard. `dawn-workbench-execution` (closed 2026-09-16) supplied the absence-as-rule precedent this plan reuses for `PhaseBoundaryRecord.kind`.

## Notes
- Test Phase 2 exists because the live rows' mechanism is a decision to make by measurement, not a promise; the ADR (D10) names the fallback and this impl names where it is recorded.
- A13's one expected re-baseline (`test-plan` joining the stage order) is the only behaviour change this plan makes to `list_plans`; anything else in that diff is a defect, not a re-baseline.
- The Shape step in Build Phases 2–6 uses the new `{kind, number}` addressing; if the library still skips for gate-position reasons (the previous two plans recorded Shape by hand), record it by hand as before and note that the position problem is a lifecycle-rebalance follow-on, not this plan's.
