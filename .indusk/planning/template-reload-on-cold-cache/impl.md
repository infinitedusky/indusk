---
title: "Tests and landing work from a cold machine"
date: 2026-10-15
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
cleanup: skipped
cleanup_reason: "one new test file is cohesive with no copy elsewhere; the only oversized file, a docs page, got a 7-line touch"
approved_brief: "a5fe861cd6d3a0777b7086fd7e528932774fa2b9ffadb0f4e2a31abb87e1457c"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-15T16:09:05.019Z"
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
| Build Phase 3 | the landing skill names the sync and its refusal; A7 | the audit's findings |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Every package the browser template imports is bundled for its test page before the page loads, so none is discovered while a test runs | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-browser-test-passes-on-a-cold-cache | apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts |
| A2 | The template tests, run three times, each from a deleted Vite cache, pass every time, and Vite never reports that it reloaded a test | Build Phase 1 | Build Phase 1 | passing | live check | promise: a-browser-test-passes-on-a-cold-cache | (recorded in the impl with its result) |
| A3 | Landing's install step syncs the checkout's dependencies to the lockfile, refusing a lockfile that does not match, before it builds anything | Test Phase 1 | Build Phase 1 | passing | unit | promise: landing-installs-after-a-dependency-change | apps/indusk-mcp/src/__tests__/install-local.test.ts |
| A4 | An evaluator run with a model that does not exist is recorded as a failure naming that model, and the promise status shows the violation, with the Claude Code installed today | Test Phase 1 | Build Phase 1 | passing | contract | keeps the day-monitor end-to-end test about the monitor, not about Claude Code's wording | apps/indusk-mcp/e2e/day-monitor.e2e.test.ts |
| A5 | A package the browser template imports only for its side effect, or one outside OpenTelemetry, and missing from the pre-bundle list, turns the pre-bundle guard red; today the guard sees only named imports of OpenTelemetry packages | Phase 0 | Build Phase 2 | passing | unit | promise: a-browser-test-passes-on-a-cold-cache | apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts |
| A6 | Every test file the browser project runs, and every local module those files and the template import, is read by the pre-bundle guard; today it reads two named files, so a second browser test under the templates folder goes unchecked | Phase 0 | Build Phase 2 | passing | unit | promise: a-browser-test-passes-on-a-cold-cache | apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts |
| A7 | A browser template import of a package subpath (`pkg/sub`) that is not itself in the pre-bundle list turns the pre-bundle guard red; today the guard cuts it to `pkg`, which is listed, and stays green while Vite still discovers the subpath mid-run | Build Phase 3 | Build Phase 3 | written | unit | promise: a-browser-test-passes-on-a-cold-cache | apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts |

## Checklist

### Test Phase 1: Author the three tests, red

**Tier**: med — the work step's default

This phase writes the tests that fail today for the reasons the research found. One checks that every package the browser template imports reaches its test page's pre-bundle list. One checks that landing's install brings dependencies to the lockfile before it builds. The end-to-end monitor test is changed to look for the fake model's name instead of Claude Code's wording, and run against today's Claude Code. Each must fail on its own assertion. The build phase then makes all three pass.

- [x] The plan's own worktree is confirmed as the place this plan is built
  <details><summary>Technical</summary>

  `indusk plans start` created `dusk-worktrees/template-reload-on-cold-cache` on `plan/template-reload-on-cold-cache`; confirm with `git worktree list` and that the assignment is recorded (`indusk worktree assign template-reload-on-cold-cache <path>` if it is not) — worktree-per-plan default.

  </details>
  The checkout is the plan's own worktree on its own branch.
  <details><summary>Note</summary>

  `git worktree list` shows `dusk-worktrees/template-reload-on-cold-cache` on `plan/template-reload-on-cold-cache`. `indusk worktree list` refuses ("not a workbench"), so there is no separate assignment record in this normal-mode repo and none was needed.

  </details>
