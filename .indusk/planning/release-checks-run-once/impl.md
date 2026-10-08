---
title: "Release checks run once"
date: 2026-10-08
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# Release checks run once

## Goal

A plan that lands green is released without running the slow tests again, and the landing and release steps every project installs name that project's own commands (`workflow.steps`), or say plainly that it has none.

## Scope

### In Scope
- `indusk checks slow` (with `--unless-covered`) and `indusk checks show`
- the record of green runs in the project's home; the key over the code a run covered
- `workflow.steps` in `.indusk/config.json`, added empty by `update`
- the retrospective's landing and release steps, and the other skills that name dusk's commands
- dusk's own config, landing check and release script

### Out of Scope
- moving `verify.testRunner` and `plans.land_checks` under `workflow` (known issue)
- the order of steps; CDEvents (known issues)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A5, A7–A9 red over the CLI and the skills; A10 as a guard | the CLI as it is |
| Build Phase 1 | `lib/checks/` (the key, the record), `indusk checks slow [--unless-covered]`, the `workflow.steps` type | the project home (`bookkeepingRoots`), `gitSync` |
| Build Phase 2 | `indusk checks show`; `workflow: { steps: {} }` on `update`; the skills' landing and release steps | Build Phase 1's config reader |
| Build Phase 3 | dusk's `workflow.steps`, its landing check and release script; A6 on this repository | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | After a fully green slow run, the same code with only the version bump and a changelog entry on top skips the slow tests, naming the run that covered them | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/checks-slow.test.ts |
| A2 | A change to any covered file since the green run (code, a test, a test config, the lockfile) runs the slow tests | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/checks-slow.test.ts |
| A3 | A slow run that exits non-zero records nothing, so the next release runs the tests | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/checks-slow.test.ts |
| A4 | A run over uncommitted changes to covered files records nothing, and `--unless-covered` with such changes runs the tests | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/checks-slow.test.ts |
| A5 | A green run recorded in a plan's worktree covers the same code on `main` | Test Phase 1 | Build Phase 1 | passing | unit | promise: slow-checks-run-once-per-tree | apps/indusk-mcp/src/__tests__/checks-slow.test.ts |
| A6 | On this repository, after `indusk checks slow` runs green, the release script's `--unless-covered` skips and names that run | Build Phase 3 | Build Phase 3 | planned | live check | promise: slow-checks-run-once-per-tree | manual: on main after landing, `node apps/indusk-mcp/dist/bin/cli.js checks slow --unless-covered` prints the covering run |
| A7 | The landing and release steps every project installs name none of dusk's commands or paths | Test Phase 1 | Build Phase 2 | passing | unit | promise: landing-and-release-name-the-projects-commands | apps/indusk-mcp/src/__tests__/steps-name-project-commands.test.ts |
| A8 | A project that declares its steps gets them named back by `indusk checks show` | Test Phase 1 | Build Phase 2 | passing | unit | promise: landing-and-release-name-the-projects-commands | apps/indusk-mcp/src/__tests__/checks-show.test.ts |
| A9 | A project that declares none is told plainly that landing runs no slow tests and release has nothing to publish | Test Phase 1 | Build Phase 2 | passing | unit | promise: landing-and-release-name-the-projects-commands | apps/indusk-mcp/src/__tests__/checks-show.test.ts |
| A10 | Landing still refuses an unaccepted plan and runs the declared landing checks | Test Phase 1 | Test Phase 1 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/__tests__/plans-land.test.ts |

## Checklist

### Test Phase 1: Over the CLI and the skills

**Goal**: author A1–A5 and A7–A9 red against the CLI and the installed skills as they are, and run A10 as the guard.

