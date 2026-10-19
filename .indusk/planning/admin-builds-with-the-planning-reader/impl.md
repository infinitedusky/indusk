---
title: "The admin builds with the planning reader"
date: 2026-10-19
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
---

# The admin builds with the planning reader

## Goal

The planning reader finds the shipped impl hook through `induskMcpPackageRoot()` at run time, so the admin's production build succeeds and the landed build installs.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | The planning reader finds the shipped impl hook through the package root when it runs, and the file exists there | Test Phase 1 | Build Phase 1 | planned | unit | promise: dusk-installs-its-own-build | apps/indusk-mcp/src/lib/build/read-planning-hook-path.test.ts |
| T2 | The landed build installs: the local install succeeds and the installed command runs the landed version | Build Phase 1 | Build Phase 1 | planned | live check | a rehearsal of the install the landing failed, recorded once | manual: pnpm install:local on the trunk after landing, then indusk --version from another directory |

## Checklist

### Test Phase 1: Write the failing test

**Tier**: med — the work step's default

This phase writes the test that the planning reader asks the package root for the impl hook's path when it runs, failing today because the path is computed when the module loads.

- [ ] Create or confirm this plan's worktree.
  <details><summary>Technical</summary>

  `indusk worktree create admin-builds-with-the-planning-reader` from the trunk; it exists from `plans start`.

  </details>
- [ ] Write the test that the hook's path comes from the package root at run time, failing today.
  <details><summary>Technical</summary>

  T1: export from `read-planning.ts` a function `implHookPath()` only in Build Phase 1; today the test asserts that the module has no top-level path built from `import.meta.url` (read the source text for `IMPL_HOOK = join(` with `import.meta.url`), and that `join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js")` exists. Red today on the first assertion. Token `promise: dusk-installs-its-own-build`.

  </details>

#### Test Phase 1 Verification

- [ ] The test exists and fails on its own assertion.
  <details><summary>Technical</summary>

  T1 red: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/build/read-planning-hook-path.test.ts`.

  </details>

#### Test Phase 1 Context

- [ ] Record nothing new yet.
  <details><summary>Technical</summary>

  Confirm no context file needs a line.

  </details>

#### Test Phase 1 Document

- [ ] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with Build Phase 1.

  </details>

### Build Phase 1: Find the hook through the package root

**Tier**: med — the work step's default

This phase moves the hook's path from a value computed when the module loads to one asked of the package root when the reader runs, which the bundler leaves alone, then checks that the admin builds and the landed build installs.

- [ ] Ask the package root for the impl hook's path when the reader runs it.
  <details><summary>Technical</summary>

  `lib/build/read-planning.ts`: drop the top-level `IMPL_HOOK`; `runHook` uses `join(induskMcpPackageRoot(), "hooks", "validate-impl-structure.js")` (`lib/package-root.ts`). T1.

  </details>
- [ ] Build the admin's production bundle to confirm it resolves.
  <details><summary>Technical</summary>

  `pnpm --filter indusk-admin build` in the worktree succeeds.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 1 Verification

- [ ] The reader finds the hook through the package root, and the landed build installs.
  <details><summary>Technical</summary>

  T1 passing; T2 after landing (recorded in the retrospective).

  </details>

#### Build Phase 1 Context

- [ ] Add to the package's context file that code the admin loads finds shipped files through the package root.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, One home per fact: one line beside the package-root entry, T1 as its guard.

  </details>

#### Build Phase 1 Document

- [ ] Add a changelog line.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md` unreleased.

  </details>
