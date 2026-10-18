---
title: "Archived plans are found"
date: 2026-10-18
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "b584cda10d74409a5adceafbe0c13bdb650378e3d7bcfaca5c73d779ed789a29"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-18T16:47:02.759Z"
---

# Archived plans are found

## Goal

Every command that acts on a plan finds it whether its folder is in `.indusk/planning/` or `.indusk/planning/archive/`, through one lookup, so a plan the retrospective archived can be accepted, re-approved, tested at landing and landed without being moved. The promise and its clauses are in [brief.md](brief.md); the assertions in [test-plan.md](test-plan.md).

## Scope

### In Scope
- One function for a plan's folder, asked by `resolveImplPath` and the plan-copy record (`lib/worktree/plan-worktrees.ts`).
- Re-approval and the amendments list reading the approved brief from its path at the approval commit.

### Out of Scope
- When the retrospective archives; phase-level worktrees (`run-the-graph`).

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | A plan's folder is found in the planning folder, or in the archive when it is only there, and is reported missing when it is in neither | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/plans/plan-folder.test.ts |
| T2 | The impl of a plan that has been archived is found by name | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/impl-parser-archive.test.ts |
| T3 | A plan archived on its own branch can be accepted, and the acceptance is recorded on its impl | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T4 | An accepted plan that has been archived lands | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T5 | The tests a plan runs at landing are listed for a plan that has been archived | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T6 | A plan whose folder is in both the planning folder and the archive is read from the planning folder | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/active-first | apps/indusk-mcp/src/lib/plans/plan-folder.test.ts |
| T7 | The amendments of a plan archived after its approval are listed against the brief it was approved with, and can be re-approved | Test Phase 1 | Build Phase 1 | planned | unit | clause: a-plan-is-found-in-the-archive/the-brief-at-approval | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |

## Checklist

### Test Phase 1: Write the failing tests against today's commands

**Tier**: med — the work step's default

This phase writes the tests that show today's failures: an archived plan whose impl is not found, that cannot be accepted, landed or listed for landing, and whose amendments cannot be read. It records the two tests whose subject is the new lookup function, with their bodies, so the build phase starts with every test written.

- [ ] Create or confirm this plan's worktree, so the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create archived-plans-are-found` from the trunk (the worktree from `indusk plans start` exists; this confirms the assignment).

  </details>
- [ ] Write the test that an archived plan's impl is found by name, failing today.
  <details><summary>Technical</summary>

  T2, `apps/indusk-mcp/src/lib/impl-parser-archive.test.ts`: a temp project with only `.indusk/planning/archive/p/impl.md`; `resolveImplPath(root, "p")` returns that path. Red today (returns null). Tokens: `clause: a-plan-is-found-in-the-archive/one-lookup`, `promise: a-plan-is-found-in-the-archive`.

  </details>