- [x] Confirm this plan's worktree (`indusk worktree create release-checks-run-once` made it and recorded the assignment) — worktree-per-plan default
- [x] A1–A5: `checks-slow.test.ts` builds a git repo with `workflow.steps` declaring a slow command that exits 0 (or 1), runs the built CLI's `checks slow` and `checks slow --unless-covered` in a temporary `INDUSK_HOME`, and reads whether the slow command ran (it writes a marker file). RED today: `checks` is an unknown command
- [x] A7: `steps-name-project-commands.test.ts` reads the package's retrospective, verify and work skills and refuses `pnpm test:system`, `pnpm release`, `release-guard.sh`, `PACKAGED_PATHS`, `apps/docs/src/changelog.md` and `apps/indusk-mcp/` in them. RED today: the retrospective names them
- [x] A8, A9: `checks-show.test.ts` runs `checks show` in a project with and without `workflow.steps`. RED today: unknown command
- [x] A10: run the existing `plans-land.test.ts` unchanged; it passes and stays the guard

#### Deferred to Build Phase 3

- **A6** — a live check on this repository, run after its own `workflow.steps` and release script are in place.

#### Regression Guards

- **A10** — landing's refusal of an unaccepted plan and its declared checks pass today and must keep passing.

#### Test Phase 1 Verification

- [x] (A1–A5, A8, A9: "unknown command 'checks'", and A3/A4's marker absent; A7: the retrospective's Steps 10–11 name all six, `verify.md` and `work.md` name `pnpm test:system`; `plans-land.test.ts` 9 of 9) A1–A5 and A7–A9 are authored and fail on their own assertions (unknown command, named paths found), and A10 passes (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/checks-slow.test.ts src/__tests__/checks-show.test.ts src/__tests__/steps-name-project-commands.test.ts src/__tests__/plans-land.test.ts`)

### Build Phase 1: The key, the record, and `checks slow`

- [x] (`WorkflowSteps` in `config.ts`; `readWorkflowSteps` in `lib/checks/steps.ts` refuses, naming the key, any value that is not a non-empty string or, for `covers`, a list of them) `workflow.steps` in `lib/config.ts`'s config type: `land.slow_tests`, `release.command`, `release.version_file`, `release.changelog`, `release.covers` — every value a string or a list of paths (ADR D5)
- [x] (blob hashes from `git ls-files -s`, valid because a dirty tree has no key; dirt read as bare paths from `git diff --name-only HEAD` and `git ls-files --others`, since the runner trims `status --porcelain`'s first prefix) `lib/checks/key.ts`: `codeKey(checkout, steps)` — sha256 over `path + content hash` for each file `git ls-files` lists under `covers` (default: everything but `.indusk/`), the changelog left out, the version file read without its `version` field; `null` when any covered file has an uncommitted change
- [x] `lib/checks/record.ts`: `recordGreenRun(anyCheckout, run)` and `findCoveringRun(anyCheckout, key)` over `<home>/slow-runs.jsonl` (through `readJsonl`)
- [x] (runs the command through `sh -c` at the checkout's top level, output inherited; a green run whose key changed during the run is said, not recorded) `indusk checks slow [--unless-covered]` in `bin/commands/checks.ts`: runs the declared command with inherited output; records only on exit 0 with a key before and after that agree; with `--unless-covered`, prints `slow tests skipped: covered by the green run at <at> (<cwd>)` and exits 0 when a record covers the key; with nothing declared, says so and exits 0

#### Build Phase 1 Verification

- [x] (A1–A5 5 of 5; related tests 78 files, 486 passed; `tsc` clean) A1–A5 pass (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/checks-slow.test.ts && pnpm exec vitest related src/lib/checks src/bin/commands/checks.ts --run`)
- [x] Shape — `steps.ts` reads and refuses, `key.ts` keys (its version stripping a named helper), `record.ts` reads and appends the record, `checksSlow` decides whether to run and whether to record. One job each; nothing to change

#### Build Phase 1 Context

