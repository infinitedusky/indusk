---
title: "template-reload-on-cold-cache"
date: 2026-10-15
status: complete
---

# template-reload-on-cold-cache — Research

## Question

Why does the `instrumentation.web` template browser test fail in a root `pnpm test` on main, after main-suite-green had pre-bundled the dependency it was missing? And why does the `day-monitor` e2e test fail on today's `claude`?

## Background

main-suite-green closed (landed 2026-10-15, `c36f425a`) with the promise `the-everyday-suite-passes-on-main` confirmed `enforced`. The first root run on main afterwards exited 1 on one test: `templates/instrumentation.web.test.ts` A1, "a same-origin request from a click carries a traceparent in the click's trace". The error was `TypeError: Failed to fetch dynamically imported module …/instrumentation.web.ts?fresh=1`, after Vite logged `optimized dependencies changed. reloading` and Vitest warned that it "unexpectedly reloaded a test". A standalone rerun failed the same way, and the second rerun passed.

main-suite-green Build Phase 3 had met the same failure in its worktree and added `@opentelemetry/instrumentation-xml-http-request` to `optimizeDeps.include` in `apps/indusk-mcp/vitest.templates.config.ts`. Three root runs passed afterwards, so the fix was recorded as working.

## Findings

### The include list is never applied

Running the template tests on a cold cache (a fresh worktree) with `DEBUG=vite:deps`:

- The first optimizer pass bundled only `@opentelemetry/api` and `expect-type`, the two packages the scanner found from the test file's static imports. None of the ten packages in `optimizeDeps.include` was in it.
- About a second later, as the test page imported the template, Vite logged `new dependencies found: @opentelemetry/exporter-trace-otlp-http, @opentelemetry/sdk-trace-base, …`, re-bundled, and reloaded the page. The in-flight dynamic import of the template failed with the error above.

The cause is where the include list sits. `vitest.templates.config.ts` sets `optimizeDeps` on the root config and runs the test in `test.projects: [{ test: { name: "templates", browser: … } }]`. A Vitest project has a Vite config of its own and inherits nothing from the root unless it sets `extends: true`. So the browser project's server never saw the include list. That has been true since the list was written, not only since this week.

Build Phase 3's three green runs were a warm cache, not the fix. After one reload Vite's cache holds every package, so the next runs find nothing new. Whenever the cache is cold or invalidated, the reload comes back:

- a new checkout or worktree;
- a changed config (the root run on main came right after landing changed the include list, which invalidated the cache);
- a dependency update.

**Experiment:** adding `extends: true` to the templates project, then deleting `node_modules/.vite` before each of three runs, gave no `new dependencies found`, no reload, and 12 passed / 1 skipped every time. The experiment was reverted. No other package's vitest config sets `optimizeDeps`, and the admin's browser project has no include list, so the template config is the only one affected.

### day-monitor's error text belongs to Claude Code

`apps/indusk-mcp/e2e/day-monitor.e2e.test.ts:162` and `:169` expect the evaluator's failure, and `promises status` after it, to contain `issue with the selected model`. That is the text `claude` printed for an unknown model when the test was written. `claude` 2.1.296 prints `[claude-code:unrecognized_model] {"model":"claude-does-not-exist-9",…}`. The behaviour the test guards still works: the failure is recorded with `"error":true`, and `promises status` reports the violation. Only the wording it matches belongs to another program. The model name the test chose, `claude-does-not-exist-9`, appears in both versions' output.

### Landing's install does not sync dependencies first

`workflow.steps.land.install` is `pnpm install:local`, which runs `pnpm --filter @infinitedusky/indusk-mcp prepublishOnly && npm install -g ./apps/indusk-mcp` (root `package.json`). It builds from whatever `node_modules` the checkout has.

- **Failed:** component-content landed on 10-14 (`4088c4a0`). Type checking passed, then the admin's Next build failed prerendering `/_global-error` with `TypeError: Cannot read properties of null (reading 'useContext')`. Clearing `apps/indusk-admin/.next` did not help, and the landed build was not installed (that retrospective's last section).
- **Recovered:** the next landing, skip-reason-why, found that a `pnpm install` before `pnpm install:local` was enough (its retrospective).
- **Worked today:** main-suite-green's landing install (2026-10-15) exited 0.

So the install works when `node_modules` matches the lockfile and fails when a merge has changed the lockfile and nobody has synced. A null React context in a Next build is the usual sign of two React copies resolving, which a stale `node_modules` after a lockfile change produces (moderate confidence: component-content's retrospective did not confirm the cause). The fix that answers both readings is the one that worked by hand: sync to the lockfile before building.

## Decisions

- Fix the template config, not the test, and keep the include list: with `extends: true` the list does what it was written to do (Sandy, 2026-10-15, "let's do this", on the recommendation to fix the reload as a bugfix plan).
- Fold the day-monitor wording into this plan (Sandy, same exchange). Match the model name the test chose, not Claude Code's wording.
- Fold the landing install fix into this plan: `install:local` runs `pnpm install --frozen-lockfile` first (Sandy, 2026-10-15, "yes", on adding it here rather than opening a third plan).

## Open Questions

- None.

## Sources

- `DEBUG=vite:deps` cold-cache run in this plan's worktree, 2026-10-15, and three cold-cache runs with `extends: true`.
- The root run on main after main-suite-green landed (exit 1), and the two standalone reruns.
- Vitest projects docs: a project's config does not inherit the root's unless `extends: true`.
