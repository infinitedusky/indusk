---
title: "Admin UI Phase Progress — Implementation"
date: 2026-09-16
status: in-progress
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
| A1 | A plan whose impl has `### Test Phase 1` and `### Build Phase 1…N` renders each as its own phase on the plan page, in document order, each with only its own checklist under it | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A2 | A trajectory row that passes at Test Phase 1 is listed under Test Phase 1, not under Build Phase 1 | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A3 | Every impl in `.indusk/planning/` and its archive renders the same `(kind, number, name, itemCount)` sequence through the admin adapter as the package parser reports | Build Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/lib/phases-corpus-parity.test.ts |
| A4 | Each phase shows its stages — implementation n of m, Verification, Context, Document, OTel when present — each done, pending, or opted-out with the recorded proof text | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A5 | An OTel gate's items appear under an OTel stage, not folded into the stage before it | Test Phase 1 | Build Phase 3 | passing | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A6 | The active phase is the one with the most recent boundary record among phases with unchecked gate items; all gates checked ⇒ closed regardless of record; no records ⇒ first phase with unchecked items, marked "no boundary record" | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/lib/active-phase.test.ts |
| A7 | A malformed line in `.indusk/phase-boundary.jsonl` renders a visible error block on the plan page and no phase is marked active | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/lib/active-phase.test.ts, apps/indusk-admin/src/components/PlanDetail.test.tsx |
| A8 | Every bar segment is one of done / active / pending / skipped; two plans at different positions render bars of the same segment count | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A9 | The active phase stage is partially filled by its n of m and labelled with its verb ("verifying: 2 of 5"); done stages full, later stages empty | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/PhaseBar.test.tsx |
| A10 | The plan bar shows every position research → archived with the current one marked and labelled with what it awaits; a plan with no research document shows research as skipped | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A11 | An executing plan's plan-bar label is the active phase's activity and name ("executing: verifying Build Phase 2"); an archived plan has no active segment | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/PlanBar.test.tsx |
| A12 | A parent's master bar has one segment per declared subplan, filled by each subplan's position, labelled "n of m closed, k executing"; a declared-but-missing subplan is pending | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/MasterBar.test.tsx |
| A13 | `parseAllPlans` and `checkRetrospectiveReadiness` produce identical output over every plan folder before and after the lifecycle module lands (snapshot parity) | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/lifecycle-parity.test.ts |
| A14 | With a plan page open, checking off an impl item on disk changes the phase bar within one polling interval with no reload, and an open collapsible stays open | Test Phase 2 | Build Phase 5 | passing | apps/indusk-admin/src/__tests__/live-refresh.e2e.test.ts |
| A15 | The page shows a "last updated" time that advances on each refresh and shows "refresh failed" and stops when a refresh rejects | Test Phase 2 | Build Phase 5 | passing | apps/indusk-admin/src/__tests__/live-refresh.e2e.test.ts |
| A16 | The admin has no phase-heading regex; exactly one `PLAN_POSITIONS`, one `GATE_STAGES` and one phase-heading parser exist across the package and the admin | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts |
| A17 | Adding a member to `PlanPosition`, `PhaseActivity` or `GateKind` without a label and renderer fails a test naming the missing member | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/lib/lifecycle-render-parity.test.ts |
| A18 | `prepareShapeReview` for `{kind: "test", number: 1}` on a test-phase impl returns a review, and `recordReviewedNothingFound` for it appends under `### Test Phase 1`'s block | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/shape/test-phase-addressing.test.ts |
| A19 | Test Phase 1 and Build Phase 1 of one plan report separate `getPhaseCompletion` counts and separate `findPhaseStart` records; a record without `kind` resolves as build | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/lib/phase-ref-identity.test.ts |
| A20 | The sidebar shows one root node with the parent plans and the unclaimed plans under it; a sub-plan declared under two parents appears under both | Test Phase 1 | Build Phase 6 | passing | apps/indusk-admin/src/components/PlanList.root.test.tsx |
| A21 | `indusk ui prune --dry-run` lists dead entries and writes nothing; `indusk ui prune` removes exactly those, writes `projects.json.bak.<ISO>`, keeps live entries | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/ui-prune.test.ts |
| A22 | Every test file under both apps that spawns `init`, `update` or `ui` sets `INDUSK_HOME` | Test Phase 1 | Build Phase 6 | passing | apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts |
| A23 | The project list shows every registered project whose path exists, labelled `workbench` or `normal-mode`; a dead entry is not shown as a project | Test Phase 1 | Build Phase 6 | passing | apps/indusk-admin/src/components/ProjectGrid.shape.test.tsx |
| A24 | A project with no eval directory shows "no evaluations recorded yet" on its scorecards page | Test Phase 1 | Build Phase 6 | passing | apps/indusk-admin/src/components/Scorecards.empty.test.tsx |
| A25 | `pnpm exec tsc --noEmit -p .` in `apps/indusk-admin` exits 0, asserted by a test the suite runs | Test Phase 1 | Test Phase 1 | passing | apps/indusk-admin/src/__tests__/typecheck.test.ts |
| A26 | The plan page shows a phase line between the plan bar and the active phase's stage bar: one segment per phase in document order, closed phases full, the active one partially filled by its own items and named, later phases empty | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/bars/PhasesBar.test.tsx |
| A27 | The cleanup ritual's phase renders as its own Cleanup section beside Falsification — its items and rows, closed by default — and is not listed under Follow-up Phases; every plan section is closed by default so the page opens as the overview | Build Phase 4 | Build Phase 4 | passing | apps/indusk-admin/src/components/CleanupSection.test.tsx |
| A28 | A root `master.md` with no frontmatter `title` and a `# …` YAML comment inside its frontmatter titles the sidebar root from its first body heading, never from the comment | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/__tests__/plan-declarations-root-title.test.ts |
| A29 | A completed impl whose readiness reports only `rows` missing shows a plan-bar message naming the non-terminal rows, not "cleaned, awaiting /retrospective"; a completed impl whose readiness could not be computed says so rather than claiming the rituals are done | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/lib/lifecycle-derive.test.ts |
| A30 | `recordPhaseStart` given a record its own reader would refuse (non-numeric phase, empty plan or sha, unknown kind) throws naming the field and appends nothing, so `readBoundaries` still returns every record that was there | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/lib/shape/boundary-writer.test.ts |
| A31 | A CLI spawned through the shared test helper with no explicit `INDUSK_HOME` writes no registry outside a temp directory even when the developer's shell exports `INDUSK_HOME`; the leak scan counts `setup` (which delegates to `init`) among the registering commands | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/__tests__/helpers/cli.test.ts, apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts |
| A32 | A phase with no implementation items whose gates are all checked reports `closed`; one with no implementation items and an unchecked gate reports that gate's verb — never "implementing 0 of 0" | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/lib/lifecycle-derive.test.ts |
| A33 | An `in-progress` impl with every item checked renders its active plan-bar segment with a message ("every item checked — impl status is still in-progress"), not an unlabelled active segment | Build Phase 8 | Build Phase 8 | passing | apps/indusk-mcp/src/lib/lifecycle-derive.test.ts |
| A34 | One `TrajectoryRowsTable` renders a phase's rows in both forms — three columns for a ritual section, five (with Writable at / Passes at) for the Implementation Plan — and the Falsification, Cleanup and Phases sections all render their rows through it | Build Phase 9 | Build Phase 9 | planned | apps/indusk-admin/src/components/phases/TrajectoryRowsTable.test.tsx |
| A35 | The Falsification and Cleanup sections are two configurations of one `RitualPhaseSection` — same test ids, headings, complete badge and copied markdown as before — and one `ritualPhaseMarkdown` replaces the two exporters | Build Phase 9 | Build Phase 9 | planned | apps/indusk-admin/src/components/phases/RitualPhaseSection.test.tsx |
| A36 | The admin has one phase spelling: the Implementation Plan's Writable at / Passes at cells read `Phase 4` / `Test Phase 1` like every heading, never `Build Phase 4` | Build Phase 9 | Build Phase 9 | planned | apps/indusk-admin/src/components/PhasesSection.test.tsx |
| A37 | `readAdminRefreshMs` reads `.indusk/config.json` through the package's `readConfig` (a `./config` subpath), so a malformed file yields the default and no second JSON parse of the config exists in the admin | Build Phase 9 | Build Phase 9 | planned | apps/indusk-admin/src/lib/project-reader.test.ts |

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

