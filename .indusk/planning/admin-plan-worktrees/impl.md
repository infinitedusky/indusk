---
title: "Plans in worktrees show their progress"
date: 2026-09-18
status: draft
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Plans in worktrees show their progress

## Goal

A plan worked in its worktree shows its real progress in the admin and from
the MCP plan tools, from any checkout of the project. The assignment of a
plan to a worktree is a record the InDusk worktree command writes, stored in
the repository's shared git directory, checked against git's worktree list on
every read. The admin names the worktree. Every mismatch is shown, never
guessed.

## Scope

### In Scope

- The assignment record and one resolver, in `lib/worktree/plan-worktrees.ts`,
  exported as the `worktree/plan-worktrees` subpath.
- `indusk worktree assign <plan> <path>` and `indusk worktree release <plan>`.
- `indusk worktree create <plan>` in a normal (non-workbench) repository: it
  refuses there today, which is why every dusk worktree was made by hand. It
  runs `git worktree add <dir>/<plan> -b plan/<plan> main` and records the
  assignment. `<dir>` defaults to `../<repo>-worktrees`.
- `list_plans`, `get_plan_status`, `advance_plan` read through the resolver.
- The admin's plan list, plan page and live refresh read through it, including
  the phase-boundary record; the header and sidebar name the worktree; the
  unassigned worktrees and a malformed record are shown.
- The work skill's kickoff and the retrospective's landing step.

### Out of Scope

- **Workbenches.** Plan documents there live at the workbench root, never in
  a code worktree, so the bug does not occur. The resolver is inert in a
  workbench (every plan reads from the plan root, as today), and workbench
  `create` is unchanged. Naming a workbench plan's worktree in the admin is a
  follow-on.
- Plans that exist only in a worktree, never on trunk.
- The promise registry and incidents (project-level, read from trunk).
- Normal-mode `create` running doppler or `post_create`: it prints the next
  step instead.
- Cleaning up the leftover folders in `dusk-worktrees/`.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every row authored red at the CLI, the tool call and HTTP; the tool-call harness; this plan's worktree | — |
| Build Phase 1 | `lib/worktree/plan-worktrees.ts` (record read/write, `resolvePlanCopies`, `livePlanRoot`); `worktree assign` / `release`; normal-mode `create`; subpath export | git's `worktree list --porcelain` and `--git-common-dir` |
| Build Phase 2 | `list_plans` / `get_plan_status` / `advance_plan` through the resolver | `resolvePlanCopies`, `livePlanRoot` |
| Build Phase 3 | The admin through the resolver; worktree chip in header and sidebar; unassigned list; record error block | the subpath from Build Phase 1 |
| Build Phase 4 | Work and retrospective skill steps; the dogfood | the CLI from Build Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | An item checked off in the assigned worktree shows as done on the admin plan page on the next refresh | Test Phase 1 | Build Phase 3 | planned |
| A2 | The plan page names the worktree it reads from | Test Phase 1 | Build Phase 3 | planned |
| A3 | The sidebar row for an assigned plan names its worktree | Test Phase 1 | Build Phase 3 | planned |
| A4 | The active phase shown for an assigned plan is the one opened in the worktree | Test Phase 1 | Build Phase 3 | planned |
| A5 | Asked at trunk, `list_plans`, `get_plan_status` and `advance_plan` report the worktree's state | Test Phase 1 | Build Phase 2 | planned |
| A6 | Asked from inside a worktree, the plan list and states match those asked at trunk | Test Phase 1 | Build Phase 2 | planned |
| A7 | A plan with no assignment reads exactly as today, in the tools and the admin | Test Phase 1 | Test Phase 1 | planned |
| A8 | `indusk worktree create <plan>` in a normal repo creates `plan/<plan>` and the plan reads from it | Test Phase 1 | Build Phase 1 | planned |
| A9 | `indusk worktree assign <plan> <path>` assigns a hand-made worktree and the plan reads from it | Test Phase 1 | Build Phase 1 | planned |
| A10 | A second live assignment for the same plan is refused naming both, and nothing changes | Test Phase 1 | Build Phase 1 | planned |
| A11 | Assigning a path that is not a worktree of this repo, or a plan with no folder, is refused by name | Test Phase 1 | Build Phase 1 | planned |
| A12 | `indusk worktree release <plan>` ends the assignment and the plan reads from trunk | Test Phase 1 | Build Phase 1 | planned |
| A13 | Create, assign, read and release leave `git status` clean in every checkout | Test Phase 1 | Build Phase 1 | planned |
| A14 | An assigned worktree removed without release is reported as gone, and the trunk copy is shown, in the admin and `get_plan_status` | Test Phase 1 | Build Phase 3 | planned |
| A15 | A worktree with no assignment is listed in the admin as unassigned | Test Phase 1 | Build Phase 3 | planned |
| A16 | A malformed record is an error naming the file, in the admin and from the tools; no plan is read from a guessed copy | Test Phase 1 | Build Phase 3 | planned |
| A17 | Two live assignments for one plan in a hand-edited record show an error naming both, never a pick | Test Phase 1 | Build Phase 2 | planned |
| A18 | The work skill's kickoff runs `indusk worktree create <plan>` and the retrospective's landing step runs `indusk worktree release <plan>` between the merge and the removal | Test Phase 1 | Build Phase 4 | planned |
| A19 | This plan's own progress shows, with its worktree named, in the worktree's admin build run against the dusk registry while Build Phase 4 is worked | Build Phase 4 | Build Phase 4 | planned |

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author every row at a boundary — the CLI (`runCli` against the built
`dist/bin/cli.js`), a tool call, or HTTP against `next dev` — so each is red
on its own assertion today.

