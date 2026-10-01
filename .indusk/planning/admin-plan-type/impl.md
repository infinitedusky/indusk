---
title: "The admin says what kind of plan it is"
status: in-progress
approved: 2026-10-01
date: 2026-10-01
trajectory: required
test_phases: required
gate_policy: ask
workflow: bugfix
---

# Implementation

Rows are the assertions of [test-plan.md](test-plan.md), same IDs. This is a
bugfix-type plan, so there is no ADR; the design choices are in the test plan's
Notes and are approved with this document.

## Test Trajectory

Test paths are repo-root-relative (the verify runner's cwd is the repo root).

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | A plan whose brief declares a type shows that type as a chip in the plan header | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A2 | A plan that declares no type shows "type not declared" in the header, never a guess from which documents exist | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A3 | A plan that declares a word outside the four types shows that word and says it is not a recognised type — not treated as known, not folded into "not declared" | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A4 | Clicking the type chip opens an explanation — what the type is for, which documents it requires, which it skips, and why — and it closes with Escape or its close button | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A5 | On a bugfix plan the absent research and the absent ADR read skipped, both behind the plan's position and ahead of it | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A6 | On a bugfix plan that has an impl and no test plan, the test plan reads missing | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A7 | On a bugfix plan whose brief exists and whose test plan is not written yet, the test plan reads pending, not missing | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A8 | On a plan that declares no type, an absent earlier document reads unknown, never skipped; documents not yet reached still read pending | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A9 | A feature plan with every document present reads exactly as it does today | Test Phase 1 | Test Phase 1 | planned | apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts |
| A10 | When a document is missing or unknown the page says so in words beside the bar — which document and why — not by colour or hover alone | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/components/PlanDetail.type.test.tsx |
| A11 | Every state a bar segment can be in has its own drawing and its own label in the admin; a state added to the lifecycle without one fails by name | Test Phase 1 | Build Phase 2 | planned | apps/indusk-admin/src/lib/segment-state-render-parity.test.ts |
| A12 | What the admin says a type requires and skips equals the planner skill's workflow table and each workflow template's list of documents — one set of facts, three statements | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A13 | The bugfix workflow template lists the test plan among the documents it creates | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A14 | Every brief template the planner uses — in the skill and in each workflow template — carries a `workflow:` line | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A15 | The archived release-ritual plan, read through the admin's reader from this repository, is a bugfix with research and ADR skipped and the test plan missing | Test Phase 1 | Build Phase 3 | planned | apps/indusk-admin/src/lib/planning-reader.workflow.test.ts |
| A16 | In this repository every active plan declares a type — in its brief, or in its research document when the plan is research only | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/active-plans-declare-workflow.test.ts |
| A17 | The installed copy of the planner skill is byte-identical to the package's | Test Phase 1 | Test Phase 1 | planned | apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts |
| A18 | The workflow-type definitions are reachable by their documented package subpath from outside the package | Test Phase 1 | Build Phase 1 | planned | apps/indusk-admin/src/lib/planning-reader.workflow.test.ts |

## Checklist

### Test Phase 1: Author every row against today's behaviour, RED

- [ ] Create this plan's worktree with `indusk worktree create admin-plan-type`
- [ ] Author A5–A9 in `apps/indusk-mcp/src/lib/lifecycle-document-states.test.ts`, calling `derivePlanPosition` the way `lifecycle-derive.test.ts` does, with the type carried on the plan summary. Compare states as strings, so a state word the union does not hold yet is a failed assertion and not a type error
- [ ] Author A12–A14 and A17 in `apps/indusk-mcp/src/__tests__/workflow-types-parity.test.ts`. The definitions module does not exist yet: load it with a dynamic `import()` inside the test, so its absence fails A12 by name instead of failing the file to load. A13 and A14 read the template and skill text
- [ ] Author A16 in `apps/indusk-mcp/src/__tests__/active-plans-declare-workflow.test.ts`, over `.indusk/planning/`: an active plan is a folder outside `archive/` holding a brief or a research document; a parent that holds only `master.md` is not one. The failure names every plan without a type
- [ ] Author A1–A4 and A10 in `apps/indusk-admin/src/components/PlanDetail.type.test.tsx`, rendering the existing plan page. Assert on what is read — the chip's text, the explanation's text, the sentence beside the bar — never on `data-state`, which the bar already copies from its input and would pass for the wrong reason
- [ ] Author A11 in a new file, `apps/indusk-admin/src/lib/segment-state-render-parity.test.ts`, importing the lifecycle as a namespace. A named import of a list that does not exist yet is a link error that would take the existing parity file down with it
- [ ] Author A15 and A18 in `apps/indusk-admin/src/lib/planning-reader.workflow.test.ts`: A15 reads `.indusk/planning/archive/release-ritual` from this repository through the reader; A18 imports the package subpath dynamically
- [ ] Run every file and read every failure: each row fails on its own assertion, and no file fails to load

#### Regression Guards

- **A9** — passes the moment it is written: a feature plan with every document present has no absent document to judge. It guards the new judgment against changing a plan it has no business touching.
- **A17** — passes the moment it is written: the planner skill's two copies are byte-identical today. Build Phase 3 edits one of them, and this keeps the other in step.

#### Test Phase 1 Verification

- [ ] A1–A18 authored; A9 and A17 pass; every other row fails on its own assertion and no file fails to load (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/lifecycle-document-states src/__tests__/workflow-types-parity src/__tests__/active-plans-declare-workflow` and `pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/lib/segment-state-render-parity src/lib/planning-reader.workflow`)

#### Test Phase 1 Context

- [ ] None expected — this phase only authors tests against today's behaviour. Ask Sandy before skipping the gate, and record the exchange as the skip's proof

#### Test Phase 1 Document

- [ ] None expected — there is nothing user-facing until Build Phase 2. Ask Sandy before skipping the gate, and record the exchange as the skip's proof

### Build Phase 1: the type decides what an absent document means

- [ ] Add `apps/indusk-mcp/src/lib/workflow-types.ts`: the four types, and for each its purpose, the documents it requires, the documents it skips, and why. The retrospective is required for every type that ships an impl; a spike requires only its research. One function reads a frontmatter value into a known type, an unrecognised word, or nothing. The module touches no filesystem, so a browser component can import it
- [ ] Export it as `./workflow-types` in `apps/indusk-mcp/package.json`
- [ ] The plan summary carries the declared type and, separately, an unrecognised word when one was declared. `parsePlan` reads it from the brief's frontmatter, from the research document when the plan has no brief, and never from the impl
- [ ] `lib/lifecycle.ts` gains a runtime list of segment states that includes `missing` and `unknown`, with the type derived from the list
- [ ] `derivePlanPosition` judges an absent document by the plan's type: required and already passed is missing; not required is skipped, behind or ahead; no type and already passed is unknown; everything else as today. The requirement lists are imported from the workflow-types module — no second copy in the lifecycle
- [ ] Correct the docblock on `derivePlanPosition`, which today says skipped is decided by the file's absence
- [ ] Build the package so the admin reads the new module (`pnpm --filter @infinitedusky/indusk-mcp build`)

#### Build Phase 1 Verification

- [ ] A5, A6, A7, A8 pass and A9 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/lifecycle-document-states src/lib/lifecycle-derive src/__tests__/lifecycle-single-definition src/__tests__/lifecycle-parity`)
- [ ] A18 passes against the built package (`pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.workflow -t A18`)
- [ ] The package type-checks (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit -p .`, exit 0)

#### Build Phase 1 Context

- [ ] Conventions, the entry that begins "The lifecycle is one definition": name the segment-state list and say an absent document is judged by the plan's declared type, from `lib/workflow-types.ts`. The root file has 42 bytes of headroom, so this is an edit in place that shortens the same entry's wording by at least as much as it adds

#### Build Phase 1 Document

- [ ] `apps/docs/src/guide/plan-lifecycle.md`: a short section on what an absent document reads as — skipped, missing, pending, unknown — and that the plan's type decides

### Build Phase 2: the admin shows it

- [ ] `components/bars/labels.ts`: a class and a word for `missing` and `unknown` in the segment and chip maps, typed against the lifecycle's list so a new state is a type error
- [ ] `components/bars/Bar.tsx`: `missing` and `unknown` are each drawn differently from `skipped` and from each other, in the segment and in its label; the segment's title says its state in words
- [ ] `components/bars/PlanBar.tsx`: a sentence under the bar for each missing or unknown document — which one, and why. Update the component's docblock, which says skipped positions are drawn as skipped
- [ ] `lib/planning-reader.ts`: the plan the page receives carries the type from the shared parser. No second read of the frontmatter in the admin
- [ ] `components/PlanTypeChip.tsx`: the chip and its explanation in a native `<dialog>` — no dialog library. Three readings: a known type, "type not declared", and an unrecognised word shown as written. Every sentence of the explanation comes from the package's workflow-types module; the component states no document list of its own
- [ ] Wire the chip into the plan header in `components/PlanDetail.tsx`
- [ ] Check the admin's audit tests still describe the tree (`component-reuse-audit`, `cleanup-pins`), and that no existing browser test needs a new mock for the added import

#### Build Phase 2 Verification

- [ ] A1, A2, A3, A4, A10 and A11 pass (`pnpm --filter indusk-admin exec vitest run src/components/PlanDetail.type src/lib/segment-state-render-parity src/lib/lifecycle-render-parity src/components/bars`)
- [ ] The admin type-checks and its audits hold (`pnpm --filter indusk-admin exec vitest run src/__tests__/typecheck src/__tests__/component-reuse-audit src/__tests__/cleanup-pins`)
- [ ] By eye, in the running admin on this repository: this plan's page shows a `bugfix` chip, the chip opens and closes, and the research and ADR segments read skipped

#### Build Phase 2 Context

- [ ] Known Gotchas, the admin entry that names the bars' label maps: add that a plan's type and its explanation come only from the package's `workflow-types` subpath and that a component never restates a document list. An edit in place that shortens the same entry by at least as much as it adds

#### Build Phase 2 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the type chip and the four readings of an absent document
- [ ] `apps/docs/src/reference/admin-ui/component-conventions.md`: the first dialog in the admin is a native `<dialog>`, and why no library

### Build Phase 3: the planner declares it, and this repository does

- [ ] `apps/indusk-mcp/skills/planner.md`: the brief template carries `workflow:`, and the Workflow Types section says every brief declares it, defaulting to `feature`. Resync the installed copy under `.claude/skills/planner/`
- [ ] `apps/indusk-mcp/templates/workflows/`: each template's brief (or, for the spike, research) template carries `workflow:`; the bugfix template's list of documents gains the test plan, and its opening sentence stops saying a bugfix is only a brief and an impl; the refactor template is checked for the same omission
- [ ] Declare the type on every active plan here that lacks one: `plan-premises`, `day-always-on-deploy` and `indusk-release` in their briefs; `user-zero` and `jev-decision-model`, which are research only, in their research documents
- [ ] Declare `workflow: bugfix` on the archived `release-ritual` brief — the one archived plan that gets it, per the brief

#### Build Phase 3 Verification

- [ ] A12, A13, A14 and A16 pass and A17 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/workflow-types-parity src/__tests__/active-plans-declare-workflow src/__tests__/skill-sync-parity`)
- [ ] A15 passes (`pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.workflow`)
- [ ] Both apps' suites pass (`pnpm turbo test --filter=@infinitedusky/indusk-mcp --filter=indusk-admin`)
- [ ] By eye, in the running admin: the archived release-ritual page shows `bugfix`, research and ADR skipped, the test plan missing, and a sentence beside the bar saying a bugfix requires a test plan

#### Build Phase 3 Context

- [ ] Conventions, the entry that begins "Plans live in": a brief declares `workflow:`, and `active-plans-declare-workflow.test.ts` fails this repository's suite when an active plan lacks one. An edit in place that shortens the same entry by at least as much as it adds

#### Build Phase 3 Document

- [ ] `apps/docs/src/reference/skills/plan.md`: every brief declares its type; what each type requires
- [ ] `apps/docs/src/changelog.md`, under the unreleased heading: the admin shows a plan's type; an absent document reads skipped, missing, pending or unknown; the bugfix template now includes the test plan
