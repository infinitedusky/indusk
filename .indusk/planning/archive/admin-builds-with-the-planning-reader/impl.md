---
title: "The admin builds with the planning reader"
date: 2026-10-19
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
falsification: skipped
falsification_reason: "a two-line build fix proved by the admin's production build; main's install is broken meanwhile"
cleanup: skipped
cleanup_reason: "two lines changed in one function; nothing to decompose"
audit: skipped
audit_reason: "a two-line build fix; the production build is the proof a reader would ask for"
approved_brief: "b59a8408f7e95823da8a8e92e3bc48d8982a1a85278cbb610c5162fde35af88f"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T02:42:11.304Z"
accepted: 2026-10-19T02:45:11.493Z
accepted_by: person
---

# The admin builds with the planning reader

## Goal

The planning reader finds the shipped impl hook through `induskMcpPackageRoot()` at run time, so the admin's production build succeeds and the landed build installs.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | The planning reader finds the shipped impl hook through the package root when it runs, and the file exists there | Test Phase 1 | Build Phase 1 | passing | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/lib/build/read-planning-hook-path.test.ts |
| T2 | The landed build installs: the local install succeeds and the installed command runs the landed version | Build Phase 1 | Build Phase 1 | skipped | live check | a rehearsal of the install the landing failed, recorded once | manual: pnpm install:local on the trunk after landing, then indusk --version from another directory |

## Checklist

### Test Phase 1: Write the failing test

**Tier**: med — the work step's default

This phase writes the test that the planning reader asks the package root for the impl hook's path when it runs, failing today because the path is computed when the module loads.

- [x] Create or confirm this plan's worktree.
  <details><summary>Technical</summary>

  `indusk worktree create admin-builds-with-the-planning-reader` from the trunk; it exists from `plans start`.

  </details>
- [x] Write the test that the hook's path comes from the package root at run time, failing today.
  <details><summary>Technical</summary>

  T1: export from `read-planning.ts` a function `implHookPath()` only in Build Phase 1; today the test asserts that the module has no top-level path built from `import.meta.url` (read the source text for `IMPL_HOOK = join(` with `import.meta.url`), and that `join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js")` exists. Red today on the first assertion. Token `promise: dusk-installs-its-own-build`.

  </details>

#### Test Phase 1 Verification

- [x] The test exists and fails on its own assertion.
  <details><summary>Technical</summary>

  T1 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/build/read-planning-hook-path.test.ts`.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new yet.
  <details><summary>Technical</summary>

  Confirm no context file needs a line.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 1.

  </details>

### Build Phase 1: Find the hook through the package root

**Tier**: med — the work step's default

This phase moves the hook's path from a value computed when the module loads to one asked of the package root when the reader runs, which the bundler leaves alone, then checks that the admin builds and the landed build installs.

- [x] Ask the package root for the impl hook's path when the reader runs it.
  <details><summary>Technical</summary>

  `lib/build/read-planning.ts`: drop the top-level `IMPL_HOOK`; `runHook` uses `join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js")` (`lib/package-root.ts`). T1. Found while building (2026-10-19): the path alone did not fix it; Turbopack reads `spawnSync("node", [path])` as loading a script, so the hook runs through `process.execPath`, as `lib/run/gate.ts` already does.

  </details>
- [x] Build the admin's production bundle to confirm it resolves.
  <details><summary>Technical</summary>

  `pnpm --filter indusk-admin build` in the worktree succeeds.

  </details>
- [x] Shape — reviewed the changed function; nothing to change.

#### Build Phase 1 Verification

- [x] The reader finds the hook through the package root, and the landed build installs. (the install runs after landing — asked: "Approve, and I'll build it, skip falsify, cleanup and audit with reasons, and land it so the install works again." — user: "approved"; recorded in the retrospective)
  <details><summary>Technical</summary>

  T1 passing; T2 after landing (recorded in the retrospective).

  </details>

#### Build Phase 1 Context

- [x] Add to the package's context file that code the admin loads finds shipped files through the package root.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: one line beside the package-root entry, T1 as its guard.

  </details>

#### Build Phase 1 Document

- [x] Add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` unreleased.

  </details>