- [x] A test fails today because the browser template's test page does not get the packages the template imports bundled up front
  <details><summary>Technical</summary>

  A1 in `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts` (`// promise: a-browser-test-passes-on-a-cold-cache`): import the default export of `vitest.templates.config.ts`; take the `templates` project; the list the project's server sees is the root's `optimizeDeps.include` when the project sets `extends: true`, else the project's own `optimizeDeps?.include ?? []`. Read every bare `@opentelemetry/*` import specifier from `templates/instrumentation.web.ts` (and its test file); assert each is in that list. Red today: the project neither extends nor has its own list.

  </details>
  The test is written and fails on its own assertion.
  <details><summary>Note</summary>

  The config imports cleanly from a node test, so it is read as a module. Red: all 11 `@opentelemetry/*` packages the template and its test import are reported as "packages the templates project's server would only find mid-run"; the assertion, not a load error.

  </details>
- [x] A test fails today because landing's install builds without first syncing dependencies to the lockfile
  <details><summary>Technical</summary>

  A3 in `apps/indusk-mcp/src/__tests__/install-local.test.ts` (`// promise: landing-installs-after-a-dependency-change`): read the root `package.json`; assert `scripts["install:local"]`, split on `&&`, starts with `pnpm install --frozen-lockfile`, before the `prepublishOnly` build; and that `.indusk/config.json` `workflow.steps.land.install` still runs `pnpm install:local`. Red today.

  </details>
  The test is written and fails on its own assertion.
  <details><summary>Note</summary>

  Red: the first step expected `pnpm install --frozen-lockfile` and received `pnpm --filter @infinitedusky/indusk-mcp prepublishOnly`. The second case (landing still runs `pnpm install:local`) passes today, as it should.

  </details>
- [x] The end-to-end monitor test looks for the fake model's name, and fails today only where it still expects Claude Code's old wording
  <details><summary>Technical</summary>

  A4 in `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts`: confirm today's failure first (`pnpm exec vitest run --config vitest.e2e.config.ts e2e/day-monitor` from `apps/indusk-mcp`, which fails at line 162 on `issue with the selected model`). The change itself is Build Phase 1's: the test's subject exists, so the red is today's run and nothing is authored ahead.

  </details>
  The monitor test's current red is confirmed and is the one the research names.
  <details><summary>Note</summary>

  The built CLI existed in `dist/`. The run failed at line 162, expecting `issue with the selected model`; the recorded failure had `"error":true` and carried `[claude-code:unrecognized_model] {"model":"claude-does-not-exist-9",…}`. Nothing in the test file was changed.

  </details>

#### Test Phase 1 Verification

- [x] The two new tests fail on their own assertions and the monitor test's failure is the one the research names
  <details><summary>Technical</summary>

  A1 and A3 red (`pnpm exec vitest run src/__tests__/templates-prebundle.test.ts src/__tests__/install-local.test.ts`, from `apps/indusk-mcp`), each on its assertion, not on a load error; A4 red at line 162 in the e2e run; output noted under this item.

  </details>
  All three are red for the reasons the research found.
  <details><summary>Note</summary>

  The node run: 2 failed, 1 passed (the "landing still runs install:local" case). A1 reports 11 packages missing from the list the project sees; A3 expects `pnpm install --frozen-lockfile` first and receives the `prepublishOnly` build step. The e2e run fails at line 162 on `issue with the selected model`.

  </details>
- [x] Shape — the two new test files were reviewed against the enabled extensions' craft rules and need no change
  <details><summary>Note</summary>

  `prepareShapeReview` for Test Phase 1 returned a review of the two new files. Each file has small named helpers (`importedPackages`, `listTheProjectSees`, `readJson`) and one reason to change; no findings, so no items were added.

  </details>

#### Test Phase 1 Context

- [x] Each new test file says which promise it holds
  <details><summary>Technical</summary>

  guard: `templates-prebundle.test.ts` carries `promise: a-browser-test-passes-on-a-cold-cache`; `install-local.test.ts` carries `promise: landing-installs-after-a-dependency-change`.

  </details>
  Both files name their promise in the header comment.
  <details><summary>Note</summary>

  Confirmed with a grep for `promise: ` in both files.

  </details>

### Build Phase 1: The three fixes

**Tier**: med — the work step's default

This phase makes the three tests pass. The browser template's test project is told to inherit the root configuration, so the pre-bundle list it was written with finally reaches its test page. Landing's install script first brings dependencies to the lockfile. The monitor test checks for the fake model's name. The phase ends by deleting Vite's cache three times and running the template tests after each, which is the only way to see that the mid-run reload is gone.

