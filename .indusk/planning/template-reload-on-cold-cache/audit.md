---
plan: template-reload-on-cold-cache
audited: 2026-10-15
model: claude-opus-5-5
---

# Audit — template-reload-on-cold-cache

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts:35` — Narrower. A1, A5 and A6 are this plan's trajectory rows holding `a-browser-test-passes-on-a-cold-cache` (the browser template tests pass on the first run after Vite's cache is cleared, with no reload). A1 asserts that every package the browser files import is named in the pre-bundle list the project sees, A5 that the import scan finds side-effect, non-OpenTelemetry, re-export and dynamic imports, and A6 that the scan covers every file the project's globs match plus their local imports. All three check package names in a config file, not what Vite does. `packageName` collapses a subpath import (`pkg/sub`) to `pkg`, so a template that imports a subpath passes the guard when only the bare package is listed, while Vite treats the subpath as a separate entry it can still find mid-run. Nothing in the three rows would catch that reload.
- `apps/indusk-mcp/src/__tests__/templates-prebundle.test.ts:129` — Narrower. A1 models inheritance as "root list when `extends: true`, else the project's own", reading the config statically. It does not check that the listed names resolve, or catch dependencies Vite discovers that the test files never import directly, such as runner or provider modules Vitest injects into the page. Passing A1 proves the list is complete by this model, not that no reload happens.
- `apps/indusk-mcp/templates/instrumentation.web.test.ts:182` — Narrower. A2, the live-check row asserting three runs from a deleted Vite cache pass with no reload warning, is the only row that observes the promise itself. It ran once on one machine, and each run had one test skipped: A11, `it.skip` at this line. So the promise holds for the tests that run today, not for "the browser template tests" as a whole. Nothing reruns A2, so a later reload is caught only by A1's narrower name check.
- `apps/indusk-mcp/src/__tests__/install-local.test.ts:24` — Narrower. A3, the row holding `landing-installs-after-a-dependency-change`, asserts that the `install:local` string in `package.json`, split on `&&`, begins with `pnpm install --frozen-lockfile` before the `prepublishOnly` step, and that `.indusk/config.json` names `pnpm install:local` as landing's install. It never runs an install after a dependency change. The impl's own run of the script (commit 9fe7c7891) ran the first two parts but not `npm install -g`, so "installs the landed build" has never been seen end to end. Landing is an agent following the retrospective skill, and nothing proves it runs this step on trunk after the merge.

## What does the diff change that no row touches?
- `apps/indusk-mcp/vitest.templates.config.ts:37` — `extends: true` makes the templates project inherit everything in the root config, not just `optimizeDeps`. That includes `test.passWithNoTests: true` and any plugin, `resolve` or `define` added to the root later. No row covers what else the project now inherits. If someone adds a root setting meant for something else, it reaches the browser project silently.
- `package.json:10` — `pnpm install --frozen-lockfile` now runs whenever anyone runs `install:local`, not only at landing. It also runs any workspace lifecycle scripts and prunes or relinks `node_modules` across the whole workspace before the build. A3 checks only where the step sits in the string; nothing would notice if those side effects changed.
- `apps/docs/src/reference/skills/retrospective.md:247` — the docs text describing landing's install has no row. It is prose, and nothing ties it to the script if the script changes again.

## What does the code do that the brief never promised?
- `package.json:10` — `--frozen-lockfile` makes landing refuse when the merged `package.json` and `pnpm-lock.yaml` disagree. The brief's promise says only that landing "brings the checkout's dependencies to the lockfile". Expectation 2 says no landing needs a hand-run `pnpm install`. Refusing is a new way for landing to fail, and recovering means a hand-run `pnpm install`, which is the outcome Expectation 2 rules out. The test plan names the refusal (in A3's wording); the brief does not.
- `apps/indusk-mcp/e2e/day-monitor.e2e.test.ts:182` — the approved impl named lines 162 and 169 for the model-name change. The diff also changes the incident-content assertion at line 182. The brief's "Not promised" line covers the day-monitor wording fix in general, so this is within the brief's intent. It goes beyond the approved impl's scope line, though, and was added mid-build (commits bde1e0da9 and 995e76ad2).

## Which rejected ADR alternative does the code quietly take?
- nothing

## Which skip reason would you not accept?
- nothing

## What else would have to change for each promise to hold?
- `apps/indusk-mcp/skills/retrospective.md:347` — the landing instructions the agent actually follows (step 7, "Install the landed build"), and the installed copy at `.claude/skills/retrospective/SKILL.md:347`, still describe `pnpm install:local` as something that "builds what a publish builds and links the checkout into the global `indusk`". Only the docs page was updated. `landing-installs-after-a-dependency-change` relies on this step running on trunk after the merge, and the skill text does not mention the dependency sync or what to do when the lockfile is refused.
- `.indusk/planning/known-issues.md:212` — the known issue "Landing a plan that adds a dependency breaks `pnpm install:local`" describes exactly what this plan fixes, and the plan does not touch it. It stays listed as open after this plan lands.
- `apps/indusk-mcp/vitest.templates.config.ts:15` — the root `optimizeDeps.include` list is hand-maintained. It sits above a project that now inherits it, but `a-browser-test-passes-on-a-cold-cache` holds only while every later template import is added here. Only A1's name check enforces that, and it has the subpath gap noted above.