- [ ] Create this plan's worktree by hand (`git worktree add ../dusk-worktrees/admin-plan-worktrees -b plan/admin-plan-worktrees main`) — normal-mode `create` does not exist until Build Phase 1; the worktree is assigned with `indusk worktree assign` at the end of that phase
- [ ] Fixture `apps/indusk-mcp/src/__tests__/helpers/plan-worktree-fixture.ts`: a temp git repo with a plan folder on trunk and a real `git worktree add -b plan/<name>`, a helper to check an item off in the worktree's impl, and a helper to write the record by hand (for A16, A17). Throws when a precondition cannot be established.
- [ ] Tool-call harness `apps/indusk-mcp/src/__tests__/helpers/tool-call.ts`: a stub server whose `registerTool` captures each handler, so a test calls `list_plans` / `get_plan_status` / `advance_plan` the way a client would
- [ ] Author A8–A13 in `apps/indusk-mcp/src/__tests__/plan-worktrees-cli.test.ts` via `runCli`
- [ ] Author A5, A6, A7 (tools half), A14 (tools half), A16 (tools half), A17 in `apps/indusk-mcp/src/__tests__/plan-worktrees-tools.test.ts`
- [ ] Author A1–A4, A7 (admin half), A14 (admin half), A15, A16 (admin half) in `apps/indusk-admin/src/__tests__/http-plan-worktrees.test.ts`, same shape as `http-project-promises.test.ts`
- [ ] Author A18 in `apps/indusk-mcp/src/__tests__/plan-worktrees-skills.test.ts`: reads the package-owned `skills/work.md` and `skills/retrospective.md`
- [ ] Run each file and read each failure: every red row fails on its own assertion, not on a missing import

#### Deferred to Build Phase 4

- **A19** — a manual smoke with no code to author: it needs the Build Phase 3 admin running against the dusk registry while this plan is assigned, which exists only once Build Phases 1–3 have landed in the worktree. Procedure: from the worktree, `pnpm --filter @infinitedusky/indusk-admin dev` with the default `INDUSK_HOME`, open `/p/dusk/plan/admin-plan-worktrees`, confirm the worktree is named and the Build Phase 4 checkoffs appear on refresh; screenshot recorded in the retrospective. The landing half — the plan reads from trunk once released — is the retrospective's own check.

#### Regression Guards

- **A7** — unassigned plans must read exactly as they do today; it passes when written and has no red window by design. It guards every later phase against moving a plan that has no assignment.

#### Test Phase 1 Verification

