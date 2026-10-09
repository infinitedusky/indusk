---
title: "Clean release build — only today's source ships, and no command is built from a string"
date: 2026-10-09
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# Clean release build — only today's source ships, and no command is built from a string

## Goal

Stop compiled leftovers from deleted sources reaching a published package, keep `indusk` runnable through a clean build, pass every outside value to a command as one argument, and credit the researcher who reported it.

## Scope

### In Scope
- `apps/indusk-mcp`'s build: an empty `dist/` first, `cli.js` executable after.
- A release refusal for a packaged compiled file with no source (`scripts/check-package-source.js`, run by `release-guard.sh`).
- The ten string-built `execSync` calls in `extensions.ts`, `eval.ts` and `scripts/bundle-admin.js`, moved to `execFileSync` with an argument list.
- The changelog credit.

### Out of Scope
- The GitHub Security Advisory and npm deprecation of ≤ 1.33.0 (Sandy's).
- Commands a project's config defines (`shell: true` in the worktree setup), and a hook's fixed command.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A5–A9 red | today's CLI and sources |
| Build Phase 1 | `scripts/build.js` (empty `dist/`, `tsc`, executable `cli.js`); `scripts/check-package-source.js`, run by `release-guard.sh` | `tsc`, `npm pack --dry-run --json` |
| Build Phase 2 | argument-list commands in `extensions.ts`, `eval.ts`, `bundle-admin.js`; the changelog credit | Build Phase 1's clean build |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A compiled file left in the build folder from a deleted source is gone after the next build | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-release-ships-only-its-own-source | apps/indusk-mcp/src/__tests__/clean-build.test.ts |
| A2 | A release refuses, naming the files, when the package it would publish holds a compiled file with no source in the repository | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-release-ships-only-its-own-source | apps/indusk-mcp/src/__tests__/package-source.test.ts |
| A3 | After a clean build, the `indusk` command is executable and runs | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-release-ships-only-its-own-source | apps/indusk-mcp/src/__tests__/clean-build.test.ts |
| A4 | The package a release would publish holds no graph-tools, Graphiti, semantic-graph, beam or `infra` code: given 1.67.0's file list, the check names all 33 leftovers, graph-tools among them | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-release-ships-only-its-own-source | apps/indusk-mcp/src/__tests__/package-source.test.ts |
| A5 | Removing an extension whose MCP server name contains `"; touch pwned; "` removes the server by that name and creates no `pwned` file | Test Phase 1 | Build Phase 2 | planned | unit | promise: commands-take-values-as-arguments | apps/indusk-mcp/src/__tests__/commands-take-arguments.test.ts |
| A6 | An eval task named with quotes and `$(…)` makes its baseline commit with the task's name as written, and runs nothing else | Test Phase 1 | Build Phase 2 | planned | unit | promise: commands-take-values-as-arguments | apps/indusk-mcp/src/__tests__/commands-take-arguments.test.ts |
| A7 | Fetching an extension by a URL or package name holding shell characters passes it to `curl` or `npm` as one argument and runs nothing else | Test Phase 1 | Build Phase 2 | planned | unit | promise: commands-take-values-as-arguments | apps/indusk-mcp/src/__tests__/commands-take-arguments.test.ts |
| A8 | No source file in the package builds a shell command from a template with a value in it; a new one fails the build | Test Phase 1 | Build Phase 2 | planned | unit | promise: commands-take-values-as-arguments | apps/indusk-mcp/src/__tests__/no-shell-strings.test.ts |
| A9 | The changelog's entry for this release credits Timur Juraev (casablanka) for reporting the graph-tools injection | Test Phase 1 | Build Phase 2 | planned | unit | a regression guard over the credit the reporter asked for | apps/indusk-mcp/src/__tests__/no-shell-strings.test.ts |

## Checklist

### Test Phase 1: The commands, red over their boundary

**Goal**: author every row that reaches its subject through a boundary today — the CLI against stub binaries, the source files read as text — and register the build rows whose subject is a new script.

- [ ] Create/confirm this plan's worktree (`indusk worktree create clean-release-build`; made by `indusk plans start` on 2026-10-09 at `dusk-worktrees/clean-release-build`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [ ] A5, A6, A7 in `commands-take-arguments.test.ts`: a temporary `PATH` with stub `claude`, `git`, `curl` and `npm` that each record their argv; the built CLI run against a temporary project; RED today, because the shell runs `touch pwned` (A5), expands `$(…)` (A6), and splits the value (A7)
- [ ] A8 and A9 in `no-shell-strings.test.ts`: read `src/` and `scripts/` as text and refuse an `exec`/`execSync` call whose first argument is a template literal with `${`; read the changelog's `[Unreleased]` for the credit. RED today: ten such calls, and no credit

#### Deferred to Build Phase 1

- **A1, A2, A3, A4** — their subjects are `scripts/build.js` and `scripts/check-package-source.js`, which Build Phase 1 introduces. Bodies:

  ```typescript
  // clean-build.test.ts — promise: a-release-ships-only-its-own-source
  // prepareOutput(dist) on a temp dist holding tools/graph-tools.js → the folder is empty     (A1)
  // finishOutput(dist) on a temp dist/bin/cli.js written 0644 → mode has the executable bits  (A3)

  // package-source.test.ts — promise: a-release-ships-only-its-own-source
  // orphanedOutput(["dist/tools/x.js", "dist/bin/cli.js"], exists) where only src/bin/cli.ts exists
  //   → ["dist/tools/x.js"]; the guard's message names it                                     (A2)
  // orphanedOutput(<1.67.0's file list, a fixture>, exists-against-today's-src) → 33 names,
  //   including dist/tools/graph-tools.js                                                      (A4)
  ```

#### Test Phase 1 Verification

- [ ] A5–A9 authored, each failing on its own assertion (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/commands-take-arguments.test.ts src/__tests__/no-shell-strings.test.ts`); the deferred bodies reviewed: will they compile at Build Phase 1, and do they assert what they claim?

### Build Phase 1: A clean build, and a release that refuses leftovers

**Goal**: every build starts from an empty `dist/` and leaves `cli.js` executable; the release guard refuses a packaged compiled file with no source.

- [ ] `scripts/build.js`: `prepareOutput(dist)` empties `dist/`, `tsc` runs, `finishOutput(dist)` makes `dist/bin/cli.js` executable; `package.json`'s `build` runs it
- [ ] `scripts/check-package-source.js`: `orphanedOutput(files, exists)` over `npm pack --dry-run --json`'s file list, each `dist/**/*.js` mapped to `src/**/*.ts(x)`; `release-guard.sh` runs it and refuses naming the files
- [ ] A4's fixture: 1.67.0's packed file list, saved under `src/__tests__/fixtures/`

#### Build Phase 1 Verification

- [ ] A1–A4 pass, each red first (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/clean-build.test.ts src/__tests__/package-source.test.ts`); `pnpm build` then `indusk --version` from another directory prints the version; `bash scripts/release-guard.sh` passes on the clean tree; tsc and biome clean

#### Build Phase 1 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, the Releases entry): every build empties `dist/` first and leaves `cli.js` executable; the guard refuses a packaged compiled file with no source — folded into the entry, making room in the file, which is at its budget

#### Build Phase 1 Document

- [ ] `reference/cli/release.md`: the new refusal, with the reason (a deleted module shipped for 34 releases)

### Build Phase 2: Values as arguments, and the credit

**Goal**: every value from a person, a manifest or the network reaches its command as one argument; the changelog credits the reporter.

- [ ] `extensions.ts`: `npm pack`, `curl` and `claude mcp remove` through `execFileSync(cmd, argv)`, six calls
- [ ] `eval.ts`: `git worktree add/remove` and `git commit -m` through `execFileSync("git", argv)`, three calls
- [ ] `scripts/bundle-admin.js`: `du -sk` through `execFileSync("du", ["-sk", dir])`
- [ ] Changelog `[Unreleased]`, Security: the graph-tools injection reachable through MCP in 1.33.0 and earlier, fixed in 1.33.1 when the tools were removed; its compiled file shipped unreachable through 1.67.0 and is gone from 1.68.0 on; reported by Timur Juraev (casablanka)

#### Build Phase 2 Verification

- [ ] A5–A9 pass (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/commands-take-arguments.test.ts src/__tests__/no-shell-strings.test.ts && pnpm exec vitest related src/bin/commands/extensions.ts src/bin/commands/eval.ts --run`); tsc and biome clean

#### Build Phase 2 Context

- [ ] guard: `no-shell-strings.test.ts`'s failure names the rule — pass a value as an argument, never inside a shell string — and the report that found it

#### Build Phase 2 Document

- [ ] `apps/docs/src/guide/security.md` (new, short): how to report a vulnerability privately, and the advisories so far; linked from the docs sidebar

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/scripts/build.js` | new: empty `dist/`, `tsc`, executable `cli.js` |
| `apps/indusk-mcp/scripts/check-package-source.js` | new: compiled files with no source |
| `apps/indusk-mcp/scripts/release-guard.sh` | runs the check |
| `apps/indusk-mcp/package.json` | `build` runs `scripts/build.js` |
| `apps/indusk-mcp/src/bin/commands/{extensions,eval}.ts`, `scripts/bundle-admin.js` | `execFileSync` with argument lists |
| `apps/docs/src/changelog.md` | Security entry with the credit |

## Dependencies
- None.

## Notes
- Version for this release: a patch would describe it (a fix), but Sandy asked for a minor that names the credit; the retrospective's bump step decides with Sandy.
