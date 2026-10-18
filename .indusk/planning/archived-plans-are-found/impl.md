---
title: "Archived plans are found"
date: 2026-10-18
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "b584cda10d74409a5adceafbe0c13bdb650378e3d7bcfaca5c73d779ed789a29"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-18T16:55:06.928Z"
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
| T1 | A plan's folder is found in the planning folder, or in the archive when it is only there, and is reported missing when it is in neither | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/promises/plan-folder.test.ts |
| T2 | The impl of a plan that has been archived is found by name | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/impl-parser-archive.test.ts |
| T3 | A plan archived on its own branch can be accepted, and the acceptance is recorded on its impl | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T4 | An accepted plan that has been archived lands | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T5 | The tests a plan runs at landing are listed for a plan that has been archived | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T6 | A plan whose folder is in both the planning folder and the archive is read from the planning folder | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/active-first | apps/indusk-mcp/src/lib/promises/plan-folder.test.ts |
| T7 | The amendments of a plan archived after its approval are listed against the brief it was approved with, and can be re-approved | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-plan-is-found-in-the-archive/the-brief-at-approval | apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts |
| T8 | A name that is not a plan's folder (the archive folder itself, a file such as `master.md`, a name with path separators or `..`) is not found as a plan by any command | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/promises/plan-folder.test.ts |
| T9 | Only one module says where a plan's folder is, and the impl lookup, the plan-copy record, the workbench plan and its code file all ask it | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/__tests__/plan-folder-single-definition.test.ts |
| T10 | An archived workbench plan's code file is found, so it can be accepted, landed and re-approved | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-is-found-in-the-archive/one-lookup | apps/indusk-mcp/src/lib/worktree/roots.test.ts |
| T11 | The amendments of an archived plan are read against the registry at the project's root, not one folder too shallow | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-plan-is-found-in-the-archive/the-brief-at-approval | apps/indusk-mcp/src/lib/plans/amendments.test.ts |

## Checklist

### Test Phase 1: Write the failing tests against today's commands

**Tier**: med — the work step's default

This phase writes the tests that show today's failures: an archived plan whose impl is not found, that cannot be accepted, landed or listed for landing, and whose amendments cannot be read. It records the two tests whose subject is the new lookup function, with their bodies, so the build phase starts with every test written.

- [x] Create or confirm this plan's worktree, so the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create archived-plans-are-found` from the trunk (the worktree from `indusk plans start` exists; this confirms the assignment).

  </details>
- [x] Write the test that an archived plan's impl is found by name, failing today.
  <details><summary>Technical</summary>

  T2, `apps/indusk-mcp/src/lib/impl-parser-archive.test.ts`: a temp project with only `.indusk/planning/archive/p/impl.md`; `resolveImplPath(root, "p")` returns that path. Red today (returns null). Tokens: `clause: a-plan-is-found-in-the-archive/one-lookup`, `promise: a-plan-is-found-in-the-archive`.

  </details>
