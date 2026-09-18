---
title: "Plans in worktrees show their progress"
date: 2026-09-18
status: in-progress
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
| A1 | An item checked off in the assigned worktree shows as done on the admin plan page on the next refresh | Test Phase 1 | Build Phase 3 | passing |
| A2 | The plan page names the worktree it reads from | Test Phase 1 | Build Phase 3 | passing |
| A3 | The sidebar row for an assigned plan names its worktree | Test Phase 1 | Build Phase 3 | passing |
| A4 | The active phase shown for an assigned plan is the one opened in the worktree | Test Phase 1 | Build Phase 3 | passing |
| A5 | Asked at trunk, `list_plans`, `get_plan_status` and `advance_plan` report the worktree's state | Test Phase 1 | Build Phase 2 | passing |
| A6 | Asked from inside a worktree, the plan list and states match those asked at trunk | Test Phase 1 | Build Phase 2 | passing |
| A7 | A plan with no assignment reads exactly as today, in the tools and the admin | Test Phase 1 | Test Phase 1 | passing |
| A8 | `indusk worktree create <plan>` in a normal repo creates `plan/<plan>` and the plan reads from it | Test Phase 1 | Build Phase 2 | passing |
| A9 | `indusk worktree assign <plan> <path>` assigns a hand-made worktree and the plan reads from it | Test Phase 1 | Build Phase 2 | passing |
| A10 | A second live assignment for the same plan is refused naming both, and nothing changes | Test Phase 1 | Build Phase 1 | passing |
| A11 | Assigning a path that is not a worktree of this repo, or a plan with no folder, is refused by name | Test Phase 1 | Build Phase 1 | passing |
| A12 | `indusk worktree release <plan>` ends the assignment and the plan reads from trunk | Test Phase 1 | Build Phase 2 | passing |
| A13 | Create, assign, read and release leave `git status` clean in every checkout | Test Phase 1 | Build Phase 1 | passing |
| A14 | An assigned worktree removed without release is reported as gone, and the trunk copy is shown, in the admin and `get_plan_status` | Test Phase 1 | Build Phase 3 | passing |
| A15 | A worktree with no assignment is listed in the admin as unassigned | Test Phase 1 | Build Phase 3 | passing |
| A16 | A malformed record is an error naming the file, in the admin and from the tools; no plan is read from a guessed copy | Test Phase 1 | Build Phase 3 | passing |
| A17 | Two live assignments for one plan in a hand-edited record show an error naming both, never a pick | Test Phase 1 | Build Phase 2 | passing |
| A18 | The work skill's kickoff runs `indusk worktree create <plan>` and the retrospective's landing step runs `indusk worktree release <plan>` between the merge and the removal | Test Phase 1 | Build Phase 4 | passing |
| A19 | This plan's own progress shows, with its worktree named, in the worktree's admin build run against the dusk registry while Build Phase 4 is worked | Build Phase 4 | Build Phase 4 | passing |
| A20 | A project nested inside a larger repository reads its own plans, not the enclosing repository's | Build Phase 4 | Build Phase 4 | passing |
| A21 | With the plan archived on its branch (retrospective Step 9 moved its folder to `archive/` in the assigned worktree, before the Step 10 release), `list_plans` and `get_plan_status` asked at the trunk answer — the plan reported as archived in its worktree — instead of throwing, and the admin's project and plan pages return 200 showing it archived in the worktree | Build Phase 5 | Build Phase 5 | passing |
| A22 | With the plan's folder gone from the assigned worktree (neither active nor archived there), the tools and the admin report "plan folder missing in worktree `<path>`" and show the trunk copy, and nothing throws | Build Phase 5 | Build Phase 5 | passing |
| A23 | Twelve `indusk worktree assign` runs started at once, for twelve plans and twelve worktrees, leave all twelve assignments in the record | Build Phase 5 | Build Phase 5 | passing |
| A24 | `indusk worktree create <plan>` where `<project>-worktrees/<plan>` exists as a plain folder (what a removed worktree leaves behind) refuses naming it as not a worktree and saying to remove it, and never advises `indusk worktree assign`, which would refuse it | Build Phase 5 | Build Phase 5 | passing |
| A25 | `indusk worktree create <plan>` run while the trunk is checked out on a branch outside `worktree.trunk_guard.branches` (default `main`, `master`) refuses naming that branch, instead of forking `plan/<plan>` from it | Build Phase 5 | Build Phase 5 | passing |
| A26 | `git worktree list --porcelain` has one parser under `src/lib` (`parseWorktreeList` in `lib/git.ts`), read by both the plan resolver and `detectTreeContext`, which still classifies trunk vs worktree as before | Build Phase 6 | Build Phase 6 | planned |
| A27 | The "where was this plan read from" report — `worktree`, `archivedInWorktree`, `copyProblem` — is derived in one place (`copySource` in `plan-worktrees.ts`) and the plan tools and the admin both use it; neither maps a copy by hand | Build Phase 6 | Build Phase 6 | planned |
| A28 | The trunk-branch list is read by `lib/config.ts` (`getTrunkBranches`, default in the reader like `getSweepTtlMinutes`); nothing under `src/lib/worktree/` parses `.indusk/config.json` itself, and A25 still holds | Build Phase 6 | Build Phase 6 | planned |
| A29 | The record — its file, format, parse, lock and write — lives in one module (`plan-worktree-record.ts`) and nothing else under `src/lib` reads or writes `indusk-plan-worktrees.json`; A1–A25 pass unchanged after the split | Build Phase 6 | Build Phase 6 | planned |