- [ ] A1–A18 authored; A7 passes; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts src/__tests__/plan-worktrees-tools.test.ts src/__tests__/plan-worktrees-skills.test.ts` and `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-plan-worktrees.test.ts`)
- [ ] The A19 deferral reviewed: it names a procedure that can run at Build Phase 4 and asserts what the test plan claims

#### Test Phase 1 Context

- [ ] Add to Known Gotchas (tests): tests that need a plan in a worktree use `helpers/plan-worktree-fixture.ts` (a real `git worktree add`; a one-checkout fixture cannot show this bug), and MCP tools are called through `helpers/tool-call.ts`

#### Test Phase 1 Document

- [ ] Changelog Unreleased entry opened in `apps/docs/src/changelog.md` ("Fixed — plans worked in a worktree show their progress"), filled in as phases land

### Build Phase 1: The record, the resolver, the commands

- [ ] `apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts`:
  ```typescript
  // <git-common-dir>/indusk-plan-worktrees.json
  interface Assignment { plan: string; path: string; branch: string; at: string }
  type RecordRead =
    | { ok: true; assignments: Assignment[] }
    | { ok: false; file: string; problem: string };
  type PlanCopy =
    | { plan: string; root: string; source: "trunk" }
    | { plan: string; root: string; source: "worktree"; worktree: { name: string; path: string; branch: string } }
    | { plan: string; root: string; source: "trunk"; problem: "gone" | "doubled"; detail: string };
  function readAssignments(anyCheckout: string): RecordRead;
  function assignPlan(anyCheckout: string, plan: string, worktreePath: string): Assignment; // throws naming the refusal
  function releasePlan(anyCheckout: string, plan: string): void;
  function resolvePlanCopies(anyCheckout: string): {
    projectRoot: string;           // the main worktree, from any checkout
    copies: Map<string, PlanCopy>; // one per trunk plan folder
    unassigned: { path: string; branch: string }[];
    record: RecordRead;
  };
  function livePlanRoot(anyCheckout: string, plan: string): PlanCopy;
  ```
  Paths realpath-normalized; plan names segment-guarded (`lib/path-segment.ts`); git calls through `lib/git.ts`; the record written atomically (temp file + rename); in a workbench (`isWorkbench`) every plan resolves to the plan root with no worktree.
- [ ] `indusk worktree assign <plan> <path>` and `indusk worktree release <plan>` in `src/bin/commands/worktree.ts`, wired in `src/bin/cli.ts`; refusals exit non-zero naming the plan, the path or both existing worktrees
- [ ] Normal-mode `indusk worktree create <plan>`: when the project is not a workbench, refuse unless `.indusk/planning/<plan>/` exists on trunk, then `git worktree add <dir>/<plan> -b plan/<plan> main`, record the assignment, and print the path and "run `pnpm install` there"; workbench `create` unchanged
- [ ] Export `./worktree/plan-worktrees` in `apps/indusk-mcp/package.json`
- [ ] Assign this plan's own worktree with the built CLI, verbatim: `node apps/indusk-mcp/dist/bin/cli.js worktree assign admin-plan-worktrees ../dusk-worktrees/admin-plan-worktrees`

#### Build Phase 1 Verification

- [ ] A8, A9, A10, A11, A12, A13 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts`)
- [ ] Typecheck and lint clean (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit`, `pnpm check`)

#### Build Phase 1 Context

- [ ] Add to Conventions: a plan's live copy is resolved by `lib/worktree/plan-worktrees.ts` from a record in the shared git directory, written only by `indusk worktree create/assign/release`, checked against `git worktree list` on every read; never by matching names; inert in a workbench

#### Build Phase 1 Document

- [ ] New `apps/docs/src/reference/cli/worktree.md`: `create` (normal and workbench), `assign`, `release`, the record's location and every refusal; sidebar entry

### Build Phase 2: The MCP tools read the live copy

- [ ] `list_plans`, `get_plan_status`, `advance_plan` in `src/tools/plan-tools.ts` resolve each plan's folder through `resolvePlanCopies` / `livePlanRoot`, rooted at the main worktree whatever the server's cwd; each result carries `worktree` (name, path, branch) when read from one, and `copyProblem` when the resolver reports `gone` or `doubled`
- [ ] A malformed record returns an error result naming the file from each of the three tools, rather than a plan list read from trunk

#### Build Phase 2 Verification

- [ ] A5, A6, A17 pass; A7 still passes; the tools halves of A14 and A16 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-tools.test.ts`)
- [ ] Full mcp suite green (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`)

#### Build Phase 2 Context

- [ ] Update the Conventions entry from Build Phase 1: the three plan tools read through the resolver and report `worktree` / `copyProblem`

#### Build Phase 2 Document

- [ ] Update `apps/docs/src/reference/tools/indusk-mcp.md`: the three tools' `worktree` and `copyProblem` fields and the malformed-record error

### Build Phase 3: The admin reads the live copy and names it

- [ ] `apps/indusk-admin/src/lib/planning-reader.ts`: `readActivePlans` reads each plan folder and its phase-boundary record from its live root (through the subpath); `Plan` gains `worktree?` and `copyProblem?`; the record read is exposed for the layout
- [ ] Worktree chip in `PlanDetail`'s header and in the `PlanList` row (`data-testid="plan-worktree"`), naming the worktree folder and branch; `copyProblem` rendered as a warning line ("assigned worktree `x` no longer exists — showing the trunk copy"; "two live worktrees assigned: `a`, `b`")
- [ ] Unassigned worktrees listed under the sidebar ("Unassigned worktrees"), each with its branch
- [ ] A malformed record renders an error block in the project layout naming the file; no plan list renders beneath as if it were right
- [ ] Browser tests that render these components mock `@/lib/planning-reader` exports they import (the gotcha from day-promises)

#### Build Phase 3 Verification

- [ ] A1, A2, A3, A4, A14, A15, A16 pass; A7 still passes (`pnpm --filter @infinitedusky/indusk-admin exec vitest run src/__tests__/http-plan-worktrees.test.ts`)
- [ ] Full admin suite green, including `typecheck.test.ts` (`pnpm turbo test --filter=@infinitedusky/indusk-admin`)

#### Build Phase 3 Context

- [ ] Update the admin Known Gotchas entry: plan folders and boundary records are read from each plan's live root through `worktree/plan-worktrees`; the header and sidebar name the worktree

#### Build Phase 3 Document

- [ ] Update `apps/docs/src/reference/admin-ui/overview.md`: the worktree chip, the gone/doubled warnings, the unassigned list, the record error block

### Build Phase 4: The lifecycle uses it

- [ ] `apps/indusk-mcp/skills/work.md` Worktree Kickoff: create the plan's worktree with `indusk worktree create <plan>`; for a worktree made another way, `indusk worktree assign <plan> <path>`
- [ ] `apps/indusk-mcp/skills/retrospective.md` Step 10: after the merge, `indusk worktree release <plan>`, then remove the worktree and delete the branch
- [ ] `apps/indusk-mcp/skills/planner.md`: the kickoff item's wording names `indusk worktree create <plan>`
- [ ] Resync the installed copies in `.claude/skills/` (the `skill-sync-parity` test pins byte-equality)
- [ ] Run the A19 smoke and record the screenshot path

#### Build Phase 4 Verification

- [ ] A18 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-skills.test.ts src/__tests__/skill-sync-parity.test.ts`)
- [ ] A19: the smoke run as written in the Test Phase 1 register, screenshot saved
- [ ] Root suite green (`pnpm test`)