- [x] The browser template's test project reads the pre-bundle list from the root configuration
  <details><summary>Technical</summary>

  `apps/indusk-mcp/vitest.templates.config.ts`: add `extends: true` to the `templates` project, with a comment that a Vitest project inherits nothing from the root without it, which is why the list was never applied (main-suite-green Build Phase 3 believed otherwise), carrying `promise: a-browser-test-passes-on-a-cold-cache`.

  </details>
  <details><summary>Note</summary>

  `extends: true` added to the `templates` project with the comment and the promise token; A1 now passes.

  </details>
- [x] Landing's install brings the checkout's dependencies to the lockfile before it builds
  <details><summary>Technical</summary>

  Root `package.json`: `"install:local": "pnpm install --frozen-lockfile && pnpm --filter @infinitedusky/indusk-mcp prepublishOnly && npm install -g ./apps/indusk-mcp"`. Then run `pnpm install:local` once in this worktree and note the exit code.

  </details>
  <details><summary>Note</summary>

  Script edited. The first two parts were run from the worktree root: `pnpm install --frozen-lockfile` exit 0, `pnpm --filter @infinitedusky/indusk-mcp prepublishOnly` exit 0. The last part, `npm install -g ./apps/indusk-mcp`, was not run: it would point this machine's global `indusk` at this worktree, which landing later deletes. Observation: `prepublishOnly` also rewrote the tracked `apps/indusk-mcp/admin/next.config.ts` (the admin bundle's generated config); it was reverted with `git checkout`, as it is not this plan's change.

  </details>