**Moved during Build Phase 1 (2026-09-18):** A8, A9 and A12 pass at Build Phase 2, not 1. Each asserts that "the plan reads from" a copy, and it asks the MCP plan tool, which learns to read the assignment in Build Phase 2; the impl sequenced them one phase early. A12 was also strengthened: it now checks the worktree is read *while assigned* before checking the trunk is read after release, because "trunk after release" alone is what a reader that ignores assignments shows, and it had passed that way. The commands' own refusals and the clean-tree row (A10, A11, A13) pass at Build Phase 1 as planned.

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author every row at a boundary — the CLI (`runCli` against the built
`dist/bin/cli.js`), a tool call, or HTTP against `next dev` — so each is red
on its own assertion today.

- [x] Create this plan's worktree by hand (`git worktree add ../dusk-worktrees/admin-plan-worktrees -b plan/admin-plan-worktrees main`) — normal-mode `create` does not exist until Build Phase 1; the worktree is assigned with `indusk worktree assign` at the end of that phase
- [x] Fixture `apps/indusk-mcp/src/__tests__/helpers/plan-worktree-fixture.ts`: a temp git repo with a plan folder on trunk and a real `git worktree add -b plan/<name>`, a helper to check an item off in the worktree's impl, and a helper to write the record by hand (for A16, A17). Throws when a precondition cannot be established.
- [x] Tool-call harness `apps/indusk-mcp/src/__tests__/helpers/tool-call.ts`: a stub server whose `registerTool` captures each handler, so a test calls `list_plans` / `get_plan_status` / `advance_plan` the way a client would
- [x] Author A8–A13 in `apps/indusk-mcp/src/__tests__/plan-worktrees-cli.test.ts` via `runCli`
- [x] Author A5, A6, A7 (tools half), A14 (tools half), A16 (tools half), A17 in `apps/indusk-mcp/src/__tests__/plan-worktrees-tools.test.ts`
- [x] Author A1–A4, A7 (admin half), A14 (admin half), A15, A16 (admin half) in `apps/indusk-admin/src/__tests__/http-plan-worktrees.test.ts`, same shape as `http-project-promises.test.ts`
- [x] Author A18 in `apps/indusk-mcp/src/__tests__/plan-worktrees-skills.test.ts`: reads the package-owned `skills/work.md` and `skills/retrospective.md`
- [x] Run each file and read each failure: every red row fails on its own assertion, not on a missing import
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Deferred to Build Phase 4

