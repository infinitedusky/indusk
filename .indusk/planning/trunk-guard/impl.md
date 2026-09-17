---
title: "Trunk guard — Implementation"
date: 2026-09-17
status: approved
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Trunk guard — Implementation

## Goal

No code is edited or committed on `main` by an agent. A PreToolUse hook
refuses an Edit, Write or `git commit` that touches a non-allow-listed path
while the repository is on a protected branch, naming `indusk worktree
create <plan>` as the way through. Planning documents, lessons, settings and
CLAUDE.md stay editable on trunk; a `chore(release):` commit is exempt; two
visible off switches exist. Registered by `init`, ensured by `update`, and
on in this repository.

## Scope

### In Scope
- `apps/indusk-mcp/hooks/trunk-guard.js` — two matchers in one file
- `init.ts` hook config and `update.ts` ensure block; this repo's settings
- `helpers/hook-runner.ts` `HookName`
- Docs: hooks guide, worktree reference, CLAUDE.md line, changelog

### Out of Scope
- Writes hidden inside arbitrary Bash commands (the commit gate is the second
  line); remote branch protection; retroactive moves

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `src/__tests__/trunk-guard.test.ts` (A1–A4, A6), `trunk-guard-registration.test.ts` (A5, A7), RED | `helpers/hook-runner.ts`, `helpers/versioned-workbench.ts`, `helpers/cli.ts`, `helpers/test-git.ts` |
| Build Phase 1 | the hook | the tests |
| Build Phase 2 | registration in `init`/`update`/this repo; docs | the hook |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | On `main`, an Edit/Write to a source file is refused naming `indusk worktree create` and the branch; the same edit on `plan/x` is allowed silently | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A2 | On `main`, edits to `.indusk/**`, `.claude/lessons/**`, `.claude/settings.json`, `CLAUDE.md`, `AGENTS.md` are allowed | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A3 | On `main`, `git commit` with a staged source file is refused naming the file; allow-listed-only staging is allowed; a `chore(release):` commit is allowed; a non-commit Bash command is ignored | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A4 | In a one-repo versioned workbench, an edit in the code repo on its `main` is refused and an edit to the workbench's `.indusk/planning/**` is allowed, over every layout | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A5 | `indusk init` registers the hook under the Edit/Write matcher and the Bash matcher; `indusk update` adds both to a project lacking them; a second `update` is byte-identical | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/src/__tests__/trunk-guard-registration.test.ts |
| A6 | `worktree.trunk_guard.enabled: false` or `INDUSK_TRUNK_GUARD=off` allows A1's edit and the hook writes nothing | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/trunk-guard.test.ts |
| A7 | This repository's `.claude/settings.json` registers the hook under both matchers in the `hookCommand` form | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/src/__tests__/trunk-guard-registration.test.ts |

### Deferred Verification

None.

## Checklist

### Test Phase 1: Author every assertion RED

**Goal**: every row exists as a test and fails on its own claim before the
hook exists. A1–A4 and A6 spawn a hook file that does not exist yet — a
spawned process on a missing path is a boundary red (node exits non-zero
before any assertion of ours runs), not a load error inside the test file.

- [ ] Create/confirm this plan's worktree (`git worktree add ../dusk-worktrees/trunk-guard -b plan/trunk-guard` — dusk is normal-mode, so `indusk worktree create` does not apply) — worktree-per-plan default; this plan is the one that makes trunk edits refuse, so it runs on a branch from the first commit
- [ ] `src/__tests__/trunk-guard.test.ts`: A1, A2, A3, A6 against a temp git repo (`helpers/test-git.ts`) on `main` and on `plan/x`; A4 over `LAYOUTS` from `helpers/versioned-workbench.ts`
- [ ] `src/__tests__/trunk-guard-registration.test.ts`: A5 via `runCli(dir, ["init", "--local", "--no-index"])` then a seeded settings file through `update` twice; A7 reads this repository's settings
- [ ] `helpers/hook-runner.ts` `HookName` gains `"trunk-guard.js"` (a type, so the test files compile; the hook file itself does not exist yet)
- [ ] Run both files; record each red's message; set A1–A7 to `written`

#### Deferred to Build Phase 1
(none — every row is authored here)

#### Regression Guards
(none)

#### Test Phase 1 Verification
- [ ] `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard.test.ts src/__tests__/trunk-guard-registration.test.ts` — every case red on its own claim (the hook cases red as a non-zero exit from a missing script, the registration cases red on the settings assertion); then `cd` back
- [ ] Rows A1–A7 set to `written`

#### Test Phase 1 Context
- [ ] (none needed — the tests add no rule until the hook exists; the Build Phase 1 Context item carries the rule)

#### Test Phase 1 Document
- [ ] (none needed — nothing user-facing exists yet; Build Phase 2 documents the hook)

### Build Phase 1: The hook

**Goal**: `hooks/trunk-guard.js` refuses what the brief says and allows the rest.