#### Build Phase 4 Context

- [ ] Update the worktree-per-plan Conventions entry: the kickoff creates through `indusk worktree create <plan>`, which records the assignment; the retrospective releases it between the merge and the removal

#### Build Phase 4 Document

- [ ] Update `apps/docs/src/guide/worktree-setup.md` and `apps/docs/src/guide/plan-lifecycle.md`: a plan's worktree is assigned at the kickoff and released at landing; the admin reads the live copy

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts` | New: record, resolver |
| `apps/indusk-mcp/src/bin/commands/worktree.ts`, `src/bin/cli.ts` | `assign`, `release`, normal-mode `create` |
| `apps/indusk-mcp/package.json` | `./worktree/plan-worktrees` export |
| `apps/indusk-mcp/src/tools/plan-tools.ts` | Three tools through the resolver |
| `apps/indusk-admin/src/lib/planning-reader.ts` | Live roots, `worktree`, `copyProblem` |
| `apps/indusk-admin/src/components/PlanDetail.tsx`, `PlanList.tsx`, `app/p/[project]/layout.tsx` | Chip, warnings, unassigned list, error block |
| `apps/indusk-mcp/skills/work.md`, `retrospective.md`, `planner.md` + `.claude/skills/` | Kickoff and landing |
| Tests and helpers named above | New |
| `apps/docs/src/reference/cli/worktree.md` + guide/reference updates | Docs |

## Dependencies

- None. day-promises is closed and landed on main.

## Notes

- The record lives outside the working tree on purpose: the paths in it are
  true on one machine only.
- `indusk worktree create` in normal mode takes the plan name as the slug, so
  the folder is `<dir>/<plan>` and the branch `plan/<plan>`. The resolver
  never reads either name to decide anything; they are for people.