- **A19** — a manual smoke with no code to author: it needs the Build Phase 3 admin running against the dusk registry while this plan is assigned, which exists only once Build Phases 1–3 have landed in the worktree. Procedure: from the worktree, `pnpm --filter indusk-admin dev` with the default `INDUSK_HOME`, open `/p/dusk/plan/admin-plan-worktrees`, confirm the worktree is named and the Build Phase 4 checkoffs appear on refresh; screenshot recorded in the retrospective. The landing half — the plan reads from trunk once released — is the retrospective's own check.
- **A20** — added during Build Phase 4, not deferred from Test Phase 1: the failure it guards was unknown until Build Phase 3 hit it by accident (the admin's `test-fixtures/sample-project` sits inside this repository, and the resolver listed dusk's plans as the fixture's). The fix landed in Build Phase 3; the test was shown red by running it against the resolver from before that fix (`git show dded1d97~1:…` — it listed the enclosing repository's `demo`), then green on the current code.

#### Deferred to Build Phase 5

- **A21–A25** — falsification hypotheses (`/falsify`, 2026-09-18), formed by reading the code Build Phases 1–4 shipped; each names a line that did not exist when Test Phase 1 was authored. All five reach their subject over a boundary (a tool call, HTTP, the built CLI), so each can go red at Build Phase 5's start against today's code.
  - **A21, A22** — `parsePlan` begins with `readdirSync(planDir)`, and the admin's `readPlanFolder` calls `parsePlan` too. Both are handed `<worktree>/.indusk/planning/<plan>` for an assigned plan without checking the folder is there. Retrospective Step 9 moves that folder to `archive/` on the branch and Step 10 releases only after the merge, so every plan passes through the window: `list_plans` throws for the whole project, and `readActivePlans` rejects, erroring every page of the project in the admin. This plan's own retrospective is the first to cross it.
  - **A23** — `assignPlan` reads the record, validates, and writes it back with nothing held between the read and the write. Two sessions creating or assigning worktrees at the same time each write their own list, and the later write drops the earlier assignment: that plan silently reads the trunk again, which is the bug this plan exists to fix. `lib/agents/lock.ts` (`withLock`) is the project's lock for exactly this between processes on one machine. If twelve concurrent runs cannot be made to lose an update against today's code, `/work` records that the red could not be demonstrated and keeps the row as a regression guard, rather than calling it green.
  - **A24** — `createPlanWorktree` refuses an existing target folder with "assign it with `indusk worktree assign <plan> <path>`, or remove it"; `assignPlan` refuses any path that is not a linked worktree. So for the most common existing folder — the ignored files a `git worktree remove --force` leaves behind, three of which sit in `dusk-worktrees/` today — the advice names a command that refuses too.
  - **A25** — `createPlanWorktree` bases `plan/<plan>` on the trunk's *current* branch. A trunk left on any other branch forks the new plan from that branch's unmerged work, with nothing said. The trunk guard already defines which branches are trunk (`worktree.trunk_guard.branches`, default `main`/`master`).

#### Deferred to Build Phase 6

- **A26–A29** — cleanup rows (`/cleanup`, 2026-09-18): each pins a unit the Cleanup Phase extracts (`parseWorktreeList`, `copySource`, `getTrunkBranches`, `plan-worktree-record.ts`), so a count or import of it cannot be written before that phase. Each pairs a structural count over `src/lib` (the single-definition pattern of `head-sha-single-definition.test.ts`) with the behaviour rows that already cover the unit (A5, A6, A21 for the report; A10–A13, A23 for the record; A25 for the branch list; the existing `decision.ts` tests for `detectTreeContext`).

#### Regression Guards

- **A7** — unassigned plans must read exactly as they do today; it passes when written and has no red window by design. It guards every later phase against moving a plan that has no assignment.

#### Test Phase 1 Verification