- [x] Write the tests that an archived plan can be accepted, landed, listed for landing and re-approved, failing today, in the system tier.
  <details><summary>Technical</summary>

  T3, T4, T5, T7 in `apps/indusk-mcp/src/__tests__/archived-plan-found.test.ts`, on the plan-in-a-worktree fixture (`helpers/plan-worktree-fixture.ts`; read how `plans-land.test.ts` and `amendments.test.ts` build an approved plan): approve the plan, then move its folder to `archive/` on its branch and commit; T3 `acceptPlan` records `accepted:` on the archived impl; T4 `landPlan` lands it; T5 `readsFor(root, plan)` (from `lib/plans/plan-tests.ts`) returns its rows; T7 an edit to the archived brief is listed by `amendmentsOf` against the approved brief and `reapprove` succeeds. Add the file to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts` (it starts git). Tokens for each clause and the promise.

  </details>
  - Note: T5 and T7 are written and red (T5 "no impl.md for seat-holds", T7 "the brief at … approval commit … cannot be read"). T3 (accept) and T4 (land) PASS today in this fixture: `worktreeCopy` in `plan-worktrees.ts` already falls back to `archive/<plan>` for a plan with a live worktree, so `planBranch` finds it. They are regression guards (below), passing from this phase: the brief's claim that `accept` could not read an archived plan was wrong, recorded 2026-10-18.

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

#### Regression Guards

- **T3** — accepting an archived plan with a live worktree already works (`worktreeCopy` falls back to `archive/<plan>`); the test keeps it working once the lookup moves into one function.
- **T4** — landing an accepted archived plan already works for the same reason; same purpose.

#### Test Phase 1 Verification

- [x] The failing tests exist and each fails on its own assertion, not on a missing file.
  <details><summary>Technical</summary>

  T2 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/impl-parser-archive.test.ts`; T3, T4, T5, T7 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/archived-plan-found.test.ts` (build first).

  </details>
- [x] The deferred test body has been read and judged.
  <details><summary>Technical</summary>

  The T1/T6 body compiles at Build Phase 1 and asserts what its rows claim.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new; the rule lands with the build phase.
  <details><summary>Technical</summary>

  Confirm no context file needs a line yet.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 1.

  </details>

### Build Phase 1: One lookup finds a plan, active or archived

**Tier**: med — the work step's default

This phase adds the one function that says where a plan's folder is and makes every lookup ask it: the impl lookup, the plan-copy record that approval, acceptance and landing read, and the read of the approved brief that re-approval compares against. Once it closes, an archived plan is accepted, re-approved, tested at landing and landed where it lies.

- [x] Add the function that says where a plan's folder is: the planning folder first, else the archive.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/plan-folder.ts` `planFolder(projectRoot, plan): string | null`, from `getPlanningDir` (`lib/config.ts`); `promise: a-plan-is-found-in-the-archive` at the site.

  </details>
- [x] Make the impl lookup and the plan-copy record ask that function.
  <details><summary>Technical</summary>

  `resolveImplPath` (`lib/impl-parser.ts`, and `impl-parser-core.ts` if it has its own copy) and the trunk and worktree copies in `lib/worktree/plan-worktrees.ts` (`dir`); grep every `join(getPlanningDir(…), plan)` and `".indusk", "planning", plan` under `src/lib` and `src/bin` and route plan-folder lookups through `planFolder` (listing all plans stays as it is).

  </details>
- [x] Make re-approval and the amendments list read the approved brief from the path it had at the approval commit.
  <details><summary>Technical</summary>

  `lib/plans/approved-brief.ts` / `amendments.ts` / `reapprove.ts`: when `git show <approval>:<current brief path>` finds nothing, read `<approval>:.indusk/planning/<plan>/brief.md` (the path before archiving).

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.
  - Reviewed `plan-folder.ts`, `impl-parser.ts`, `plan-worktrees.ts`, `workbench-plan.ts` and `amendments.ts`: each does one job and reads plainly; nothing to add. The pre-archive brief read in `amendments.ts` stays inline (one use).

#### Build Phase 1 Verification

- [x] An archived plan is found, accepted, landed, listed for landing and re-approved, and a plan in both places is read from the planning folder.
  <details><summary>Technical</summary>

  T1, T2, T6: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/plan-folder.test.ts src/lib/impl-parser-archive.test.ts`; T3, T4, T5, T7: the system-tier file after a build; then `indusk plans tests archived-plans-are-found --phase "Build Phase 1"`.

  </details>

#### Build Phase 1 Context

- [x] Add to the package's context file that a plan's folder has one lookup, active first, then the archive.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: `planFolder` (`lib/plans/plan-folder.ts`) with T1/T6 as its guard (shorten a neighbour; the file is over its budget).

  </details>

#### Build Phase 1 Document

- [x] Say on the plans command's reference page that a plan is found in the archive, and add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`; the changelog's unreleased section.

  </details>