- [ ] `hooks/trunk-guard.js`: read the event; for `Edit`/`Write`/`MultiEdit` take `tool_input.file_path`, for `Bash` match `/\bgit commit(?=$|\s|;|&|\|)/` on `tool_input.command` and collect staged paths (`git diff --cached --name-only`, plus tracked modifications when `-a`/`--all` is present); anything else exits 0
- [ ] Allow-list check first, no git needed: a path under `.indusk/`, `.claude/lessons/`, matching `.claude/settings*.json`, or named `CLAUDE.md` / `AGENTS.md` (relative to the state root or the git root that contains it) is allowed
- [ ] Branch check: resolve `{statePath, gitPath}` with `resolveStateAndGitPaths` from the file's directory (Edit/Write) or the event cwd (Bash); `git symbolic-ref --short HEAD` on `gitPath`; not a protected branch (`worktree.trunk_guard.branches`, default `["main", "master"]`) or detached ⇒ allow
- [ ] Exemptions: `worktree.trunk_guard.enabled === false` in the state root's config, or `INDUSK_TRUNK_GUARD=off`, ⇒ allow silently; a `git commit` whose `-m` message begins `chore(release):` ⇒ allow
- [ ] Refusal (exit 2, stderr): names the path(s), the branch, `indusk worktree create <plan>` and "land by merge (retrospective Step 10)", the allow-listed kinds, and both off switches — one message shape for both matchers

#### Build Phase 1 Verification
- [ ] A1, A2, A3, A4, A6 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard.test.ts`; then `cd` back
- [ ] Every existing hook test still green: `pnpm exec vitest run src/__tests__/hook-shared-modules.test.ts src/__tests__/hooks-record-parity.test.ts src/__tests__/hooks-load-in-cjs-consumer.test.ts src/__tests__/hook-paths.test.ts` — a new hook file must satisfy whatever those pin about `hooks/` (a `_`-module import stays inside the directory; the record lists it if the record is by count)
- [ ] Rows A1–A4, A6 set to `passing`
- [ ] Shape (Build Phase 1): review the hook; record findings or "nothing to change"

#### Build Phase 1 Context
- [ ] Conventions, the worktree-per-plan entry: no code is edited or committed on `main` — `trunk-guard.js` refuses an Edit/Write/`git commit` outside `.indusk/`, `.claude/lessons/`, settings, `CLAUDE.md`, `AGENTS.md` on a protected branch; `chore(release):` exempt; off switches `worktree.trunk_guard.enabled: false` / `INDUSK_TRUNK_GUARD=off`

#### Build Phase 1 Document
- [ ] `apps/docs/src/guide/index.md` (or the hooks guide section "hooks enforce what discipline won't"): the trunk guard — what it refuses, what it allows, the two off switches, why the commit gate exists beside the edit gate

### Build Phase 2: Registration and record

**Goal**: every project `init` or `update` touches gets the hook; this repository has it; the record says so.

- [ ] `init.ts` `hookConfig.PreToolUse`: add `trunk-guard.js` to the Edit/Write entry and a new Bash-matcher entry carrying it
- [ ] `update.ts`: a targeted ensure block in the budget hook's shape for both matchers (idempotent — a second run writes nothing)
- [ ] This repository's `.claude/settings.json`: both registrations in the `hookCommand` form
- [ ] `apps/docs/src/reference/cli/workbench.md` or the worktree reference: the guard applies to the declared code repository's branch in a workbench; the workbench repository is allow-listed by path
- [ ] `apps/docs/src/changelog.md` Unreleased: the trunk guard

#### Build Phase 2 Verification
- [ ] A5, A7 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/trunk-guard-registration.test.ts`; then `cd` back
- [ ] Full mcp suite green: `cd apps/indusk-mcp && pnpm exec vitest run`; `skill-sync-parity` and the settings-writing tests (`hook-cwd-independence.test.ts`) still pass; then `cd` back
- [ ] The hook fires in this repository: from the plan worktree on its branch, an Edit to a source file is allowed; on `main` (the main checkout), `INDUSK_TRUNK_GUARD` unset, the hook run by hand with an Edit event for `apps/indusk-mcp/src/lib/config.ts` exits 2 — recorded here
- [ ] Rows A5, A7 set to `passing`
- [ ] Shape (Build Phase 2): review `init.ts`/`update.ts` changes; record findings or "nothing to change"

#### Build Phase 2 Context
- [ ] Known Gotchas, the hooks-discovery entry: `trunk-guard.js` needs settings registration under TWO matchers (Edit/Write and Bash); `update`'s ensure block adds both, and a hook registered under only one is half a gate

#### Build Phase 2 Document
- [ ] `apps/docs/src/reference/cli/init.md` (or wherever init's hook list is documented): the hook list gains `trunk-guard.js` with its two matchers

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/trunk-guard.js` | new — the two-matcher guard |
| `apps/indusk-mcp/src/bin/commands/init.ts`, `update.ts` | registration + ensure |
| `.claude/settings.json` | this repository's registration |
| `apps/indusk-mcp/src/__tests__/helpers/hook-runner.ts` | `HookName` |
| `apps/indusk-mcp/src/__tests__/trunk-guard*.test.ts` | new |
| docs: hooks guide, worktree/workbench reference, init reference, changelog | the guard |
| `CLAUDE.md` | one convention line, one gotcha |