- [x] A1–A18 authored; A7 passes; every other row fails on its own assertion (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts src/__tests__/plan-worktrees-tools.test.ts src/__tests__/plan-worktrees-skills.test.ts` and `pnpm --filter indusk-admin exec vitest run src/__tests__/http-plan-worktrees.test.ts`)
- [x] The A19 deferral reviewed: it names a procedure that can run at Build Phase 4 and asserts what the test plan claims

#### Test Phase 1 Context

- [x] Add to Known Gotchas (tests): tests that need a plan in a worktree use `helpers/plan-worktree-fixture.ts` (a real `git worktree add`; a one-checkout fixture cannot show this bug), and MCP tools are called through `helpers/tool-call.ts`

#### Test Phase 1 Document

- [x] Changelog Unreleased entry opened in `apps/docs/src/changelog.md` ("Fixed — plans worked in a worktree show their progress"), filled in as phases land

### Build Phase 1: The record, the resolver, the commands

- [x] `apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts`:
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
- [x] `indusk worktree assign <plan> <path>` and `indusk worktree release <plan>` in `src/bin/commands/worktree.ts`, wired in `src/bin/cli.ts`; refusals exit non-zero naming the plan, the path or both existing worktrees
- [x] Normal-mode `indusk worktree create <plan>`: when the project is not a workbench, refuse unless `.indusk/planning/<plan>/` exists on trunk, then `git worktree add <dir>/<plan> -b plan/<plan> main`, record the assignment, and print the path and "run `pnpm install` there"; workbench `create` unchanged. *As built: the base is the trunk's current branch rather than a literal `main`, and the message says "install the project's dependencies there" — naming `pnpm` would be tool knowledge in core, which extensions own.*
- [x] Export `./worktree/plan-worktrees` in `apps/indusk-mcp/package.json`
- [x] Assign this plan's own worktree with the built CLI, verbatim: `node apps/indusk-mcp/dist/bin/cli.js worktree assign admin-plan-worktrees ../dusk-worktrees/admin-plan-worktrees` — *run from the worktree, so the path was `.` (the written path is relative to the trunk); exit 0, record written in the shared git directory, both trees' `git status` unchanged by it*
- [x] Shape (`apps/indusk-mcp/src/lib/worktree/plan-worktrees.ts`) — extract the per-plan classification in resolvePlanCopies (no assignment / one live / several live / all gone) into a named copyFor(plan, assignments, repo). Rule: one reason to change — an inline block with three outcomes wants a name and a seam

#### Build Phase 1 Verification

- [x] A10, A11, A13 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts`) — 3 passed; A8, A9, A12 red only on the plan tool's read, which is Build Phase 2's (see the note under the trajectory)
- [x] Typecheck and lint clean (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit`, `pnpm check`) — *as run: `tsc --noEmit` clean; `biome check` on the eleven files this plan touched clean. Repo-wide `pnpm check` exits 1 on the trunk too, on files this plan never touched (biome.json deprecations, admin SVGs, `eval-trigger.js`, `hook-cwd-independence.test.ts`, the docs config) — pre-existing, recorded in Notes*

#### Build Phase 1 Context

- [x] Add to Conventions: a plan's live copy is resolved by `lib/worktree/plan-worktrees.ts` from a record in the shared git directory, written only by `indusk worktree create/assign/release`, checked against `git worktree list` on every read; never by matching names; inert in a workbench

#### Build Phase 1 Document

- [x] New `apps/docs/src/reference/cli/worktree.md`: `create` (normal and workbench), `assign`, `release`, the record's location and every refusal; sidebar entry

### Build Phase 2: The MCP tools read the live copy

- [x] `list_plans`, `get_plan_status`, `advance_plan` in `src/tools/plan-tools.ts` resolve each plan's folder through `resolvePlanCopies` / `livePlanRoot`, rooted at the main worktree whatever the server's cwd; each result carries `worktree` (name, path, branch) when read from one, and `copyProblem` when the resolver reports `gone` or `doubled`
- [x] A malformed record returns an error result naming the file from each of the three tools, rather than a plan list read from trunk
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] A5, A6, A17 pass; A7 still passes; the tools halves of A14 and A16 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-tools.test.ts`) — 10 passed
- [x] A8, A9, A12 pass — the CLI rows whose "reads from" half is the plan tool's (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts`) — 6 passed
- [x] Full mcp suite green (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`) — *as run: 1503 passed, 4 failed. A18's two are Build Phase 4's rows, red by design. The two in `daemon-identity.test.ts` are the known port collision: `otelcol` (the local telemetry collector) listens on 65001, which the test assumes is free — queued in the root master's small queue on 2026-09-18, reproduces on trunk. The first run also showed a single-definition pin catching a second `--git-common-dir` caller (fixed: `gitCommonDirOf` in `lib/worktree/layout.ts` is the one spawn) and eight admin daemon and tarball tests that needed the admin built and bundled in this fresh worktree (`pnpm --filter indusk-admin build` then `node scripts/bundle-admin.js`), after which they pass.*

#### Build Phase 2 Context

- [x] Update the Conventions entry from Build Phase 1: the three plan tools read through the resolver and report `worktree` / `copyProblem`

#### Build Phase 2 Document

- [x] Update `apps/docs/src/reference/tools/indusk-mcp.md`: the three tools' `worktree` and `copyProblem` fields and the malformed-record error

### Build Phase 3: The admin reads the live copy and names it

- [x] `apps/indusk-admin/src/lib/planning-reader.ts`: `readActivePlans` reads each plan folder and its phase-boundary record from its live root (through the subpath); `Plan` gains `worktree?` and `copyProblem?`; the record read is exposed for the layout
- [x] Worktree chip in `PlanDetail`'s header and in the `PlanList` row (`data-testid="plan-worktree"`), naming the worktree folder and branch; `copyProblem` rendered as a warning line ("assigned worktree `x` no longer exists — showing the trunk copy"; "two live worktrees assigned: `a`, `b`")
- [x] Unassigned worktrees listed under the sidebar ("Unassigned worktrees"), each with its branch
- [x] A malformed record renders an error block in the project layout naming the file; no plan list renders beneath as if it were right — *as built: the plans stay listed by name (names come from the trunk's folders, not from any copy) and each carries the error with no documents or progress, so nothing drawn is from a guessed copy*
- [x] Browser tests that render these components mock `@/lib/planning-reader` exports they import (the gotcha from day-promises) — `app/p/[project]/page.test.tsx` gains `readProjectWorktrees`; the plan page and Scorecards tests do not render the layout
- [x] The resolver applies only when the project folder is the top of its checkout (found in this phase: the admin's `test-fixtures/sample-project` sits inside this repository, and the resolver climbed to dusk's trunk and listed dusk's plans as the fixture's). A project nested inside a larger repository keeps reading the folder it was asked about.
- [x] Shape (`apps/indusk-admin/src/app/p/[project]/layout.tsx`) — extract the unassigned-worktrees list and the record-error block into named components beside `WorktreeChip` and `PlanCopyNotice`, and name the module for its subject (`components/Worktrees.tsx`). Rule: one reason to change — the layout frames a project; which checkout each plan is read from is its own concern, and the four pieces that render it belong together

#### Build Phase 3 Verification

- [x] A1, A2, A3, A4, A14, A15, A16 pass; A7 still passes (`pnpm --filter indusk-admin exec vitest run src/__tests__/http-plan-worktrees.test.ts`) — 8 passed
- [x] Full admin suite green, including `typecheck.test.ts` (`pnpm turbo test --filter=indusk-admin`) — *as run: the node project alone is 170 of 170, twice. With the node and browser projects together, two HTTP files fail per run and which two varies (research, scorecards, smoke, or this plan's): a load flake while `next dev` compiles beside the browser runner. The trunk shows the same (research and smoke failed there on the same machine, without this plan). Recorded in Notes.*

#### Build Phase 3 Context

- [x] Update the admin Known Gotchas entry: plan folders and boundary records are read from each plan's live root through `worktree/plan-worktrees`; the header and sidebar name the worktree

#### Build Phase 3 Document

- [x] Update `apps/docs/src/reference/admin-ui/overview.md`: the worktree chip, the gone/doubled warnings, the unassigned list, the record error block

### Build Phase 4: The lifecycle uses it

- [x] `apps/indusk-mcp/skills/work.md` Worktree Kickoff: create the plan's worktree with `indusk worktree create <plan>`; for a worktree made another way, `indusk worktree assign <plan> <path>`
- [x] `apps/indusk-mcp/skills/retrospective.md` Step 10: after the merge, `indusk worktree release <plan>`, then remove the worktree and delete the branch
- [x] `apps/indusk-mcp/skills/planner.md`: the kickoff item's wording names `indusk worktree create <plan>`
- [x] Resync the installed copies in `.claude/skills/` (the `skill-sync-parity` test pins byte-equality)
- [x] A20 regression test for the nested-project fix in `plan-worktrees-tools.test.ts` (discovered work — the eval agent's lesson `nested-checkout-fixes-need-a-regression-test-not-just-a-doc-comment` named the gap: the Build Phase 3 fix had only an incidental guard)
- [x] Run the A19 smoke and record the screenshot path — `dusk/.playwright-mcp/admin-plan-worktrees-a19.png` (ignored folder on the trunk): this worktree's admin (`pnpm --filter indusk-admin dev --port 3499`, default `INDUSK_HOME`) on `/p/dusk/plan/admin-plan-worktrees`, dusk registered at its trunk path, shows the `⎇ admin-plan-worktrees` chip, "Read from the worktree admin-plan-worktrees on plan/admin-plan-worktrees", and the stage bar on Phase 4 at "Run the A19 smoke… (4 of 5)"
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 4 Verification

- [x] A18 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-skills.test.ts src/__tests__/skill-sync-parity.test.ts`) — 25 passed. *The A18 test's section cutter was wrong (it searched for the next heading one character into the current one, so `## Step 10` matched itself and the section was one character long); fixed to search from the line after the heading, with a guard that throws on a section under 200 characters. The fixed test goes red against the pre-plan retrospective text and green against the new one.*
- [x] A20 passes, and was red against the pre-fix resolver (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-tools.test.ts`) — 11 passed
- [x] A19: the smoke run as written in the Test Phase 1 register, screenshot saved — `dusk/.playwright-mcp/admin-plan-worktrees-a19.png`; checking off the smoke item moved the page from 4 of 5 to 5 of 5 on the next fetch
- [x] Root suite green (`pnpm test`) — *as run: admin 299 of 299; mcp 1505 passed, 2 failed, both in `daemon-identity.test.ts` (the `otelcol` port-65001 collision, queued in the root master, reproduces on trunk); the root command stops there before `pnpm promises:check`, which run on its own passes (3 promises, all enforced)*

#### Build Phase 4 Context

- [x] Update the worktree-per-plan Conventions entry: the kickoff creates through `indusk worktree create <plan>`, which records the assignment; the retrospective releases it between the merge and the removal

#### Build Phase 4 Document

- [x] Update `apps/docs/src/guide/worktree-setup.md` and `apps/docs/src/guide/plan-lifecycle.md`: a plan's worktree is assigned at the kickoff and released at landing; the admin reads the live copy

### Build Phase 5: Falsification — the live copy's folder, and the record between two writers

**Goal**: verify whether the attested state holds when the live copy's plan folder moves or vanishes inside its worktree, when two processes write the record at once, and when `create` meets a leftover folder or a trunk on the wrong branch. Each trajectory row captures one hypothesis about what is broken; each item below is the fix the code needs if it confirms.

- [x] The resolver returns each copy's plan **folder**, not only its root: for an assigned plan, `<worktree>/.indusk/planning/<plan>` when it exists; else `<worktree>/.indusk/planning/archive/<plan>` with `archivedInWorktree: true`; else the trunk folder with problem `missing` naming the worktree. No reader joins a plan folder path by hand again.
- [x] `list_plans`, `get_plan_status`, `advance_plan` and the admin's `readActivePlans` read the folder the resolver returns; an archived-in-worktree plan is reported as such (`archivedInWorktree` in the tools; in the admin a notice "archived in its worktree `<name>`, awaiting landing"); `missing` renders like `gone`, naming the path
- [x] `assignPlan` and `releasePlan` hold a lock beside the record (`withLock` from `lib/agents/lock.ts`, on `<record>.lock`) from the record's read to its write; the git calls stay outside the lock
- [x] `createPlanWorktree`'s existing-folder refusal distinguishes a linked worktree of this repository (advise `assign`) from anything else (say it is not a worktree and to remove it, naming the path)
- [x] `createPlanWorktree` refuses unless the trunk's current branch is in `worktree.trunk_guard.branches` (default `main`, `master` — the trunk guard's list, read once in TypeScript beside the resolver, with the hook as its port), naming the branch it found
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 5 Verification

- [x] A21, A22: the tools rows in `plan-worktrees-tools.test.ts` and the admin rows in `http-plan-worktrees.test.ts` go red on today's code (a thrown `ENOENT` and a non-200 page), then green — *red: `ENOENT … scandir …/wt-alpha/.indusk/planning/demo` from both tools, and 500 on `/p/archived` and `/p/missing`; green: tools 13 of 13, HTTP 10 of 10* (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-tools.test.ts` and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-plan-worktrees.test.ts`)
- [x] A23, A24, A25: the CLI rows in `plan-worktrees-cli.test.ts` go red on today's code, then green — *red: A23 lost six of twelve assignments (`race-3`, `race-6`, `race-7`, …), so the lost update is real, not theoretical; A24's refusal advised `assign`; A25's create exited 0 from `feature/unmerged`. Green: CLI 9 of 9, A23 three runs in a row* (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts`); for A23, if no lost update can be shown against today's code, record that and keep the row as a regression guard
- [x] A1–A20 still pass (the same three files), and the mcp and admin node suites show no new failure — *mcp 1511 passed, 2 failed (the known `daemon-identity` port collision); admin node 172 of 172* (`pnpm turbo test --filter=@infinitedusky/indusk-mcp`, `pnpm --filter indusk-admin exec vitest run --project node`)

