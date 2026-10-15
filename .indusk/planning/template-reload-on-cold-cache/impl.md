---
title: "Tests and landing work from a cold machine"
date: 2026-10-15
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
---

# Tests and landing work from a cold machine

## Goal

`pnpm test` and landing's install stop depending on a warm machine. The browser template tests get the pre-bundle list their test project never saw, so a cold Vite cache no longer reloads the page mid-run. Landing's install syncs dependencies to the lockfile before it builds. The day-monitor end-to-end test matches the model name it chose rather than Claude Code's wording. Causes and evidence are in `research.md`.

## Scope

### In Scope
- `apps/indusk-mcp/vitest.templates.config.ts`: the templates project inherits the root's `optimizeDeps`.
- Root `package.json` `install:local`: `pnpm install --frozen-lockfile` first.
- `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts:162,169`: match the model name, not the CLI's text.

### Out of Scope
- The admin browser flake `NewProjectProposal` A3 (seen once, cause not found).
- The root daemon guard failing on other sessions' daemons.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1, A3 and A4 authored red | today's main |
| Build Phase 1 | the three fixes; A2 recorded | A1, A3, A4 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Every package the browser template imports is bundled for its test page before the page loads, so none is discovered while a test runs | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-browser-test-passes-on-a-cold-cache | apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts |
| A2 | The template tests, run three times, each from a deleted Vite cache, pass every time, and Vite never reports that it reloaded a test | Build Phase 1 | Build Phase 1 | planned | live check | promise: a-browser-test-passes-on-a-cold-cache | (recorded in the impl with its result) |
| A3 | Landing's install step syncs the checkout's dependencies to the lockfile, refusing a lockfile that does not match, before it builds anything | Test Phase 1 | Build Phase 1 | planned | unit | promise: landing-installs-after-a-dependency-change | apps/indusk-mcp/src/__tests__/install-local.test.ts |
| A4 | An evaluator run with a model that does not exist is recorded as a failure naming that model, and the promise status shows the violation, with the Claude Code installed today | Test Phase 1 | Build Phase 1 | planned | contract | keeps the day-monitor end-to-end test about the monitor, not about Claude Code's wording | apps/indusk-mcp/e2e/day-monitor.e2e.test.ts |

## Checklist

### Test Phase 1: Author the three tests, red

**Tier**: med — the work step's default

This phase writes the tests that fail today for the reasons the research found. One checks that every package the browser template imports reaches its test page's pre-bundle list. One checks that landing's install brings dependencies to the lockfile before it builds. The end-to-end monitor test is changed to look for the fake model's name instead of Claude Code's wording, and run against today's Claude Code. Each must fail on its own assertion. The build phase then makes all three pass.

- [ ] The plan's own worktree is confirmed as the place this plan is built
  <details><summary>Technical</summary>

  `indusk plans start` created `dusk-worktrees/template-reload-on-cold-cache` on `plan/template-reload-on-cold-cache`; confirm with `git worktree list` and that the assignment is recorded (`indusk worktree assign template-reload-on-cold-cache <path>` if it is not) — worktree-per-plan default.

  </details>
- [ ] A test fails today because the browser template's test page does not get the packages the template imports bundled up front
  <details><summary>Technical</summary>

  A1 in `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts` (`// promise: a-browser-test-passes-on-a-cold-cache`): import the default export of `vitest.templates.config.ts`; take the `templates` project; the list the project's server sees is the root's `optimizeDeps.include` when the project sets `extends: true`, else the project's own `optimizeDeps?.include ?? []`. Read every bare `@opentelemetry/*` import specifier from `templates/instrumentation.web.ts` (and its test file); assert each is in that list. Red today: the project neither extends nor has its own list.

  </details>
- [ ] A test fails today because landing's install builds without first syncing dependencies to the lockfile
  <details><summary>Technical</summary>

  A3 in `apps/indusk-mcp/src/__tests__/install-local.test.ts` (`// promise: landing-installs-after-a-dependency-change`): read the root `package.json`; assert `scripts["install:local"]`, split on `&&`, starts with `pnpm install --frozen-lockfile`, before the `prepublishOnly` build; and that `.indusk/config.json` `workflow.steps.land.install` still runs `pnpm install:local`. Red today.

  </details>
- [ ] The end-to-end monitor test looks for the fake model's name, and fails today only where it still expects Claude Code's old wording
  <details><summary>Technical</summary>

  A4 in `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts`: confirm today's failure first (`pnpm exec vitest run --config vitest.e2e.config.ts e2e/day-monitor` from `apps/indusk-mcp`, which fails at line 162 on `issue with the selected model`). The change itself is Build Phase 1's: the test's subject exists, so the red is today's run and nothing is authored ahead.

  </details>