- [ ] Write the tests that an archived plan can be accepted, landed, listed for landing and re-approved, failing today, in the system tier.
  <details><summary>Technical</summary>

  T3, T4, T5, T7 in `apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts`, on the plan-in-a-worktree fixture (`helpers/plan-worktree-fixture.ts`; read how `plans-land.test.ts` and `amendments.test.ts` build an approved plan): approve the plan, then move its folder to `archive/` on its branch and commit; T3 `acceptPlan` records `accepted:` on the archived impl; T4 `landPlan` lands it; T5 `readsFor(root, plan)` (from `lib/plans/plan-tests.ts`) returns its rows; T7 an edit to the archived brief is listed by `amendmentsOf` against the approved brief and `reapprove` succeeds. Add the file to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts` (it starts git). Tokens for each clause and the promise.

  </details>

#### Deferred to Build Phase 1

- **T1, T6** — their subject is `planFolder` in `lib/plans/plan-folder.ts`, which Build Phase 1 introduces. Body reviewed:

  ```typescript
  // clause: a-plan-is-found-in-the-archive/one-lookup
  // clause: a-plan-is-found-in-the-archive/active-first
  // promise: a-plan-is-found-in-the-archive
  import { mkdirSync, mkdtempSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { expect, it } from "vitest";
  import { planFolder } from "./plan-folder.js";
  const project = () => mkdtempSync(join(tmpdir(), "plan-folder-"));
  it("T1 the planning folder, else the archive, else none", () => {
    const root = project();
    mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
    mkdirSync(join(root, ".indusk/planning/archive/b"), { recursive: true });
    expect(planFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
    expect(planFolder(root, "b")).toBe(join(root, ".indusk/planning/archive/b"));
    expect(planFolder(root, "c")).toBeNull();
  });
  it("T6 a plan in both places is read from the planning folder", () => {
    const root = project();
    mkdirSync(join(root, ".indusk/planning/a"), { recursive: true });
    mkdirSync(join(root, ".indusk/planning/archive/a"), { recursive: true });
    expect(planFolder(root, "a")).toBe(join(root, ".indusk/planning/a"));
  });
  ```

#### Test Phase 1 Verification

- [ ] The failing tests exist and each fails on its own assertion, not on a missing file.
  <details><summary>Technical</summary>

  T2 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/impl-parser-archive.test.ts`; T3, T4, T5, T7 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/archived-plan-found.test.ts` (build first).

  </details>
- [ ] The deferred test body has been read and judged.
  <details><summary>Technical</summary>

  The T1/T6 body compiles at Build Phase 1 and asserts what its rows claim.

  </details>

#### Test Phase 1 Context

- [ ] Record nothing new; the rule lands with the build phase.
  <details><summary>Technical</summary>

  Confirm no context file needs a line yet.

  </details>

#### Test Phase 1 Document

- [ ] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 1.

  </details>

### Build Phase 1: One lookup finds a plan, active or archived

**Tier**: med — the work step's default

This phase adds the one function that says where a plan's folder is and makes every lookup ask it: the impl lookup, the plan-copy record that approval, acceptance and landing read, and the read of the approved brief that re-approval compares against. Once it closes, an archived plan is accepted, re-approved, tested at landing and landed where it lies.

- [ ] Add the function that says where a plan's folder is: the planning folder first, else the archive.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/plan-folder.ts` `planFolder(projectRoot, plan): string | null`, from `getPlanningDir` (`lib/config.ts`); `promise: a-plan-is-found-in-the-archive` at the site.

  </details>
- [ ] Make the impl lookup and the plan-copy record ask that function.
  <details><summary>Technical</summary>

  `resolveImplPath` (`lib/impl-parser.ts`, and `impl-parser-core.ts` if it has its own copy) and the trunk and worktree copies in `lib/worktree/plan-worktrees.ts` (`dir`); grep every `join(getPlanningDir(…), plan)` and `".indusk", "planning", plan` under `src/lib` and `src/bin` and route plan-folder lookups through `planFolder` (listing all plans stays as it is).

  </details>
- [ ] Make re-approval and the amendments list read the approved brief from the path it had at the approval commit.
  <details><summary>Technical</summary>

  `lib/plans/approved-brief.ts` / `amendments.ts` / `reapprove.ts`: when `git show <approval>:<current brief path>` finds nothing, read `<approval>:.indusk/planning/<plan>/brief.md` (the path before archiving).

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 1 Verification

- [ ] An archived plan is found, accepted, landed, listed for landing and re-approved, and a plan in both places is read from the planning folder.
  <details><summary>Technical</summary>

  T1, T2, T6: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/plan-folder.test.ts src/lib/impl-parser-archive.test.ts`; T3, T4, T5, T7: the system-tier file after a build; then `indusk plans tests archived-plans-are-found --phase "Build Phase 1"`.

  </details>

#### Build Phase 1 Context

- [ ] Add to the package's context file that a plan's folder has one lookup, active first, then the archive.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: `planFolder` (`lib/plans/plan-folder.ts`) with T1/T6 as its guard (shorten a neighbour; the file is over its budget).

  </details>

#### Build Phase 1 Document

- [ ] Say on the plans command's reference page that a plan is found in the archive, and add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`; the changelog's unreleased section.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/plan-folder.ts` | new: the one lookup |
| `apps/indusk-mcp/src/lib/impl-parser.ts`, `lib/worktree/plan-worktrees.ts` | ask the lookup |
| `apps/indusk-mcp/src/lib/plans/{approved-brief,amendments,reapprove}.ts` | the approved brief's path at the approval commit |
| `apps/indusk-mcp/src/**/*.test.ts`, `vitest.tiers.ts` | new tests |
| `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/reference/cli/plans.md`, `changelog.md` | context and docs |

## Dependencies

- None.

## Notes

- No ADR: a bugfix, one lookup, no alternative worth recording beyond the brief's.