#### Build Phase 5 Context

- [x] Update the plan live-copy Conventions entry: the resolver returns each plan's folder (active, archived-in-worktree, or the trunk's with `missing`), writes to the record take `<record>.lock`, and `create` refuses a leftover folder or a trunk on a non-trunk branch

#### Build Phase 5 Document

- [x] Update `apps/docs/src/reference/cli/worktree.md` (the new refusals, the lock, the archived-in-worktree and missing rows of "What a reader sees") and the matching table in `apps/docs/src/reference/admin-ui/overview.md`

### Build Phase 6: Cleanup — one parser, one report, one config reader, the record in its own module

**Goal**: decompose what this plan grew across files, per the codebase's single-definition rule ("a primitive kept in a domain folder gets copied by the next domain") and one reason to change per module. The plan left two parsers of git's worktree list, two hand-written mappings from a plan copy to its report fields (tools and admin), a private reader of `.indusk/config.json` beside the typed one, and a 565-line resolver module carrying three concerns. No domain extension (`nextjs`, `react`) is enabled in this repo, so every move is "extract a function or module".

- [ ] Extract `parseWorktreeList(porcelain): GitWorktree[]` in `lib/git.ts` — the pure parse `listWorktrees` does inline — and have `decision.ts` use it instead of its private `parseMainWorktree` (its runner stays injectable: it parses the string its runner returns). Basis: two parsers of one git output diverge silently; git primitives live in `lib/git.ts`
- [ ] Add `copySource(copy): { worktree?, archivedInWorktree?, copyProblem? }` to `plan-worktrees.ts`, exported through the subpath, with its return type as the one definition of those fields; replace `copyFields` in `plan-tools.ts` and the mapping in the admin's `readActivePlans`, and type the admin `Plan`'s three fields from it. Basis: rule of two across packages that are required to agree — the admin reuses the package's parsers, never re-derives
- [ ] Move the trunk-branch list into `lib/config.ts`: `trunk_guard?: { enabled?: boolean; branches?: string[] }` on `WorktreeConfig` and `getTrunkBranches(projectRoot)` with the `main`/`master` default in the reader, as `getSweepTtlMinutes` does; `createPlanWorktree` calls it and `trunkBranches` goes; the hook's comment names the new home. Basis: one reader of the config file, defaults in the reader
- [ ] Split `plan-worktrees.ts` (565 lines): the record — `RECORD_FILE`, `Assignment`, parse and validate, path, read, `updateRecord` under the lock, write, and the one unreadable-record refusal (today spelled twice, in `updateRecord` and `readRecordOrRefuse`) — to `lib/worktree/plan-worktree-record.ts`; `assignPlan`, `releasePlan`, `createPlanWorktree` and `PlanWorktreeRefusal` to `lib/worktree/plan-worktree-commands.ts`, which the CLI imports; `plan-worktrees.ts` keeps the resolver (`resolvePlanCopies`, `livePlanCopy`, `copySource`, the copy types) and stays the published subpath. Basis: one reason to change per module — the record's format, the resolution rules and the commands' refusals change for different reasons
- [ ] (reviewed `apps/indusk-mcp/package.json` — left as-is: the 286-line diff is Biome converting two-space indentation to tabs when Build Phase 1 ran `biome check --write` on it; tabs are this repo's `indentStyle` and the root and docs `package.json` already use them, so reverting would restore the one nonconforming layout)
- [ ] (reviewed `src/bin/cli.ts` (862 lines) and `src/bin/commands/worktree.ts` (485) — left as-is: this plan added two command registrations and three handlers in each file's existing shape; both files are one cohesive command surface, and their size predates the plan)
- [ ] (reviewed `apps/indusk-mcp/skills/planner.md` and `work.md` — left as-is: prose over the cap before this plan, touched by a sentence and a paragraph)
- [ ] (reviewed the admin's `http-plan-worktrees.test.ts` inline repository builder — left as-is: it repeats `helpers/plan-worktree-fixture.ts`, but test helpers are package-scoped and the admin cannot import the mcp package's `__tests__` without coupling two packages' test lanes)
- [ ] (reviewed `apps/indusk-admin/src/components/Worktrees.tsx` — left as-is: four small server components on one subject, each used once, already one module after Build Phase 3's Shape finding)

#### Build Phase 6 Verification

- [ ] A26–A29 authored as counts in `apps/indusk-mcp/src/__tests__/plan-worktrees-single-definition.test.ts` and passing (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-single-definition.test.ts`)
- [ ] Behaviour parity: A1–A25 and the `decision.ts` tests pass unchanged (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-worktrees-cli.test.ts src/__tests__/plan-worktrees-tools.test.ts src/lib/worktree` and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-plan-worktrees.test.ts`)
- [ ] Typecheck both packages (`pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit`, `pnpm --filter indusk-admin exec tsc --noEmit`)

#### Build Phase 6 Context

- [ ] Add the eighth single definition to the Known Gotchas list: `parseWorktreeList` (`lib/git.ts`) and the plan-worktree record module, pinned by `plan-worktrees-single-definition.test.ts`; update the live-copy convention for the three modules and `getTrunkBranches`

#### Build Phase 6 Document

- [ ] Update `apps/docs/src/reference/cli/worktree.md`'s last paragraph: the resolver, record and commands modules, and `copySource` as the one report shape the tools and admin share

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

- **Repo-wide `pnpm check` is red on trunk** (found 2026-09-18 in Build Phase 1) on files this plan does not touch: `biome.json` schema deprecations, `apps/indusk-admin/public/*.svg`, `.claude/hooks/eval-trigger.js`, `hook-cwd-independence.test.ts`, `apps/docs/src/.vitepress/config.ts`. This plan's own files are checked by name.
- **The admin's HTTP tests flake under a full run** (found 2026-09-18 in Build Phase 3): with the node and browser vitest projects running together, two `next dev`-backed files fail per run, a different two each time, with timeouts or 404s while routes compile. The node project alone passes every time, and the trunk flakes the same way without this plan. Follow-on: run the HTTP files in their own vitest invocation, or give `next-dev.ts` a readiness probe per route.
- **Stray Next servers on this machine** (2026-09-18): two orphaned admin daemons with their working directory in the removed `dusk-worktrees/day-promises` (started by the lifecycle tests, never stopped), and the registered daemon still running from the npm folder the 1.52.0 upgrade replaced — it serves 1.51.0 code until `indusk ui restart`.

- The record lives outside the working tree on purpose: the paths in it are
  true on one machine only.
- `indusk worktree create` in normal mode takes the plan name as the slug, so
  the folder is `<dir>/<plan>` and the branch `plan/<plan>`. The resolver
  never reads either name to decide anything; they are for people.