#### Test Phase 1 Verification

- [ ] The two new tests fail on their own assertions and the monitor test's failure is the one the research names
  <details><summary>Technical</summary>

  A1 and A3 red (`pnpm exec vitest run src/__tests__/templates-prebundle.test.ts src/__tests__/install-local.test.ts`, from `apps/indusk-mcp`), each on its assertion, not on a load error; A4 red at line 162 in the e2e run; output noted under this item.

  </details>

#### Test Phase 1 Context

- [ ] Each new test file says which promise it holds
  <details><summary>Technical</summary>

  guard: `templates-prebundle.test.ts` carries `promise: a-browser-test-passes-on-a-cold-cache`; `install-local.test.ts` carries `promise: landing-installs-after-a-dependency-change`.

  </details>

### Build Phase 1: The three fixes

**Tier**: med — the work step's default

This phase makes the three tests pass. The browser template's test project is told to inherit the root configuration, so the pre-bundle list it was written with finally reaches its test page. Landing's install script first brings dependencies to the lockfile. The monitor test checks for the fake model's name. The phase ends by deleting Vite's cache three times and running the template tests after each, which is the only way to see that the mid-run reload is gone.

- [ ] The browser template's test project reads the pre-bundle list from the root configuration
  <details><summary>Technical</summary>

  `apps/indusk-mcp/vitest.templates.config.ts`: add `extends: true` to the `templates` project, with a comment that a Vitest project inherits nothing from the root without it, which is why the list was never applied (main-suite-green Build Phase 3 believed otherwise), carrying `promise: a-browser-test-passes-on-a-cold-cache`.

  </details>
- [ ] Landing's install brings the checkout's dependencies to the lockfile before it builds
  <details><summary>Technical</summary>

  Root `package.json`: `"install:local": "pnpm install --frozen-lockfile && pnpm --filter @infinitedusky/indusk-mcp prepublishOnly && npm install -g ./apps/indusk-mcp"`. Then run `pnpm install:local` once in this worktree and note the exit code.

  </details>
- [ ] The end-to-end monitor test checks for the fake model's name rather than Claude Code's wording
  <details><summary>Technical</summary>

  `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts:162` and `:169`: replace `toContain("issue with the selected model")` with `toContain("claude-does-not-exist-9")` (the model the test sets), keeping `'"error":true'` at :161; a short comment says the CLI's wording is not this test's subject.

  </details>
- [ ] The template tests pass three times from a deleted Vite cache, with no reload
  <details><summary>Technical</summary>

  A2: from `apps/indusk-mcp`, three times: `rm -rf node_modules/.vite && pnpm exec vitest run --config vitest.templates.config.ts`; record each result and whether `unexpectedly reloaded` or `optimized dependencies changed` appeared, under this item.

  </details>

#### Build Phase 1 Verification

- [ ] The two new tests and the monitor test pass, and the code they touch still passes its tests
  <details><summary>Technical</summary>

  A1 and A3 green (`pnpm exec vitest run src/__tests__/templates-prebundle.test.ts src/__tests__/install-local.test.ts`, from `apps/indusk-mcp`); A4 green (`pnpm exec vitest run --config vitest.e2e.config.ts e2e/day-monitor`); A2 recorded passing; `biome check` on the changed files; results noted under this item.

  </details>

#### Build Phase 1 Context

- [ ] The rules for the package's templates say a browser test project must inherit the root configuration to see its pre-bundle list
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/CLAUDE.md`: one line — a Vitest project inherits nothing from the root config without `extends: true`, so a browser project's `optimizeDeps` is set on the project or inherited, never left on the root alone (`promise: a-browser-test-passes-on-a-cold-cache`).

  </details>

#### Build Phase 1 Document

- [ ] The retrospective reference says landing's install syncs dependencies to the lockfile before it builds
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/retrospective.md` (the install step of landing): `pnpm install:local` starts with `pnpm install --frozen-lockfile`, so a merge that changed the lockfile installs without a hand-run `pnpm install`; a lockfile that does not match refuses the install.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/vitest.templates.config.ts` | `extends: true` on the templates project |
| `package.json` | `install:local` syncs to the lockfile first |
| `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts` | match the model name |
| `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts` | new (A1) |
| `apps/indusk-mcp/src/__tests__/install-local.test.ts` | new (A3) |
| `apps/indusk-mcp/templates/CLAUDE.md` | one rule line |
| `apps/docs/src/reference/skills/retrospective.md` | the install step |

## Dependencies
- None.

## Notes
- A4 is a `contract` row in the e2e suite, which `pnpm test` does not run; it is run by hand in Test Phase 1 and Build Phase 1.