- [x] (delivered in `key.ts`'s and `record.ts`'s headers, since the package's `CLAUDE.md` is 2 bytes under its budget, a known issue) mcp: `lib/checks/` owns whether a slow run covers the code at hand; the key is content, never the commit, and a dirty tree has no key

#### Build Phase 1 Document

- [x] (and in the sidebar) New `apps/docs/src/reference/cli/checks.md`: `checks slow`, `--unless-covered`, the record and the key

### Build Phase 2: `checks show`, and steps that name the project's commands

- [x] `indusk checks show`: each declared step's tooling, or, for what is not declared, what that means (landing runs no slow tests; release has nothing to publish)
- [x] (`ensureWorkflowConfig` beside the reader; a fresh project's `update` printed `add: workflow.steps: {}`) `update` adds `workflow: { steps: {} }` through `ensureConfigBlock`
- [x] (Steps 10–11 open with `indusk checks show` and use only what it names; a project with no release command records that and stops; the bump goes through a release branch when trunk-guard refuses the edits; before handing over, `checks slow --unless-covered` confirms the release will skip. `release-ritual-skill.test.ts`'s bump assertion pinned `package.json` as the version file, a dusk path this plan's promise rules out: it now expects "declared version file") The retrospective's Steps 10 and 11, `verify.md`'s test table and `work.md`'s phase-runs line name what `indusk checks show` prints, never dusk's commands or paths; resync `.claude/skills/`
- [x] Discovered at the package run: `installed-hook-drain.test.ts` and `pending-repo-attribution.test.ts` failed, on `main` too, since the installed hooks were synced to 1.66.0 after its release: they copy `.claude/hooks/` and wrote the pending queue into the checkout, where the 1.66.0 hook no longer reads it. They write it to the project home through `evalDir`

#### Build Phase 2 Verification

- [x] (4 files, 38 passed; the whole package passed but for the two drain tests and the release-ritual skill test's version-file assertion, both fixed above) A7, A8, A9 pass and A10 still does (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run src/__tests__/steps-name-project-commands.test.ts src/__tests__/checks-show.test.ts src/__tests__/plans-land.test.ts src/__tests__/skill-sync-parity.test.ts`)

- [x] Shape — `checksShow` is one list of facts, each line a declared value or what not declaring it means; `ensureWorkflowConfig` sits beside the reader it scaffolds for. The skill text is prose. Nothing to change

#### Build Phase 2 Context

- [x] (no rule in the planning template names the slow or release commands, so the skill alone carries it) planning: the landing and release steps name only what `indusk checks show` prints — through the package's `templates/planning/CLAUDE.md` if a rule changes there, else the skill alone

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/checks.md`: `checks show` and `workflow.steps`, with the facts-never-logic rule; `apps/docs/src/reference/skills/retrospective.md`: Steps 10 and 11

### Build Phase 3: dusk declares its steps

- [ ] `.indusk/config.json`: `workflow.steps` (ADR D4's values); `plans.land_checks` gains `node apps/indusk-mcp/dist/bin/cli.js checks slow`
- [ ] `apps/indusk-mcp/package.json` `release`: `pnpm -w test:system` becomes `node dist/bin/cli.js checks slow --unless-covered`
- [ ] A6: on this branch, `checks slow` green, then `checks slow --unless-covered` skips and names the run; recorded here with its output
- [ ] `indusk promises confirm release-checks-run-once`

#### Build Phase 3 Verification

- [ ] A6 recorded, and the full `pnpm test` and `pnpm test:system` pass from a clean environment

#### Build Phase 3 Context

- [ ] root (Key Decisions): release-checks-run-once — the slow tests run once per piece of code; `workflow.steps` holds facts, never logic — always-on because every plan's close and release reads it

#### Build Phase 3 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: `indusk checks`, `workflow.steps`, release skips a covered slow run

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/checks/` | new: `key.ts`, `record.ts` |
| `apps/indusk-mcp/src/bin/commands/checks.ts`, `src/bin/cli.ts` | `indusk checks slow`, `checks show` |
| `apps/indusk-mcp/src/lib/config.ts`, `src/bin/commands/update.ts` | `workflow.steps` |
| `apps/indusk-mcp/skills/retrospective.md`, `verify.md`, `work.md` | name the project's commands |
| `.indusk/config.json`, `apps/indusk-mcp/package.json` | dusk's steps, landing check, release script |