- [x] Create/confirm this plan's worktree (`indusk worktree create admin-ui-phase-progress`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter — created with `git worktree add -b plan/admin-ui-phase-progress ../dusk-worktrees/admin-ui-phase-progress main` (the `indusk worktree create` script is the worktree extension's and refuses outside a workbench; dusk is normal-mode)
- [x] Open the phase boundary (`recordPhaseStart`, plan `admin-ui-phase-progress`, phase 1) per the work skill — recorded at `5c675c58` as phase 1 with no kind (the record cannot yet say "test"; Build Phase 2 gives it `kind`, and this record reads as build by that rule — the ambiguity this plan closes)
- [x] Fix the ten `TrajectoryRow` fixture errors: add `writableAtKind: "build"` / `passesAtKind: "build"` to every hand-written row in `FalsificationSection.test.tsx`, `PlanDetail.test.tsx`, `markdown-export.test.ts` (no behaviour change; the fields are required by the parser since test-phase-structure)
- [x] A25 `apps/indusk-admin/src/__tests__/typecheck.test.ts`: spawn `pnpm exec tsc --noEmit -p .` with `cwd` = the admin package, assert exit 0, print stderr on failure — RED before the fixture fix, green after; node project
- [x] A1/A2/A4/A5 `apps/indusk-admin/src/components/PhasesSection.test.tsx`: render `PlanDetail` (mocks per convention) with a fixture impl carrying `### Test Phase 1`, `### Build Phase 1`, `### Build Phase 2`, gate blocks for each, one `#### Build Phase 1 OTel` block, a row `| A1 | … | Test Phase 1 | Test Phase 1 | passing |`; assert three `phases-section` children in order, each with only its own items; A1's row under the Test Phase 1 child; per-phase stage rows `implementation 2 of 3`, `Verification done`, `Context pending`, `Document opted-out — asked: …`; OTel items under an `OTel` stage — RED (today: one phase, everything folded)
- [x] A16 `apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts`: (a) `apps/indusk-admin/src/lib/phases.ts` contains no `/Phase\s/`-shaped regex literal; (b) exactly one `export const PLAN_POSITIONS` and one `export const GATE_STAGES` under `apps/indusk-mcp/src/lib`, both in `lifecycle.ts`; (c) no `STAGE_ORDER` array literal outside `lifecycle.ts`; (d) exactly one `PHASE_HEADING` definition (`impl-headings.ts`) — RED (no `lifecycle.ts`; the admin regex exists)
- [x] A13 `apps/indusk-mcp/src/__tests__/lifecycle-parity.test.ts`: over every folder in `.indusk/planning/` + `archive/`, run `parseAllPlans` (per-folder `{name, stage, stageStatus, nextStep}`) and `checkRetrospectiveReadiness` (where an impl exists), write the result to `src/__tests__/fixtures/lifecycle-parity.snapshot.json` on first run and compare on later runs — passes on authoring (regression guard); `test-plan` joining `STAGE_ORDER` in Build Phase 1 will change `stage` for plans that stopped at a test plan: the expected diff is reviewed and the snapshot re-baselined **by hand, in that phase's Verification, naming each changed plan**
- [x] A20 `apps/indusk-admin/src/components/PlanList.root.test.tsx` (its own file, like `PlanList.grouping.test.tsx`; the trajectory's `Test` cell updated): render with a grouping whose root master is titled "Root"; assert a root node containing the parent groups and the unclaimed plans, and a plan declared under two parents rendered twice — RED (no root node today)
- [x] A21 `apps/indusk-mcp/src/__tests__/ui-prune.test.ts`: temp `INDUSK_HOME` with a `projects.json` of two live dirs and two deleted; `indusk ui prune --dry-run` lists the two dead names and leaves the file byte-identical; `indusk ui prune` removes them, leaves the live two, and a `projects.json.bak.*` exists with the pre-prune content — RED (`unknown command 'prune'`)
- [x] A22 `apps/indusk-mcp/src/__tests__/registry-leak-scan.test.ts` (`nodir` on the glob — the admin's screenshot baselines are directories named like test files; seven offenders today: `detect-tooling-honesty`, `hooks-load-in-cjs-consumer`, `init-workbench`, `multi-agent-init`, `repos-root-single-definition`, `workbench-blindness`, `worktree-config-schema-pointer`): glob `apps/*/src/**/*.test.ts`; for each file whose text spawns the CLI with `init`, `update` or `ui` (regex over `runCli(`, `spawnSync(`, `execFileSync(` argument arrays), require `INDUSK_HOME` to appear in the file; report offenders — RED (at least `init-workbench.test.ts`, `multi-agent-init.test.ts`)
- [x] A23 `apps/indusk-admin/src/components/ProjectGrid.shape.test.tsx` (its own file; props widened through `unknown` so A25 stays green): render the grid with three registry entries (one workbench config, one normal-mode config, one whose path is missing); assert two cards, labelled `workbench` / `normal-mode`, and no card for the dead entry — RED (no labels; dead entry rendered as stale)
- [x] A24 `apps/indusk-admin/src/components/Scorecards.empty.test.tsx` (its own file; renders the page component with the reader mocked): render the scorecards page's empty branch with `hasEvalDir: false`; assert the text "no evaluations recorded yet" — RED (current empty text differs)
- [x] Run each authored file; confirm every red fails on its own assertion, not on a missing import; set rows A1, A2, A4, A5, A16, A20–A24 to `written`, A13 and A25 to `passing` — every red is an `AssertionError` on the row's own claim (A16 (d) is already green: one `PHASE_HEADING`; A20's two-parents case is already green: `buildGroups` lists a child under every parent that declares it, so that half is a guard); A13 wrote its 83-folder baseline; A25 green after the fixture fix
- [x] Shape (Test Phase 1, recorded by hand — the library skips while its item sits inside the Verification gate, the same position problem the previous two plans hit): ten test files. `PhasesSection.test.tsx` has one fixture impl, one trajectory builder, one `openAllPhases` helper and one `phases()` selector shared by four cases; `lifecycle-single-definition.test.ts` has one `definers(pattern)` over one `libFiles()`; `lifecycle-parity.test.ts` has `planDirs()` → `observe()` → compare, and compares only shared folders so it pins the reader, not the corpus; `registry-leak-scan.test.ts` names its spawn shapes in one array; `ui-prune.test.ts` has one `fixture()` and one `names()`; the three admin rows widen future props through `unknown` with the reason beside each. Left as is: the `next/link` mock is copied into every browser test file verbatim (a fifteenth copy now) — inter-file, `/cleanup`'s question, and the admin's existing convention. Nothing to change

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

- **A19** — moved to `#### Deferred to Build Phase 2` at the Test Phase 1 register review (2026-09-16): the body calls both `getPhaseCompletion(parsed, ref)` (Build Phase 1's signature) and `findPhaseStart(records, plan, ref)` (Build Phase 2's), so the file would not compile at Build Phase 1. See the entry below.

#### Deferred to Build Phase 2

- **A19** — calls `getPhaseCompletion(parsed, { kind: "test", number: 1 })` (Build Phase 1's signature) and `findPhaseStart(records, plan, { kind, number })` (Build Phase 2's); the file compiles only once both exist. Body:

  ```typescript
  // apps/indusk-mcp/src/lib/phase-ref-identity.test.ts
  const parsed = parseImplString(twoSequenceImpl);   // Test Phase 1: 3 items, 1 checked; Build Phase 1: 4 items, 4 checked
  expect(getPhaseCompletion(parsed, { kind: "test", number: 1 })).toMatchObject({ totalItems: 3, checkedItems: 1 });
  expect(getPhaseCompletion(parsed, { kind: "build", number: 1 })).toMatchObject({ totalItems: 4, checkedItems: 4 });
  const records = [rec({ phase: 1 }), rec({ phase: 1, kind: "test" })];           // legacy record has no kind
  expect(findPhaseStart(records, "p", { kind: "build", number: 1 })).toBe(records[0]);
  expect(findPhaseStart(records, "p", { kind: "test", number: 1 })).toBe(records[1]);
  ```

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
- **A26** — added at the U1 review (Sandy, 2026-09-16: "a phase line under the active one, so that you see what phase you are in"); renders `PhasesBar` from `components/bars/`, created in the same phase. Body asserts one segment per phase in document order with `data-state` done/active/pending, the active segment's fill from its own items, and the active label naming the phase.
- **A27** — added at the U1 review (Sandy, 2026-09-16: "we also need a cleanup section"; "default all to collapsed — we want overview before details"); renders `PlanDetail` with an impl carrying a `Phase N: Cleanup — …` phase and asserts a `cleanup-section` exists closed by default, shows the phase's items once opened, and that no `followup-phases-section` renders for it. Body in `CleanupSection.test.tsx`, created in the same phase.
- **A17** — `lifecycle-render-parity.test.ts` imports `PLAN_POSITIONS`, `PHASE_ACTIVITIES`, `GATE_STAGES` from the `lifecycle` subpath and the admin's `LABELS` maps from `components/bars/labels.ts` (Build Phase 4); asserts every member has a non-empty label and that rendering each produces an element — the `satisfies Record<…>` types make a missing member a `tsc` error, this test makes it a named failure.

#### Deferred to Build Phase 8

- **A28–A33** — falsification hypotheses (`/falsify`, 2026-09-16), formed by reading the attested code after Build Phase 7 closed; each targets a specific line and could not have been written before the code existed. Authored red in the phase that fixes them, which is the ritual's shape: A28 against `rootTitle`'s raw-file heading match (`plan-parser.ts`), A29/A32/A33 against `resolvePosition` and `derivePhaseActivity` (`lifecycle.ts`), A30 against `recordPhaseStart`'s unvalidated append (`shape/boundary.ts`), A31 against `helpers/cli.ts`'s `runCli` spreading `process.env` and the scan's `init|update|ui` list.

#### Deferred to Build Phase 9

- **A34–A37** — cleanup rows (`/cleanup`, 2026-09-16): each tests a unit the Cleanup Phase creates (`TrajectoryRowsTable`, `RitualPhaseSection`, `lib/project-reader.ts`) or a spelling it unifies, so none can compile before that phase. A34/A35 are behaviour-parity rows — the existing Falsification, Cleanup and Phases section tests keep passing through the extracted units — plus one focused render each; A36 asserts the cell text the Phases section test already reads; A37 asserts the `./config` subpath resolves from the admin and a malformed config still yields the default.

#### Regression Guards

- **A13** — passes the moment it is authored by design: it snapshots today's `parseAllPlans` + `checkRetrospectiveReadiness` output so Build Phase 1's lifecycle module can be proven behaviour-preserving. The one expected change (`test-plan` joining the stage order) is re-baselined by hand in Build Phase 1's Verification, naming each plan whose `stage` moved.
- **A25** — red at authoring (ten fixture errors), green in the same phase because the fixture fix is test work; from here on it is the gate that keeps the admin's type-check green.

#### Test Phase 1 Verification
- [x] A1, A2, A4, A5, A16, A20, A21, A22, A23, A24 authored and RED on their own assertions: `cd apps/indusk-admin && pnpm exec vitest run src/components/PhasesSection.test.tsx src/components/PlanList.root.test.tsx src/components/ProjectGrid.shape.test.tsx src/components/Scorecards.empty.test.tsx` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts src/__tests__/ui-prune.test.ts src/__tests__/registry-leak-scan.test.ts`; then `cd` back — admin: 4 files, 8 tests, 8 failed, every failure an `AssertionError` on the row's claim (`expected [] to deeply equal ['test-1','build-1','build-2']`, `no root node rendered`, `expected undefined to be 'workbench'`, `…to contain 'no evaluations recorded yet'`); mcp: 6 failed / 2 passed — A16 (a)(b)(c) red, (d) green; A21 exit 1 (`unknown command 'prune'`); A22 names seven offenders
- [x] A13 and A25 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-parity.test.ts` and `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/typecheck.test.ts`; then `cd` back — A13 wrote `fixtures/lifecycle-parity.snapshot.json` (83 folders) and passes; A25 red with 10 errors before the fixture fix, green after (`tsc --noEmit` exit 0)
- [x] Every deferred body above reviewed against both questions: will it compile at the phase it names, and does it assert what it claims? — one failed the first question: A19's body called Build Phase 2's `findPhaseStart(records, plan, ref)` while its `Writable at` said Build Phase 1, so the file would not have loaded there; moved to `Deferred to Build Phase 2` and the two build-phase items updated. A3 (Build 1: the `impl-parser` subpath), A18 (Build 2: `PhaseRef` on `prepareShapeReview`), A6/A7 (Build 4: `active-phase.ts`), A8–A12/A17 (Build 4: the bars and labels) and A14/A15 (Test Phase 2: the harness) each name the symbol that makes them loadable and assert the row's claim

#### Test Phase 1 Context
- [x] Known Gotchas: the admin's `tsc --noEmit` had been red since 2026-08-12 (ten `TrajectoryRow` fixtures without `writableAtKind`/`passesAtKind`) and nothing gated on it — now `typecheck.test.ts` does; hand-written trajectory-row fixtures must carry both kind fields — folded into the existing `next/link` admin gotcha line (the budget has ~270 bytes of headroom; no new line)

#### Test Phase 1 Document
- [x] `apps/docs/src/reference/admin-ui/component-conventions.md`: trajectory-row fixtures carry `writableAtKind` / `passesAtKind`; the type-check is a test the suite runs — two subsections under Testing, including why `unknown`-widening beats `@ts-expect-error` for not-yet-existing props

### Build Phase 1: One lifecycle definition and the package exports

**Goal**: `lib/lifecycle.ts` is the one definition of positions, activities and gate stages; `parsePlan` and the retrospective gate read it without changing behaviour except `test-plan` joining the stage order; `getPhaseCompletion` is keyed by `PhaseRef`; the admin can import what it needs.

- [x] `apps/indusk-mcp/src/lib/lifecycle.ts` per ADR D1 (as shipped: `PHASE_ACTIVITIES` gained `instrumenting` for an active OTel stage; `StageState.state` adds `opted-out` beside the four segment states; `derivePlanPosition` takes `{ summary, impl, readiness, archived }` and reads `summary.documents` for skipped positions):
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
- [x] `plan-parser.ts`: `STAGE_ORDER` becomes `DOCUMENT_POSITIONS` imported from `lifecycle.ts` (no alias — the pin's `STAGE_ORDER` scan caught the alias); `PlanStage` gains `"test-plan"`; `determineStage` looks for `test-plan.md`; `determineNextStep` strings unchanged in shape (`Create test-plan` appears between brief and adr)
- [x] `cleanup/gate.ts`: `isFalsificationPhaseTerminal` / `isCleanupComplete` take their ritual word from `RITUAL_ORDER`; no behaviour change
- [x] `impl-parser.ts`: `getPhaseCompletion(parsed, ref: PhaseRef)`; `PhaseCompletion.ref: PhaseRef` (keep `phase: number` as a deprecated alias for one release); `getAllPhaseCompletions` fills `ref`; update callers `tools/plan-tools.ts:63,120`, `bin/commands/check-gates.ts:53` — as shipped: `getPhaseCompletion` already took an `ImplPhase` (the research misread its input); it keeps that input and its output gains `ref: PhaseRef` + `ordinal`, with a new `findPhase(parsed, ref)` for callers holding a reference; `GateType` gains `"otel"` and `GATE_SUFFIXES` gains `OTel` — the TS walk had been one gate kind behind the hook port; callers untouched (they read by number and still can); `advance_plan` gained the `test-plan` branch
- [x] `package.json` `exports`: `./lifecycle`, `./impl-headings`, `./impl-parser` → `dist/lib/*.js` with `types`; `pnpm exec tsc` then grep `dist/lib/lifecycle.js` for `PLAN_POSITIONS` before trusting any cross-package test — built; `PLAN_POSITIONS` present in dist; the admin resolves the subpath (A3 loads and fails on its assertion)
- [x] Author A3 (body in the register), RED; set it `written` (A19 moved to Build Phase 2 at the register review — its body needs Build Phase 2's `findPhaseStart` signature to compile) — `readdirSync` recursive rather than `glob` (the admin has no glob dependency; the first run was a load error, which is not a red); the adapter's future view widened through `unknown`; 62 of 64 impls differ today, the two single-phase impls agree
- [x] Shape (Build Phase 1, recorded by hand — the boundary record for "phase 1" already exists from Test Phase 1 and `recordPhaseStart` is idempotent on `{plan, phase}`, so this build phase could not open its own record: the exact collision Build Phase 2 fixes): `lifecycle.ts` is the definitions plus two derivations, each with named helpers (`resolvePosition`, `documentFor`, `verbFor`) and its rule in the docblock; `plan-parser.ts` swapped an import for a constant; `gate.ts` two constants; `impl-parser.ts` one gate kind, two record fields and one `findPhase`; `plan-tools.ts` one branch in the shape of its neighbours. Left as is: `lifecycle.ts` holds both the vocabulary and the two derivations that read it — two reasons to change in one file, kept together because the ADR names one module and the pin counts one definition; if the derivations grow, `lifecycle/derive.ts` is the split. Nothing to change

#### Build Phase 1 Verification
- [x] A16 partially green (b, c, d) and still red on (a) — expected until Build Phase 3: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts`; then `cd` back — 3 passed, 1 failed (a); (c) went green only after the `STAGE_ORDER` alias was removed
- [x] A13 diff reviewed and re-baselined by hand: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-parity.test.ts` — expected: only plans whose latest document is `test-plan.md` change `stage` (`brief` → `test-plan`); each named here in the checkoff; nothing else differs — observed: no plan stops at `test-plan.md`, so no `stage` moved; six brief-accepted archives changed `nextStep` from "Create adr" to "Create test-plan" (`admin-ui-local-domain`, `compaction-skill`, `context-graph`, `evaluator-structured-scorecard-output`, `hermes-inspired-improvements`, `work-autopilot`), the same cause; readiness unchanged for all 83; re-baselined in `a87761b8`
- [x] A3 authored and RED on its own assertion — `AssertionError: expected [ [ undefined, +0, …] ] to deeply equal [ [ 'build', 0, …] ]` on 62 impls
- [x] Existing suites hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/plan-parser src/lib/cleanup src/lib/impl-parser.test.ts src/tools src/bin/commands/check-gates.test.ts` — expected: all pass; then `cd` back — 8 files, 50 tests passed alongside the pin; admin `tsc --noEmit` still 0 errors
- [x] Shape (Build Phase 1): review `lifecycle.ts` and the three edited modules; record findings or "nothing to change" — recorded by hand as the last implementation item of this phase (nothing to change; one left-as-is on `lifecycle.ts` holding vocabulary and derivations together)

#### Build Phase 1 Context
- [x] Conventions: **the lifecycle is one definition** — `lib/lifecycle.ts` owns positions (nouns), activities (verbs), gate stages and the ritual order; `parsePlan`, `checkRetrospectiveReadiness` and the admin read it; pinned by `lifecycle-single-definition.test.ts`; `test-plan` is a document position (the stage order was missing it) — added; paid for by compacting three Current State clauses (the sequence-reconciliation fate list, the workbench-trust-fixes hook-cwd tail, the writing-skill falsification tally), each of which lives in its archive

#### Build Phase 1 Document
- [x] `apps/docs/src/guide/plan-lifecycle.md`: the lifecycle definition as the one source — positions, activities, gate stages, ritual order; the noun/verb rule; a Mermaid state diagram of `PLAN_POSITIONS` with `executing` expanding into activities — new section "The lifecycle, as defined", including the convention paragraph
- [x] `apps/docs/src/reference/trajectory/parser.md`: the three new subpath exports and what each is for — "Subpath exports" table under Module layout

### Build Phase 2: Shape and the boundary record address a Test Phase

**Goal**: every Shape function takes `PhaseRef`; the boundary record carries an optional `kind` whose absence means build; the work skill's documented invocation matches.

- [x] `shape/impl-blocks.ts`: `buildPhaseHeadingFor(ref)` / `gateHeadingFor(ref, gate)` match `### Test Phase N` when `ref.kind === "test"` (delete the "deliberately does not match" comment, replace with the rule) — the builders live in `impl-headings.ts` and take a `PhaseAddress` (`PhaseRef | number`; a bare number is the build phase, the `### Phase N` shorthand) so the 49 existing bare-number call sites in the Shape tests keep compiling; `toPhaseRef` and `phaseLabel` added beside them
- [x] `shape/shape.ts`, `shape/findings.ts`, `shape/changed.ts`: `phase: number` → `phase: PhaseRef` (as `PhaseAddress`) in `prepareShapeReview`, `verificationIsGreen`, `verificationGateLines`, `recordReviewedNothingFound`, `recordSkipped`, `recordLeftAsIs`, `appendItemToPhase`, `appendFindingToPhase`, `changedFilesForPhase`; the existence guard compares `kind` and `number`
- [x] `shape/boundary.ts`: `PhaseBoundaryRecord.kind?: "test" | "build"`; `recordPhaseStart(root, { plan, phase, kind?, sha, at })`; `findPhaseStart(records, plan, ref)` treats a record without `kind` as `build` — the rule stated in the docblock, no file rewritten
- [x] `skills/work.md` Shape section: the two `recordPhaseStart` snippets gain `kind: "<test|build>"`; the review calls pass `{ kind, number }`; resync `.claude/skills/work/SKILL.md` — plus the record-shape sentence (`{plan, phase, kind?, sha, at}`, absent = build); `skill-sync-parity` 22 passed
- [x] Author A18 and A19 (bodies in the register), RED; set them `written` — both bodies name signatures this phase introduces, so they could not load against the old code (that is why they were deferred here); authored beside the signature change and run against it: A19 green on first run; A18's two repo cases were red on a fixture error first (`commitAll("open")` with nothing to commit), fixed to read HEAD, then green; A18 also asserts the same impl addressed as Build Phase 1 is NOT green, so the two phases are provably not confused

#### Build Phase 2 Verification
- [x] A18 and A19 green: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/shape/test-phase-addressing.test.ts src/lib/phase-ref-identity.test.ts`; then `cd` back — 5 tests passed
- [x] Shape suites hold: `cd apps/indusk-mcp && pnpm exec vitest run src/lib/shape`; skill parity: `pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts`; then `cd` back — shape: 10 files, 53 tests passed (every existing bare-number call site unchanged); with the validator and impl-parser suites, 92 passed; skill parity 22 passed; `tsc --noEmit` clean
- [x] Rows A18, A19 set to `passing`
- [x] Shape (Build Phase 2): review the changed Shape modules — using the new `{ kind: "build", number: 2 }` addressing for the first time; record findings or "nothing to change" — this phase's boundary is the first record on disk with a `kind` (`{"phase":2,"kind":"build",…}` at `356471a9`), so the addressing was exercised by the opening itself; the library review still cannot run while this item sits in the gate (position problem, recorded by hand as before). Six files: `impl-headings.ts` gained one union, one normaliser and one label helper beside the builders they serve; `shape.ts` compares kind and number in its guard and says which phase in every message; `findings.ts` / `changed.ts` swapped a type and a label; `boundary.ts` states the absent-kind rule in the record's docblock and writes `kind` only when given. Left as is: `PhaseAddress` keeps the bare-number shorthand — a compatibility seam for 49 test call sites, and the same shorthand `### Phase N` is; retiring it is `/cleanup`'s call. Nothing to change

#### Build Phase 2 Context
- [x] Known Gotchas: phase identity is `{kind, number}` in `getPhaseCompletion`, every Shape function and `findPhaseStart`; a boundary record without `kind` is a build phase by rule (every record before 2026-09 was one); `shape-cannot-see-test-phases` closed — replaced the stale "trajectory phase refs are numeric only" clause (false since test-phase-structure) in the same line, so the entry got truer and no longer; one more Current State parenthetical compacted to fit

#### Build Phase 2 Document
- [x] `apps/docs/src/guide/shape.md`: the boundary snippet and the review calls take `{ kind, number }`; a Test Phase is reviewable — paragraph under "Running it" with both call shapes and the absent-kind rule

### Build Phase 3: The admin renders phases from the package parser

**Goal**: `phases.ts` is an adapter over `parseImplString`; both sequences render in document order with their gate stages; rows attach by kind; the regexes are gone.

- [x] `apps/indusk-admin/src/lib/phases.ts`: delete `PHASE_HEADING_RE`, `CHECKLIST_ITEM_RE`, the line walk; `extractPhases(content, trajectory?)` maps `parseImplString(content).phases` to the `Phase` view (as shipped: the view keeps `trajectoryRows` for its three consumers; stage states come from the lifecycle's `derivePhaseActivity`, so the admin holds no state rule of its own; the walk that slices each phase's raw markdown uses `parsePhaseHeading` + `fencedLineMask` and lets a level-2 heading close a phase without ending the scan — the rituals append their phases after `## Notes` and the package parser sees them, so A3 demanded the adapter did too; two things the package had to give first: `impl-parser-core.ts`, the parser without `node:fs` (the browser runtime externalizes it, so the subpath now points at the core), and gray-matter called only when a document opens with a fence, because it reaches for `Buffer`):
  ```ts
  export interface Phase { kind: "test" | "build"; number: number; ordinal: number; title: string; stages: Stage[]; itemCount: number; rows: TrajectoryRow[]; content: string }
  export interface Stage { kind: "implementation" | GateKind; items: { text: string; checked: boolean }[]; state: "done" | "pending" | "opted-out"; proof?: string }
  ```
  rows by `r.passesAtKind === p.kind && r.passesAt === p.number`; `content` is the phase's body between its heading and the next `ANY_PHASE_HEADING` (from `impl-headings`, fence-masked); `splitPhasesAroundFalsification` keys on `RITUAL_ORDER[0]` as a title prefix
- [x] `PlanDetail.tsx` → extract `PhasesSection` to `components/PhasesSection.tsx` (one component per file); title `Test Phase 1: …` / `Build Phase 2: …`; a `StageList` under the title rendering each stage with `data-stage` and `data-state`; the trajectory table shows `Test Phase 1` / `Build Phase 2` in the Writable/Passes cells — as shipped: titles keep the impl's own spelling (`Test Phase 1: …` / `Phase 2: …`, since `### Phase N` is what legacy impls say and the existing tests pin), the trajectory cells use the package's `phaseLabel` (`Build Phase 2`), the `StageList` sits in the collapsible header (`headerRight`) so a phase's shape reads without opening it, each phase wrapper carries `data-testid="phase"` + `data-phase="build-2"`, and the per-phase trajectory test id is `phase-build-N-trajectory` (two older PlanDetail selectors updated)
- [x] `FalsificationSection.tsx`, `lib/markdown-export.ts`: consume `phase.stages` instead of `extractChecklistItems(phase.content)`; delete `extractChecklistItems` — via `phaseItems(phase)`; `phases.test.ts` lost its `extractChecklistItems` suite; `splitPhasesAroundFalsification` now keys on `RITUAL_ORDER[0]` as a title prefix, the readiness gate's rule
- [x] Author A3's parity run (body in the register) against the new adapter; fix any impl in the corpus that the two parsers disagree on by reading the disagreement, never by loosening A3 — one disagreement, on two archived impls (`dawn-ui-plan-grouping`, `versioned-workbench`): the adapter stopped scanning at the first level-2 heading and so dropped the ritual phases appended after `## Notes`; fixed in the adapter (a level-2 heading closes a phase, the scan continues), not in A3; 64 impls now agree

#### Build Phase 3 Verification
- [x] A1, A2, A3, A4, A5, A16 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/PhasesSection.test.tsx src/lib/phases-corpus-parity.test.ts` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts`; then `cd` back — PhasesSection 4/4, corpus parity 64/64 impls, pin 4/4 (its (a) clause went green when the regexes left `phases.ts`)
- [x] Admin suites hold, including screenshots: `cd apps/indusk-admin && pnpm exec vitest run` — expected: all pass; `PlanDetail` screenshot re-baselined deliberately (the phase view changed) and said so here — 34 files: 30 passed, the 3 Build Phase 6 rows still red as they should be (A20, A23, A24), and one HTTP smoke that turned out to read the live repository and pass on `main` only because a stray unclaimed `user-zero` folder exists there — in this worktree every active plan is claimed by a parent, so "Active plans" is legitimately absent; the smoke now accepts a grouped sidebar and only the empty state fails it. No screenshot baseline failed, so none was re-baselined; two older `PlanDetail` selectors moved to the kind-bearing test id
- [x] A25 still green (the adapter is typed against the package) — `tsc --noEmit` 0 errors; `typecheck.test.ts` passes
- [x] Rows A1, A2, A3, A4, A5, A16 set to `passing`
- [x] Shape (Build Phase 3): review `phases.ts`, `PhasesSection.tsx`; record findings or "nothing to change" — recorded by hand (position problem as before; this phase's boundary was opened after the fact at `c794e297`, the commit its work began from). `phases.ts` is one walk that slices raw markdown plus one map that reshapes the package's phases, each stage's items and state coming from the package rather than a local rule; `phaseTitle` / `phaseItems` are the two small helpers three consumers share; `PhasesSection.tsx` is the section plus a `StageList` chip strip with its two lookup tables typed against the lifecycle's unions. `impl-parser-core.ts` is the parser moved, not rewritten, with the reason in its docblock. Left as is: `STAGE_LABEL` and `STATE_CLASS` live in the component today — Build Phase 4's `labels.ts` is where every lifecycle label map goes, and moving them one phase early would be a second home for one phase. Nothing to change

#### Build Phase 3 Context
- [x] Known Gotchas, the admin sidebar entry: phases render through `parseImplString` via the `impl-parser` subpath — never a local heading regex; rows attach by `(passesAtKind, passesAt)` — added into the existing admin gotcha line, which was trimmed of two asides to pay for it; one more Current State clause compacted

#### Build Phase 3 Document
- [x] `apps/docs/src/reference/admin-ui/overview.md`: the phase view — both sequences, gate stages with their three states, rows per phase — the Phases row of the plan-detail table rewritten (both sequences, the package parser, the stage strip, rows by kind) and the falsification detection paragraph now says title-prefix from `RITUAL_ORDER`

### Build Phase 4: The active phase and the three bars

**Goal**: the plan page shows which phase is active and why, and three tri-state bars derived from the lifecycle module; a pin fails when a lifecycle member has no renderer.

- [x] `apps/indusk-admin/src/lib/active-phase.ts`: `deriveActivePhase(phases, records): { ref: PhaseRef | null; hint?: "no boundary record" }` per ADR D4; `planning-reader.ts` reads `.indusk/phase-boundary.jsonl` through `readBoundaries` from the `shape/boundary` subpath and surfaces a throw as `boundaryError: string` on the plan payload, never as `[]` — the reader reads the project's record file once per listing and gives each plan its own records or the error; the matcher for "does this record open this phase" is the package's `boundaryMatches` (new, in a filesystem-free `shape/boundary-record` module the browser can import), so the absent-kind rule has one home; the reader also derives each plan's `position` via `derivePlanPosition` with the readiness gate's result
- [x] `components/bars/labels.ts`: `POSITION_LABELS satisfies Record<PlanPosition, string>`, `ACTIVITY_LABELS satisfies Record<PhaseActivity, string>`, `STAGE_LABELS satisfies Record<GateKind | "implementation", string>` — plus `SEGMENT_CLASS` / `CHIP_CLASS` keyed the same way over the segment states
- [x] `components/bars/Bar.tsx` (one primitive: segments with `data-state`, an active label slot, equal widths, a caption slot) and `PhaseBar.tsx`, `PlanBar.tsx`, `MasterBar.tsx` over it; `PlanBar` caption "steps, not time"; `MasterBar` reads `readPlanHierarchy` + each subplan's `derivePlanPosition`, placeholders `pending` — `MasterBar` takes the subplan entries the page already resolves (each carries its plan's `position`), so it reads nothing itself
- [x] `PlanDetail.tsx`: `PlanBar` under the header for every plan; `PhaseBar` for the active phase above `PhasesSection`; `ActivePhase` marker on the phase (`data-testid="phase-bar-active"`, hint text when set); `boundary-error` block when `boundaryError` is set; `ParentPlanView`: `MasterBar` under the master prose — the active phase's own collapsible also carries `data-active="true"`; a parent plan shows its master bar and not a plan bar (a parent has no lifecycle documents of its own, and the first render labelled it "no lifecycle document yet")
- [x] Author A6, A7, A8–A12, A17 (bodies in the register), RED, then green as each lands; U1: Sandy reviews the rendering against three plans (one planning, one executing, one archived) before this phase's Verification closes — verdict recorded in the item below — authored beside the components they render (their register bodies name the modules this phase creates); every one green; the review ran against this plan (executing), `midnight` (planning), `dawn-workbench-execution` (archived) and `indusk-v4-day` (parent) on a dev server of this branch
- [x] `components/bars/PhasesBar.tsx` (from the U1 review, Sandy: "a phase line under the active one, so that you see what phase you are in"): the phase line — one segment per phase in document order, closed full, the active one partially filled by its items and named, later empty — rendered between the plan bar and the active phase's stage bar, so the three lines read as one zoom (position → phase → stage); A26 authored beside it and green
- [x] (from the U1 review, Sandy): the phases section is the impl, so it is titled **Implementation Plan**, not "Phases", and the whole section is a collapsible like Brief and ADR (open by default, persisted per plan, copyable as markdown); "Follow-up Phases" after the falsification phase keeps its name
- [x] (from the U1 review, Sandy: "default all to collapsed — we want overview before details"): every section on the plan page is closed by default — Research, Brief, Test Plan, ADR, Implementation Plan, Falsification, Cleanup, Follow-up Phases — so the page opens as the three bars and the rest is a click away; the six tests that read a section's body now open it first, and the two that pinned the Brief open by default pin it closed
- [x] (from the U1 review, Sandy: "three lines say the same thing … each should show the name of the subsection as it is happening"): each line names the level below it — the plan bar reads `executing: Phase 4`, the phase line `Phase 4: Verification`, the stage bar `verifying: <the next unchecked item of that stage> (n of m)`; the redundant "Active: …" heading is gone and the no-boundary-record hint sits under the stage bar
- [x] `components/CleanupSection.tsx` (from the U1 review, Sandy: "we also need a cleanup section"): the cleanup ritual's phase is its own section beside Falsification — the decomposition items and the new-unit rows, its stage strip and a complete/in-progress badge in the header — and no longer a follow-up phase; `splitPhasesAroundFalsification` returns `cleanup` and excludes it from `post`; the copy-whole-plan markdown includes it; A27 authored beside it and green

#### Build Phase 4 Verification
- [x] A6, A7, A8, A9, A10, A11, A12, A17 green: `cd apps/indusk-admin && pnpm exec vitest run src/lib/active-phase.test.ts src/components/bars src/lib/lifecycle-render-parity.test.ts src/components/PlanDetail.test.tsx`; then `cd` back — node: active-phase 7/7 (A6 five cases, A7 two reader cases), render-parity 4/4; browser: bars 5/5 (A8–A12), PlanDetail incl. the A7 error block; the bars needed `shape/boundary-record` (a filesystem-free module for the record and its matchers) because the browser runtime externalizes `node:fs`, the same split the parser core needed
- [x] U1 review recorded: Sandy's verdict on the unweighted bar against three real plans, and whether a weighted v2 is filed as a follow-on in the Day master — reviewed 2026-09-16 on a dev server of this branch against this plan (executing), `midnight` (planning), `dawn-workbench-execution` (archived) and `indusk-v4-day` (parent). Verdict: "looks good" — the equal-width bar with its "steps, not time" caption stands; no weighted v2 filed. The review produced five changes instead, all landed in this phase: the phase line (A26), each line naming the level below it, the section renamed Implementation Plan and made collapsible, every section closed by default, and a Cleanup section (A27)
- [x] A25 still green; full admin suite green — `tsc --noEmit` 0; the full admin run shows the three Build Phase 6 rows red as they should be; the four HTTP smokes fail only while the U1 review server (`next dev -p 3941`, this branch) is up, because Next refuses a second dev server on the same app directory — they pass once it is stopped (re-run recorded under the U1 item)
- [x] Rows A6–A12, A17 set to `passing`
- [x] A26 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/bars/PhasesBar.test.tsx`; row A26 set to `passing`; then `cd` back — 2/2; the bar, plan-detail and phases suites still 45/45; `tsc` 0
- [x] A27 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/CleanupSection.test.tsx`; row A27 set to `passing`; then `cd` back — every component suite: 25 files, 105 passed, the 3 Build Phase 6 rows red as they should be
- [x] Shape (Build Phase 4): review `active-phase.ts`, `Bar.tsx` and the three bars; record findings or "nothing to change" — recorded by hand (position problem; this phase's boundary was opened after the fact at `19a5a2ba`, the commit its work began from — which the page itself showed as "no boundary record" until it was). `active-phase.ts` is one function with the rule in its docblock and the absent-kind matcher imported, not restated; `Bar.tsx` is one primitive (segments, an optional label row, an active label, a caption) and `fillPercent` is the only arithmetic; each of the three bars maps its input to segments and picks its label, nothing else; `labels.ts` is five maps, each `satisfies` a lifecycle union; `ActivePhaseBar` in `PlanDetail.tsx` is one component that finds the phase and renders. Left as is: `PlanDetail.tsx` now derives the active phase twice (for the plan bar's label and for `ActivePhaseBar`) — a cheap recomputation, and lifting it into one call would thread a value through three components; `/cleanup` judges whether a `usePlanProgress`-style seam earns it. Nothing to change

#### Build Phase 4 Context
- [x] Conventions: **a plan that adds a lifecycle position, activity or gate kind also adds its rendering in the same plan, as a Document gate item** — `lifecycle-render-parity.test.ts` fails naming the member until it does; the active phase is the most recent boundary record among open phases, first-open-phase with a visible hint when there are none, and a malformed record file is an error block, never a guess — added; paid for by compacting the git-only-substrate and Dawn 6.5 Key Decisions entries to rule + pointer (the periodic pass; both bodies live on their decisions pages), which took the file from ~61.4 KB to ~60.9 KB

#### Build Phase 4 Document
- [x] `apps/docs/src/reference/admin-ui/overview.md`: the three bars — segment states, what each active label says, the master bar's arithmetic, the "steps, not time" caption; the active-phase rule and its hint — a "progress lines" block at the top of the plan-detail entry (the three lines as a zoom, the label rule, segment states, the master bar, the active-phase rule); the sections table now says every section opens collapsed

### Test Phase 2: The live harness

**Goal**: a browser can drive a real `next dev` over a fixture project inside the suite, or the ADR is amended with the fallback; A14 and A15 exist RED either way.

- [x] Extract `startNextDev({ fixture, refreshMs })` from `http-smoke.test.ts` into `src/__tests__/helpers/next-dev.ts` (returns `{ url, projectRoot, stop }`), used by the four existing HTTP smokes unchanged — as shipped: `startNextDev({ home })` returns `{ url, port, stop }` and `makeHome(projects)` writes the registry, because each smoke builds a different fixture and the registry is the only thing they share; all four smokes lost their forty-line copies of the boot and pass on the helper (15 tests)
- [x] Author A14 and A15 in `src/__tests__/live-refresh.e2e.test.ts` (node project, serialized) with `chromium.launch()` from `playwright`; run once against the Build Phase 4 page — RED (no refresh happens; no "last updated") — a temp fixture project (`admin.refresh_ms: 1000`, one two-item phase) registered as `fixture`; A14 red at `waiting for … /2 of 3/` after 3 s, A15 red at `waiting for getByTestId('last-updated')`; Playwright's locator waits rather than its `expect` (only `playwright` is installed, not `@playwright/test`)
- [x] Decide the mechanism by measurement: if the two tests add more than 60 s to the node project or flake in three consecutive runs, replace the file with `manual:`-prefixed rows in the trajectory (`Test` column `manual: docs/admin-ui/live-refresh-smoke.md`) carrying the written procedure, and amend `adr.md` D10 with a dated note; otherwise keep them — kept: the file runs in ~11 s wall-clock including the `next dev` boot (the four smokes take ~14 s for comparison), no flake across the authoring runs; the ADR's D10 stands as written

#### Test Phase 2 Verification
- [x] A14, A15 authored and RED on their own assertions (or converted per the item above, with the ADR amended): `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/live-refresh.e2e.test.ts`; then `cd` back — 2 failed, both `TimeoutError: locator.waitFor` on the row's own wait, 10.6 s total
- [x] The four HTTP smokes still pass on the extracted helper: `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/http-smoke.test.ts src/__tests__/http-stale-project.test.ts src/__tests__/http-project-research.test.ts src/__tests__/http-project-scorecards.test.ts`; then `cd` back — 4 files, 15 tests passed, 14 s
- [x] Rows A14, A15 set to `written`

#### Test Phase 2 Context
- [x] Known Gotchas: the admin's e2e rows drive `next dev` with Playwright from the node project (serialized; `fileParallelism: false` is load-bearing) — or, if converted, that live behaviour is a `manual:` row and why — added to the admin gotcha line, with the fact this phase found the hard way: a dev server left running on the app dir fails every smoke

#### Test Phase 2 Document
- [x] `apps/docs/src/reference/admin-ui/component-conventions.md`: the `next-dev` helper and how an e2e row is written (or the manual smoke procedure page, if converted) — a subsection under Testing: the helper's contract, the one-dev-server rule, and the e2e row shape with its Playwright-locator caveat

### Build Phase 5: Live

**Goal**: the plan page refreshes itself on an interval with a visible "last updated", pauses when hidden, and stops loudly on failure.

- [x] `components/LiveRefresh.tsx` (`"use client"`): `useEffect` interval → `router.refresh()`; `document.hidden` pauses; a rejected refresh sets `failed` and clears the interval; renders `last updated HH:MM:SS` or `refresh failed — reload`; props `{ intervalMs }` — as shipped: `router.refresh()` never rejects, so each tick first HEADs the page itself as a reachability probe and treats a throw or non-2xx as the failure; before the first tick it reads `live — refreshes every Ns`
- [x] `admin.refresh_ms` in `.indusk/config.json` (default 5000, min 1000) read by `planning-reader.ts`'s config reader; `update.ts` ensure block does **not** write it (absent = default; a config key nobody set is not machine state to share) — `readAdminRefreshMs(projectRoot)` in the reader (absent, unreadable or non-numeric → 5000; floored at 1000); `InduskConfig.admin?.refresh_ms` typed in the package
- [x] `app/p/[project]/plan/[name]/page.tsx` wraps its body in `LiveRefresh`; no other page does

#### Build Phase 5 Verification
- [x] A14, A15 green (or the manual procedure executed once and its result recorded here with date and observed interval): `cd apps/indusk-admin && pnpm exec vitest run src/__tests__/live-refresh.e2e.test.ts`; then `cd` back — 2 passed, 6.9 s wall-clock including the `next dev` boot; a checkoff written to disk reached the open page within one 1 s interval with the Implementation Plan section still open, and killing the server produced "refresh failed"
- [x] Full admin suite green; `LiveRefresh` has a component test for the failure state and the hidden-tab pause (mocked router) — 43 files: 40 passed, the 3 Build Phase 6 rows red as they should be (254 tests, 251 passed); `LiveRefresh.test.tsx` covers the tick, the failed probe (stops ticking, says so) and the hidden tab; the package's config tests still pass with the new `admin` field
- [x] Rows A14, A15 set to `passing`
- [x] Shape (Build Phase 5): review `LiveRefresh.tsx`; record findings or "nothing to change" — recorded by hand (position problem as before; boundary opened at `de005866` before the work). `LiveRefresh.tsx` is one component with one effect (probe, refresh, stamp) and two rendered states, the reason for the probe in the comment beside it; `readAdminRefreshMs` is one function with its fallbacks stated; the page wraps once. Left as is: a tick is two round-trips (HEAD, then the refresh) — merging them would mean a route handler that reports reachability and re-renders, which the ADR rejected as a second data path; at a 5 s default the cost is nothing. Nothing to change

#### Build Phase 5 Context
- [x] Architecture, indusk-admin entry: the plan page is live via `router.refresh()` on `admin.refresh_ms` (default 5000); only the plan page; failure stops visibly

#### Build Phase 5 Document
- [x] `apps/docs/src/reference/admin-ui/overview.md`: live refresh — the interval config, what "last updated" means, why there is no push channel; a Mermaid sequence `LiveRefresh → router.refresh() → server components → disk` — "The page is live" paragraph plus the sequence diagram in the plan-detail entry
- [x] U2 note written to `.indusk/current.md` Project (shared): revisit the default on 2026-09-30

### Build Phase 6: Sidebar root, registry, project list, scorecards

**Goal**: the sidebar draws the root; dead registry entries can be pruned and no test leaks into the real registry; the project list labels shape; the scorecards page says why it is empty.

- [x] `PlanList.tsx` `buildGroups` returns `{ root, groups, rest }`; render one root node (the root master's title) with parent groups and the unclaimed plans beneath it; a sub-plan under two parents renders under both — `readPlanDeclarations` now returns `root: { name, title }` (title from frontmatter, else the first `# ` heading, else "master"); group sections carry `data-parent`
- [x] `lib/admin/registry.ts` `pruneRegistry({ dryRun }): { removed: ProjectEntry[]; kept: ProjectEntry[]; backup?: string }` — dead = `!existsSync(entry.path)`; backup `projects.json.bak.<ISO>` before the temp-file-and-rename write; `bin/commands/ui.ts` gains `prune [--dry-run]` printing names and paths
- [x] `app/page.tsx` / `ProjectGrid.tsx`: show entries whose path exists; label `workbench` / `normal-mode` via `isWorkbench(readConfig(entry.path))`; a dead entry is listed in a collapsed "not found (n) — `indusk ui prune`" note, not as a project card — `isWorkbench` reaches the admin through a new `./worktree/repos` subpath export
- [x] Fix the leakers named by A22: `init-workbench.test.ts`, `multi-agent-init.test.ts` (and any others the scan lists) set `INDUSK_HOME` to a temp dir — seven suites: the two named plus `detect-tooling-honesty`, `hooks-load-in-cjs-consumer`, `repos-root-single-definition`, `workbench-blindness`, `worktree-config-schema-pointer`
- [x] `scorecards/page.tsx`: pass `hasEvalDir`; the empty branch says "no evaluations recorded yet — the first evaluated commit creates `.indusk/eval/`"

#### Build Phase 6 Verification
- [x] A20, A21, A22, A23, A24 green: `cd apps/indusk-admin && pnpm exec vitest run src/components/PlanList.root.test.tsx src/components/ProjectGrid.shape.test.tsx "src/app/p/[project]/scorecards/Scorecards.empty.test.tsx" src/__tests__/typecheck.test.ts` → 3 files / 4 tests passed (A20, A23, A24, A25); `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/ui-prune.test.ts src/__tests__/registry-leak-scan.test.ts` → 2 files / 3 tests passed; the full admin suite 43 files / 254 tests green
- [x] `indusk ui prune --dry-run` run once against the real registry from the repo root, its count recorded here; then `indusk ui prune` and the resulting count (expected: from ~1,588 to the live handful; the backup path named) — dry run: would remove 2,296, keep 11 (the registry had grown from the 1,588 measured at research to 2,307 as the leaking suites kept running); real run: removed 2,296, kept 11, backup `~/.indusk/projects.json.bak.2026-09-16T22-47-29-060Z`; a second dry run reports `Registry clean: 11 project(s)`
- [x] Rows A20–A24 set to `passing`
- [x] Shape (Build Phase 6): review `buildGroups`, `pruneRegistry`, the grid; record findings or "nothing to change" — reviewed `PlanList.buildGroups` + the root render, `pruneRegistry`, `uiPrune`, `app/page.tsx`, `ProjectGrid`, `ProjectCard`, `rootTitle`: nothing to change. Left as-is, with reasoning: `pruneRegistry` and `app/page.tsx` each run `existsSync` twice per entry (one filter for the live set, one for the dead) — a single partition would save a stat per entry over eleven entries and cost a helper whose name says less than the two filters do

#### Build Phase 6 Context
- [x] Known Gotchas, the admin sidebar entry: the tree has a root node (the root master) with parents and unclaimed plans beneath it; Architecture, indusk-admin: `indusk ui prune [--dry-run]` removes dead registry entries with a backup; every test that spawns `init`/`update`/`ui` sets `INDUSK_HOME` (pinned by `registry-leak-scan.test.ts`) — both landed in Known Gotchas (the sidebar entry and the registry clause of the admin entry, where the never-auto-pruned rule already lived); paid for under the 60 KB budget by trimming three anecdotes (the 2026-09-15 publish story, the A8 date, the test-phase-structure follow-on list)

#### Build Phase 6 Document
- [x] `apps/docs/src/reference/admin-ui/cli.md`: `indusk ui prune [--dry-run]`
- [x] `apps/docs/src/reference/admin-ui/overview.md`: the sidebar root node; project list labels and the not-found note; the scorecards empty state and why the directory appears late

### Build Phase 7: Record

**Goal**: the decision is published, the masters and changelog say what shipped, and the convention is where every future plan reads it.

- [x] `apps/docs/src/decisions/admin-ui-phase-progress.md` (ADR summary; the noun/verb rule; the convention) + sidebar entry beside `dawn-ui-plan-grouping` — `dawn-ui-plan-grouping` has a lessons page but no decisions page, so the entry sits alphabetically after "Admin UI Hosting"
- [x] `apps/docs/src/changelog.md` Unreleased entry per the ADR's Documentation Plan
- [x] Masters: `.indusk/planning/indusk-v4-day/master.md` step 3 and `.indusk/planning/master.md` roadmap row → impl complete, close-out rituals pending
- [x] Set impl status `completed`

#### Build Phase 7 Verification
- [x] (no tests flip at this phase — reason: infra) — this phase writes record only; A13's snapshot was re-baselined for this plan's folder, no row changed state
- [x] All 25 rows terminal: `cd apps/indusk-mcp && pnpm exec tsx -e 'import { readFileSync } from "node:fs"; import { auditPlanAtClose } from "./src/lib/trajectory/audit.ts"; const a = auditPlanAtClose(readFileSync("../../.indusk/planning/admin-ui-phase-progress/impl.md","utf-8")); console.log(JSON.stringify(a.nonTerminal))'` — expected `[]`; then `cd` back — `nonTerminal []`, `blocked []`, 2 deferred rows classified (27 rows once A26/A27 joined at the U1 review)
- [x] Full suites green in both apps: `pnpm turbo test --filter=@infinitedusky/indusk-mcp --filter=indusk-admin` (admin daemon/bundle suites excepted only if red on `main` at the same commit, and said so) — admin 43 files / 254 tests green; mcp green after three things the first run surfaced: (1) the daemon and bundle suites (`admin-cli-lifecycle`, `cli-bare-ui-cwd-aware`, `admin-bundle-pack`, 9 tests) were red here and green on `main` at `5c675c58` — the admin bundle is a build artifact this worktree never had; `pnpm --filter indusk-admin build && node scripts/bundle-admin.js` built it (a production `next build` of this plan's admin, clean) and all 9 pass; (2) `lifecycle-parity` (A13) flagged this plan's own folder — its impl went `completed`, so `nextStep` and `readiness.missing` moved; re-baselined by hand, the reader unchanged — the corpus contains the plan in flight, so every status change of this plan re-baselines it (carry to the retrospective); (3) `shape/dogfood` threw "corrupt record, line 53": the Build Phase 7 boundary record I wrote by hand passed `phase: {kind, number}` where `recordPhaseStart` takes `phase: number, kind` — the writer took the object and wrote it, and every reader then refused the whole file (the admin would have shown the error block). Record repaired by hand; **`/falsify` hypothesis: the boundary writer accepts what its readers refuse — it should validate the record it writes through the same rule `readBoundaries` applies**
- [x] `indusk context check-pointers` — PASS (61 pointers scanned, all resolve; run again after the Current State edit, PASS)
- [x] Shape (Build Phase 7): no code this phase; record "no code files changed" — no code files changed: docs pages, the VitePress sidebar, the changelog, two masters, CLAUDE.md and this impl only

#### Build Phase 7 Context
- [x] Current State: one line for `admin-ui-phase-progress` — the finished picture as of now, live, from one lifecycle definition; the convention that a plan adding a stage renders it — landed at 61,434 of 61,440 bytes after trimming four shipped-plan narratives (indusk-makeover's late-retrospective note, dawn-ui-plan-grouping's fix counts, dawn-verify's "first thing ever", lifecycle-rebalance's slice list, dawn-hook-parity's `ask` clause); the retrospective's compaction step has no headroom left to spend and must sweep before it adds

#### Build Phase 7 Document
- [x] `apps/docs/src/guide/plan-lifecycle.md`: the convention paragraph — a plan that adds a position, activity or gate kind adds its rendering in the same plan; what the pin does when it does not

### Build Phase 8: Falsification — a title read from a comment, a bar that hides the blocked rows, a writer that corrupts its own file, a leak the scan cannot see

**Goal**: verify whether the attested state holds against six ways the finished picture can be confidently wrong. (1) **The root's title.** `rootTitle` falls back to the first `# ` line of the *raw* file, and the real root master's frontmatter carries four `# …` YAML comment lines before its body — a root master without `title:` would head the whole sidebar with "Machine-readable plan hierarchy (dawn-ui-plan-grouping). Prose below is for". (2) **The plan bar over readiness.** `resolvePosition` reads `readiness.missing` for `falsification` and `cleanup` and nothing else: a completed impl whose only problem is a `blocked` row (`missing: ["rows"]`) reads "cleaned, awaiting /retrospective", and a `null` readiness (malformed impl) reads the same — the gate would refuse, the bar says come ahead. (3) **The boundary writer.** `recordPhaseStart` appends whatever it is handed; `isBoundaryRecord` lives in the reader only. One malformed append (this plan's own Build Phase 7 record, written by hand with `phase: {kind, number}`) made every reader — Shape, the dogfood test, the admin's plan page — refuse the entire file. The writer accepts what its readers refuse. (4) **The leak, structurally.** `runCli` spreads `process.env` and sets no `INDUSK_HOME`, so every suite must remember to; the seven fixed in Build Phase 6 use `??=`, which yields to a developer who exports `INDUSK_HOME` in their shell — and the scan is satisfied by the string's presence. The scan's list is also narrower than the set of registering commands: `setup` delegates to `init`. No test spawns `setup` without the pin today; the gap is latent, not observed. (5) **The empty implementation stage.** `parseImplString` always emits an implementation gate; `derivePhaseActivity` marks a stage with `total === 0` active ("implementing 0 of 0") because `total > 0 && checked === total` is false — so a Falsification phase whose hypotheses all hold (no fix items) never reads `closed` while `deriveActivePhase` says nothing is open. No such phase exists in the corpus today (checked over every impl); the ritual's own shape produces one. (6) **The unlabelled active segment.** `executing` returns `awaiting: null` and the plan bar's label comes from the active phase's activity; an in-progress impl with every item checked has no active phase, so the bar's active segment carries nothing — D5 says it always carries the message. Each row is one hypothesis; each item the fix if it confirms.

- [x] `plan-parser.ts` `rootTitle`: match the heading against the document **body** (gray-matter's `content`, the same parse `readMasterFrontmatter` already does), never the raw file; frontmatter comments and fenced code cannot become a title — fenced lines masked with `fencedLineMask` from `impl-headings.ts`, the one fence rule
- [x] `lifecycle.ts` `resolvePosition`: a completed impl with `missing` containing `rows` resolves to `retrospective` with `awaiting: "rows not terminal — retrospective blocked"` (the position is right, the message names the block); `readiness === null` with a completed impl resolves with `awaiting: "impl complete — readiness unknown (impl unreadable)"`, never "cleaned" — the unknown case sits at `falsify`, the earliest position a completed impl can hold; the rows message names the non-terminal ids
- [x] `shape/boundary.ts`: export `isBoundaryRecord` from the reader and call it in `recordPhaseStart` before the append — a record that fails it throws naming the field (`phase must be a finite number; got object`), and `kind`, when present, must be `test` or `build`; nothing is written — one predicate, `boundaryRecordProblem`, returns the field-naming reason; the reader's per-line error now carries the same reason
- [x] `helpers/cli.ts` `runCli`: set `INDUSK_HOME` to a fresh per-process temp directory unless the caller passes one in `env` — the helper is the one place every CLI-spawning suite already goes through; the seven `??=` pins become unconditional assignments (a temp home is never wrong for a test); `registry-leak-scan.test.ts` adds `setup` to every spawn shape and asserts, from a fixture string, that a `"setup"` spawn is recognized
- [x] `lifecycle.ts` `derivePhaseActivity`: an implementation stage with zero items is omitted from `stages` and never active, so the first gate with unchecked items names the verb and all-checked gates read `closed`
- [x] `lifecycle.ts` `resolvePosition`: `executing` with a parsed impl in which no phase has an unchecked item returns `awaiting: "every item checked — impl status is still in-progress"`; the plan bar shows it when there is no active phase — `PlanBar` already falls back to `awaiting` when there is no activity, so no admin change was needed

#### Build Phase 8 Verification
- [x] A28: `readPlanDeclarations` over a planning dir whose `master.md` has frontmatter without `title` and a `# comment` line, body `# Real Title` → `root.title === "Real Title"` — RED today (the comment wins), green after — 2026-09-16: red as `expected 'Machine-readable plan hierarchy (dawn…' to be 'Real Title'` (three of four cases), green after; a fenced `# shell comment` case red the same way, green after
- [x] A29: `derivePlanPosition` with `summary.stage === "impl"`, `stageStatus === "completed"`, `readiness.missing === ["rows"]` → `awaiting` matches `/rows/`; with `readiness: null` → `awaiting` matches `/unknown/` and never `/cleaned/` — RED today, green after — 2026-09-16: red as `expected 'cleaned, awaiting /retrospective' to match /rows/` and `… /unknown/`, green after
- [x] A30: `recordPhaseStart(root, { plan, phase: { kind: "build", number: 7 } as never, sha, at })` rejects naming `phase`; `readBoundaries(root)` afterwards returns exactly the records present before; `kind: "nope"` rejects the same way — RED today (it appends, and the next read throws "line N is missing required fields"), green after — 2026-09-16: red as `promise resolved "undefined" instead of rejecting` (three cases), green after
- [x] A31: with `process.env.INDUSK_HOME` pointed at a temp "shell home", `runCli(dir, ["init", "--local", "--no-index"])` leaves that home without a `projects.json`; `SPAWN_SHAPES` match `runCli(cwd, ["setup", …])` — RED today on both, green after; then `registry-leak-scan.test.ts` and the seven pinned suites still green — 2026-09-16: red as `the exported INDUSK_HOME received a registry: expected true to be false` and `setup registers … expected false to be true`, green after; the full mcp suite (every CLI test now goes through the changed helper) 229 files / 1,376 tests green
- [x] A32: `derivePhaseActivity` on a phase whose implementation gate has no items and whose gates are all checked → `activity === "closed"` and no `implementation` stage; with one unchecked Verification item → `activity === "verifying"` — RED today (`implementing`), green after — 2026-09-16: red as `expected 'implementing' to be 'closed'` / `… 'verifying'`, green after
- [x] A33: `derivePlanPosition` with `stageStatus === "in-progress"` and an impl in which every item is checked → `awaiting` matches `/every item checked/` — RED today (`null`), green after — 2026-09-16: red as `.toMatch() expects to receive a string, but got object` (the `null`), green after
- [x] A1–A27 still green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/lifecycle-single-definition.test.ts src/__tests__/lifecycle-parity.test.ts src/__tests__/plan-declarations.test.ts src/__tests__/registry-leak-scan.test.ts src/lib/shape` and `cd apps/indusk-admin && pnpm exec vitest run` — expected: all pass (A13's snapshot re-baselined by hand for this plan's folder if its status moved, named here); then `cd` back — admin 43 files / 254 tests green against the rebuilt package; mcp full suite green except A13, which flagged this plan's own folder twice in one phase (status back to `in-progress` when the phase was authored; `rows` leaving `missing` when A28–A33 went passing) — re-baselined by hand both times, no other folder moved. **The parity corpus contains the plan in flight, so every state change of this plan re-baselines it; carry to the retrospective as a follow-on: exclude the executing plan, or snapshot the archive only**
- [x] Rows A28–A33 set to `passing`
- [x] Shape (Build Phase 8): review the phase's files; record findings or "nothing to change" — reviewed `rootTitle` (one loop over masked body lines), `boundaryRecordProblem` + `isBoundaryRecord` (one predicate, two callers), `runCli` + `defaultTestHome` (one lazily created temp per process), `resolvePosition`'s completed branch, `derivePhaseActivity`'s stage skip, the five new test files: nothing to change. Left as is, with reasoning: `resolvePosition` is now a ~60-line chain of `if` over `(stage, status, readiness)` — readable as a decision list and every branch is a sentence a reader can find; a table-driven form would be shorter and say less. `/cleanup`'s question if it grows again

#### Build Phase 8 Context
- [x] Known Gotchas, the phase-boundary entry: the writer validates with the reader's predicate — a record that would make `readBoundaries` throw is refused at write time, because one bad append blinds every reader; Known Gotchas, the admin entry: `runCli` pins `INDUSK_HOME` to a temp dir by default, the scan is the second line — both landed; paid for by trimming three Key Decisions anecdotes (test-phase-structure's 260-of-444 motivation, the makeover's rejected list, dawn-verify's matrix result, each on its decisions page); CLAUDE.md at 61,330 of 61,440

#### Build Phase 8 Document
- [x] `apps/docs/src/guide/shape.md` (the boundary record): the writer refuses what the reader would; `apps/docs/src/reference/admin-ui/overview.md`: the plan-bar messages for blocked rows, unknown readiness, and an all-checked in-progress impl; `apps/docs/src/reference/admin-ui/component-conventions.md`: `runCli` pins `INDUSK_HOME`

### Build Phase 9: Cleanup — one rows table, one ritual section, one phase spelling, the project readers out of the plan reader

**Goal**: decompose what this plan grew in the admin per the rule of three and settled module boundaries. The scan (`listOversizedChangedFiles`, cap 400) flagged eight changed files; two of them are this plan's to shape (`planning-reader.ts` at 517, and the `PlanDetail.test.tsx` it grew to 788), the rest are prose, a fixture, or files the plan touched by a handful of lines (`cli.ts`, `config.ts`, the work skill, the changelog). Reading across the changed components found what a phase-scoped review cannot: the trajectory-rows table is written three times (Falsification, Cleanup, Phases — the third copy landed in Build Phase 4, the second in Build Phase 6), the Cleanup section is a near-byte copy of the Falsification phase section with two headings changed (and each has its own markdown exporter), the page shows two spellings of one phase (`Phase 4` in every heading, `Build Phase 4` in the rows' Writable/Passes cells — the admin's `phaseTitle` beside the package's `phaseLabel`), the three section-opening test helpers are copied across three test files, the plan-folder reader carries three project-level readers that are not about plan folders, and one of those hand-parses `.indusk/config.json` when the package already has `readConfig`. No `react`/`nextjs` extension is enabled, so the moves are extract-a-module on cohesion and duplication grounds, not framework idiom. Each item below is one extraction, move, or a reasoned leave-as-is; each new public unit has a row.

- [ ] Extract `components/phases/TrajectoryRowsTable.tsx` — `{ rows, phaseColumns?: boolean }`: ID / Asserts / [Writable at / Passes at] / State with the state badge; `PhasesSection` (five columns), `FalsificationPhaseSection` and `CleanupSection` (three) render through it — rule of three, the third copy was written by this plan
- [ ] Extract `components/phases/RitualPhaseSection.tsx` — the collapsible a ritual phase renders as (`{ ritual: "falsification" | "cleanup", planName, phase, rowsHeading, itemsHeading }`): title word + `phaseTitle`, complete badge, `persistKey`, `StageList` in the header, rows table, items list, test ids `${ritual}-section` / `${ritual}-rows` / `${ritual}-items` (keep `falsification-hypotheses` and `falsification-fix-items` as the falsification ids so the existing falsification-section tests and A27 hold); `FalsificationPhaseSection` and `CleanupSection` become one-line configurations; `lib/markdown-export.ts` gains one `ritualPhaseMarkdown(word, phase, rowsHeading, itemsHeading)` and loses `falsificationPhaseMarkdown` (the Cleanup section's copy button used the generic `phaseMarkdown`, so the two rituals copied different shapes for the same phase)
- [ ] One phase spelling in the admin: move `phaseTitle` from `lib/phases.ts` (a data adapter) to `components/bars/labels.ts` (the display vocabulary, beside the other label maps), and use it in `PhasesSection`'s Writable at / Passes at cells in place of the package's `phaseLabel` — the package spelling (`Build Phase 4`) is the canonical name for logs and the impl-headings parser; the page speaks the impl's own spelling (`Phase 4`, `Test Phase 1`), as Sandy's label direction at U1 fixed it
- [ ] Move `ActivePhaseBar`, `activePhaseOf` and `activePhaseLabel` from `PlanDetail.tsx` into `components/bars/ProgressLines.tsx` (exports `ProgressLines` and `activePhaseLabel`), sharing one "find the active `Phase`" lookup the two callers each wrote — `PlanDetail` composes ten sections and this trio is the only derivation logic in it; the bars folder owns the progress lines
- [ ] Move the project-level readers out of `lib/planning-reader.ts` into `lib/project-reader.ts`: `readProjectBoundaries`, `readAdminRefreshMs` (+ `DEFAULT_REFRESH_MS` / `MIN_REFRESH_MS`), `hasEvalDirectory` — `.indusk/config.json`, `.indusk/eval/` and `.indusk/phase-boundary.jsonl` are project facts, not plan-folder facts; `readAdminRefreshMs` reads through the package's `readConfig` via a new `./config` subpath export (`InduskConfig.admin.refresh_ms` is already typed there) instead of a second `JSON.parse` of the file — "never duplicate parsing" is the admin's standing rule
- [ ] Extract the section-opening test helpers into `src/__tests__/helpers/sections.ts` — `openSection(container, testId)`, `openImplPlan = openSection(c, "phases-section")`, `openAllPhases` — copied across `PlanDetail.test.tsx`, `PhasesSection.test.tsx`, `FalsificationSection.test.tsx`; the three files import them
- [ ] (reviewed `apps/indusk-mcp/src/lib/lifecycle.ts` (375) — left as-is: it is the ADR's one module by design; splitting positions from activities would make two files the single-definition pin has to know about, for a cohesion the section comments already give)
- [ ] (reviewed `apps/indusk-mcp/src/lib/plan-parser.ts` (377), `impl-parser-core.ts` (249) / `impl-parser.ts` — left as-is: the parser split is deliberate (filesystem-free core for the browser), and `rootTitle` + the declarations reader belong with the parser that reads master files)
- [ ] (reviewed `PlanDetail.test.tsx` (788, over cap) — left as-is: a test file that grew by the section-opening helpers this phase extracts and by the A26/A27 cases; splitting a component's test file by section would scatter the shared `mockPlan` fixture; the helpers extraction is what it needed)
- [ ] (reviewed `cli.ts` (822), `config.ts` (517), `skills/work.md` + `SKILL.md` (472), `changelog.md`, the parity snapshot fixture — left as-is: over the cap before this plan and touched by it in a handful of lines (`ui prune`, one type field, the Shape snippet's `kind`, one entry, a fixture); decomposing the CLI or the config module is not this plan's output)
- [ ] (reviewed `components/bars/Bar.tsx` (114), `PhasesSection.tsx` (166), `LiveRefresh.tsx`, `active-phase.ts`, `__tests__/helpers/next-dev.ts` — left as-is: each is one unit under the cap with one reason to change; the bars' test fixture builders (`stage`, `phase`, `state`, `at`) are each specific to their bar's props, not copies)

#### Build Phase 9 Verification
- [ ] A34: render `TrajectoryRowsTable` with `phaseColumns` on and off → five and three header cells, the state badge per row; then `PhasesSection.test.tsx`, `FalsificationSection.test.tsx`, `CleanupSection.test.tsx` still green
- [ ] A35: render `RitualPhaseSection` for both rituals → the pre-existing test ids and headings; `falsificationPhaseMarkdown` no longer exists (grep) and the Cleanup section's copy button yields the ritual-shaped markdown; then `PlanDetail.test.tsx`'s falsification cases and A27 still green
- [ ] A36: `PhasesSection.test.tsx` asserts a row's Writable at / Passes at cells read `Phase N` / `Test Phase N` and no cell reads `Build Phase` — RED today (`Build Phase 4`), green after
- [ ] A37: `readAdminRefreshMs` over a project whose `config.json` is malformed JSON → `DEFAULT_REFRESH_MS`; over `{ admin: { refresh_ms: 2500 } }` → 2500; `import("@infinitedusky/indusk-mcp/config")` resolves from the admin — RED today (no subpath), green after
- [ ] Every earlier row still green: `cd apps/indusk-admin && pnpm exec vitest run` and `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/exports*.test.ts src/__tests__/lifecycle-single-definition.test.ts src/__tests__/lifecycle-parity.test.ts` — expected: all pass (A13 re-baselined by hand for this plan's folder if its status moved, named here); `pnpm exec tsc --noEmit -p .` in the admin exits 0 (A25); then `cd` back
- [ ] Rows A34–A37 set to `passing`
- [ ] Shape (Build Phase 9): review the phase's files; record findings or "nothing to change"

#### Build Phase 9 Context
- [ ] Known Gotchas, the admin sidebar/phases entry: the phase view's shared pieces live in `components/phases/` (`TrajectoryRowsTable`, `RitualPhaseSection`), the progress lines in `components/bars/` (`ProgressLines`), project-level reads (`config.json`, `eval/`, the boundary record) in `lib/project-reader.ts`; the admin's phase spelling is `phaseTitle` in `bars/labels.ts`, the package's `phaseLabel` is for logs and parsing; config is read through the `./config` subpath, never parsed by hand

#### Build Phase 9 Document
- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: the module map after cleanup — `components/phases/`, `components/bars/ProgressLines`, `lib/project-reader.ts`, `__tests__/helpers/sections.ts`; the one-spelling rule; `apps/docs/src/reference/trajectory/parser.md`: the `./config` subpath joins the exports list

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