- [x] The end-to-end monitor test checks for the fake model's name rather than Claude Code's wording
  <details><summary>Technical</summary>

  `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts:162`, `:169` and `:182` (the incident file's content, found in Build Phase 1; the research listed only the first two): replace `toContain("issue with the selected model")` with `toContain("claude-does-not-exist-9")` (the model the test sets), keeping `'"error":true'` at :161; a short comment says the CLI's wording is not this test's subject.

  </details>
  <details><summary>Note</summary>

  Lines 163, 170 and 182 now match the model name (as `BAD_MODEL`, which holds `claude-does-not-exist-9`). Line 182 was a third assertion the research had not listed; the amended item covers it. The day-monitor e2e run passes.

  </details>
- [x] The template tests pass three times from a deleted Vite cache, with no reload
  <details><summary>Technical</summary>

  A2: from `apps/indusk-mcp`, three times: `rm -rf node_modules/.vite && pnpm exec vitest run --config vitest.templates.config.ts`; record each result and whether `unexpectedly reloaded` or `optimized dependencies changed` appeared, under this item.

  </details>
  <details><summary>Note</summary>

  Run 1: exit 0, 12 passed and 1 skipped, no reload warning. Run 2: exit 0, 12 passed and 1 skipped, no reload warning. Run 3: exit 0, 12 passed and 1 skipped, no reload warning. Neither `unexpectedly reloaded` nor `optimized dependencies changed` appeared in any run.

  </details>

#### Build Phase 1 Verification

- [x] The two new tests and the monitor test pass, and the code they touch still passes its tests
  <details><summary>Technical</summary>

  A1 and A3 green (`pnpm exec vitest run src/__tests__/templates-prebundle.test.ts src/__tests__/install-local.test.ts`, from `apps/indusk-mcp`); A4 green (`pnpm exec vitest run --config vitest.e2e.config.ts e2e/day-monitor`); A2 recorded passing; `biome check` on the changed files; results noted under this item.

  </details>
  <details><summary>Note</summary>

  The two node test files: 2 files, 3 tests passed. The day-monitor e2e run: 1 passed. The three template runs are recorded above, all green. `biome check` on the three changed files is clean. A1, A2, A3 and A4 are `passing`.

  </details>
- [x] Shape — the three changed files were reviewed against the enabled extensions' craft rules and need no change
  <details><summary>Note</summary>

  `prepareShapeReview` for Build Phase 1 returned a review of the e2e test, the templates config and the root `package.json`. The changes are an `extends: true` line with its comment, a script prefix and three assertions that use an existing named constant; no findings, so no items were added.

  </details>

#### Build Phase 1 Context

- [x] The test that guards the pre-bundle list says, when it fails, that a browser test project must inherit the root configuration to see the list
  <details><summary>Technical</summary>

  guard: A1's failure message in `templates-prebundle.test.ts` names the fix and the rule (a Vitest project inherits nothing from the root config without `extends: true`). Changed from the planned line in `apps/indusk-mcp/templates/CLAUDE.md`, which is the blank skeleton `init` installs into every project, so the line would have shipped to users (found in Build Phase 1); the package's own `CLAUDE.md` is over its budget, and an enforcer is the first tier for a rule a test holds.

  </details>

#### Build Phase 1 Document

- [x] The retrospective reference says landing's install syncs dependencies to the lockfile before it builds
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/retrospective.md` (the install step of landing): `pnpm install:local` starts with `pnpm install --frozen-lockfile`, so a merge that changed the lockfile installs without a hand-run `pnpm install`; a lockfile that does not match refuses the install.

  </details>
  <details><summary>Note</summary>

  The landing paragraph of Step 10 now says the install syncs to the lockfile first, and refuses a lockfile that does not match.

  </details>

### Build Phase 2: Falsification — what the pre-bundle guard cannot see

**Tier**: med — the work step's default

The test that keeps the browser template's packages bundled before its page loads reads only some of what the page imports. It looks for named imports of OpenTelemetry packages in two files, so a package imported only for its side effect, a package from anywhere else, or a second browser test added next to the first can be missing from the list and the guard stays green while the mid-run reload comes back. This phase makes the guard read what the browser project actually loads, and closes once it turns red for each of those cases.

- [x] The pre-bundle guard counts every package a file imports, whatever form the import takes and whoever publishes the package
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts` `importedPackages`: match every bare specifier, not only `@opentelemetry/*` — `import … from "x"`, `export … from "x"`, side-effect `import "x"`, and `import("x")` — reducing a deep import to its package name (`@scope/name` or `name`), and skipping relative paths, `node:` built-ins and `vitest` (the runner, served by Vitest itself). Answers A5: today `import "@opentelemetry/context-zone"` or `import { onLCP } from "web-vitals"` added to `instrumentation.web.ts` leaves A1 green while a cold run re-optimizes and reloads.

  </details>
- [x] The pre-bundle guard reads every test the browser project runs, and the local files they import
  <details><summary>Technical</summary>

  Same file: take the `templates` project's `test.include` globs from `vitest.templates.config.ts`, expand them under the package root, and follow relative imports (static and `?query`-suffixed dynamic, as `instrumentation.web.test.ts` does with `./instrumentation.web.ts?fresh=`) to collect the files whose bare imports are checked, instead of the two hard-coded names. Answers A6: a second `templates/*.test.ts` with an unlisted import is unchecked today.

  </details>

#### Build Phase 2 Verification

- [x] The guard turns red for a side-effect import, a package from outside OpenTelemetry and a second browser test, and is green on the template as it is
  <details><summary>Technical</summary>

  A5 and A6: the extraction is exercised on fixture source strings (a side-effect import, a non-OpenTelemetry package, a deep import, a `node:` import, a relative `?fresh=` import) and on a temporary extra test file the include globs pick up; A1 still green on today's template. Run `pnpm exec vitest run src/__tests__/templates-prebundle.test.ts` from `apps/indusk-mcp`; `biome check` on the file; output noted under this item.

  </details>
  <details><summary>Note</summary>

  Red first (commit `bd62551d0`): A5 and A6 each failed on their own assertion (A5 received `[]` for the fixture's five packages; A6 did not find the temporary `second.test.ts`), not on a load error. Green now: `pnpm exec vitest run src/__tests__/templates-prebundle.test.ts` 1 file, 3 tests passed (A1, A5, A6); `biome check` on the file is clean. A1 stayed green on today's template. One thing the work found: the template's header comment shows `import './instrumentation';`, which the follower read as a real import of the Node template, so comments are stripped before scanning (the A5 fixture includes commented-out imports).

  </details>
- [x] Shape — the changed test file was reviewed against the enabled extensions' craft rules and needs no change
  <details><summary>Note</summary>

  `prepareShapeReview` for Build Phase 2 returned a review of `templates-prebundle.test.ts`. Each step is a small named helper (`packageName`, `isBundledByVite`, `withoutComments`, `specifiersIn`, `packagesIn`, `relativeImportsIn`, `resolveLocalFile`, `collectBrowserFiles`) with one reason to change, and the collector takes a root and globs so a test reaches it without touching `templates/`; no findings, so no items were added.

  </details>

#### Build Phase 2 Context

- [x] (none needed — asked: "Build Phase 2 only widens a test file (the pre-bundle guard). Can I skip its Context gate (the rule is already in the guard's failure message)?" — user: "Skip both (Recommended)")

#### Build Phase 2 Document

- [x] (none needed — asked: "Can I skip its Document gate (no docs page describes the guard)?" — user: "Skip both (Recommended)")

### Build Phase 3: The audit's findings — the landing skill and subpath imports

**Tier**: med — the work step's default

A fresh reader found three gaps after the build. The retrospective skill, which is what an agent follows when it lands a plan, still describes the old install step, so it neither says that dependencies are synced first nor what to do when that sync refuses a lockfile that does not match. And the test that keeps the browser template's packages bundled before its page loads treats an import of part of a package as an import of the whole package, which Vite does not. Once this phase closes, the landing agent reads the sync and its recovery in the skill it follows, and the guard turns red on an unlisted subpath import.

- [x] The landing instructions in the retrospective skill say that the install step first brings dependencies to the lockfile
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/retrospective.md` Step 10 item 7 (around :347): `pnpm install:local` now runs `pnpm install --frozen-lockfile` before it builds, so a merge that changed the lockfile installs without a hand-run `pnpm install`. Mirror the docs page's wording (`apps/docs/src/reference/skills/retrospective.md:247`). Resync `.claude/skills/retrospective/SKILL.md` in this phase and run `skill-sync-parity.test.ts` (apps/indusk-mcp/CLAUDE.md, skills rule). Audit finding: `audit.md`, "What else would have to change".

  </details>
- [ ] The same instructions say what a refused install means and how to recover from it
  <details><summary>Technical</summary>

  `--frozen-lockfile` refuses when `pnpm-lock.yaml` does not match the workspace's `package.json` files — trunk was committed with a lockfile out of step, which is not the merged-lockfile case the brief's second expectation measures. Item 7 says so: run `pnpm install` on trunk, commit the updated lockfile as its own commit, then rerun the install step; record the refusal on the retrospective's install line so the expectation's measure reads it. Add the recovery sentence to the docs page too. Audit finding: `audit.md`, "What does the code do that the brief never promised?"

  </details>
- [ ] The pre-bundle guard requires a subpath import to be listed as the subpath, not as its package
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts` `packageName`/`packagesIn` (:35, :68): keep a deep bare specifier whole (`@scope/name/sub`, `name/sub`) as Vite's `optimizeDeps.include` treats it as its own entry; a specifier equal to its package name is unchanged. A7 authored red first with a fixture subpath import against a list naming only the package. No template imports a subpath today, so A1 stays green. Audit finding: `audit.md`, "Does each row prove its promise's sentence".

  </details>

#### Build Phase 3 Verification

- [ ] The guard turns red on an unlisted subpath import and stays green on today's template, and the installed skill matches its source
  <details><summary>Technical</summary>

  A7 red then green: `pnpm exec vitest run src/__tests__/templates-prebundle.test.ts` from `apps/indusk-mcp` (A1, A5, A6, A7). `pnpm exec vitest run src/__tests__/skill-sync-parity.test.ts`. `biome check` on the changed files.

  </details>

#### Build Phase 3 Context

- [ ] The retrospective skill is the context for the landing change, so no line is added to the project instructions
  <details><summary>Technical</summary>

  (none needed — the landing rule is delivered by the skill the landing agent loads, edited above; the subpath rule lands in A7's failure message, as Build Phase 1 put A1's there.)

  </details>

#### Build Phase 3 Document

- [ ] The retrospective skill's docs page gains the recovery sentence for a refused install
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/retrospective.md` around :247, the sentence from the second item.

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
| `apps/docs/src/reference/skills/retrospective.md` | the install step; recovery from a refused install |
| `apps/indusk-mcp/skills/retrospective.md` + `.claude/skills/retrospective/SKILL.md` | the install step syncs first; recovery from a refused install |

## Dependencies
- None.

## Notes
- A4 is a `contract` row in the e2e suite, which `pnpm test` does not run; it is run by hand in Test Phase 1 and Build Phase 1.