### Build Phase 2: Audit fix — the one lookup that already existed

**Tier**: med — the work step's default

The cold audit found that Build Phase 1 wrote a second function for where a plan's folder is, when the promise code already had one that also refuses names that are not a plan folder: the archive folder itself, a file, a name with path separators. Our copy dropped that check, and a few places still build a plan's path by hand, so an archived workbench plan is still refused. This phase deletes the copy, routes every lookup through the existing one, and tests the root correction the re-approval fix made. Once it closes there is one lookup, with its safety check, used everywhere a single plan is found.

- [x] Remove the new folder lookup and make every place that used it ask the existing one instead.
  <details><summary>Technical</summary>

  Found by the audit (2026-10-18): `lib/promises/plan-folder.ts` (`planFolderStatus`, `planFolderPath`) already answered "where is this plan's folder" for the contract, confirm, check and write code, refusing `archive`, files and unusable segments (`isUsableSegment`); Build Phase 1 added `lib/plans/plan-folder.ts` `planFolder` without that check. Add to the existing module a `findPlanFolder(planRoot, plan): string | null` built on `planFolderStatus` (active or archived → its path; anything else → null); delete `lib/plans/plan-folder.ts` and its test (moving T1/T6's cases to the existing module's test file); repoint `impl-parser.ts`, `plans/workbench-plan.ts`, `worktree/plan-worktrees.ts`. T8, T9.

  </details>
- [x] Route the remaining hand-built plan paths through the lookup, so an archived workbench plan's code file is found.
  <details><summary>Technical</summary>

  `readPlanCode` in `lib/worktree/roots.ts:121` (builds `.indusk/planning/<plan>/code.json`), the trunk copy in `plan-worktrees.ts`, `papers publish` and the plan MCP tools the audit names: grep `src/lib` and `src/bin` for `"planning", plan` / `planning/${` single-plan joins and route each through `findPlanFolder` (listing all plans stays on `planFolders`). T10.

  </details>
- [x] Test the correction that re-approval reads an archived plan's registry from the project's root.
  <details><summary>Technical</summary>

  `amendments.ts:111` computes the project root from the plan folder; for an archived plan Build Phase 1 corrected it from one level too shallow, and the audit infers T7 still passes with the correction reverted. T11 in `lib/plans/amendments.test.ts`: an archived plan whose brief lists a promise that exists only in the root registry reports it as known (fails with the shallow root).

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.
  - Reviewed `promises/plan-folder.ts` (`findPlanFolder`), `impl-parser.ts`, `workbench-plan.ts`, `plan-worktrees.ts`, `roots.ts`, `papers/publish.ts`, `plan-tools.ts`: each change is a one-line route through the lookup; nothing to add. T11 was authored with the tests and fails (`expected [] to include 'promise held-seat'`) when the archived-root correction in `amendments.ts` is reverted, and passes with it.

#### Build Phase 2 Verification

- [x] One lookup finds a plan, refuses what is not a plan folder, finds an archived workbench plan's code file, and re-approval reads the right registry.
  <details><summary>Technical</summary>

  T8–T11 and T1–T7 still passing: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/plan-folder.test.ts src/__tests__/plan-folder-single-definition.test.ts src/lib/worktree/roots.test.ts src/lib/plans/amendments.test.ts src/lib/impl-parser-archive.test.ts`; the system-tier file after a build; then `indusk plans tests archived-plans-are-found --phase "Build Phase 2"`.

  </details>

#### Build Phase 2 Context

- [x] Correct the package context line to name the existing lookup as the one home for a plan's folder.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: the line Build Phase 1 added names `lib/promises/plan-folder.ts` (`findPlanFolder`, `planFolderStatus`), guarded by T9.

  </details>

#### Build Phase 2 Document

- [x] Make the plans reference page and changelog line name what was actually done.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` and the changelog's unreleased line: one lookup, which also refuses names that are not a plan folder; workbench plans included.

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
