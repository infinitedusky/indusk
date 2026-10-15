---
title: "Tests and landing work from a cold machine"
date: 2026-10-15
status: draft
workflow: bugfix
description: "Makes the browser template tests pass on the first run after Vite's dependency cache is cleared, and makes landing install the landed build even when the merge changed dependencies, so neither a fresh checkout nor a merged lockfile turns `pnpm test` or the install red. Also brings the day-monitor end-to-end test up to the error text today's `claude` prints."
---

# Tests and landing work from a cold machine — Brief

## Expectations

1. **A root `pnpm test` on main no longer fails on the template test.**
   - Measure: root runs on main and at landings, each checked for `instrumentation.web` failures and Vite's "unexpectedly reloaded a test" warning (today: the first root run on main after main-suite-green landed failed on it).
   - Look: at the next three plan landings.
2. **No landing needs a hand-run `pnpm install` before its install step succeeds.**
   - Measure: each landing's install step (`pnpm install:local`), read from its retrospective's install line (today: component-content's failed on 10-14 and was recovered by hand).
   - Look: at the next three plan landings.

## Promises

### This plan makes

1. **`a-browser-test-passes-on-a-cold-cache`** (state). The browser template tests pass on the first run after Vite's dependency cache is cleared, with no page reload partway through the run.
2. **`landing-installs-after-a-dependency-change`** (state). Landing's install step brings the checkout's dependencies to the lockfile before it builds, so it installs the landed build even when the merge changed dependencies.

### Existing promises

**Must not break**

- **`the-everyday-suite-passes-on-main`**. A cold cache made a root run on main red; this plan restores it.
- **`a-click-and-its-server-work-share-a-trace`**. Its test is the one that failed, `instrumentation.web` A1. The test and the template stay as they are; only the configuration that runs them changes.
- **`a-propagation-entry-covers-what-it-names`**. Its tests run in the same browser project.

**Changes**

None.

**Replaces**

None.

### Not promised

- That the end-to-end tests match whatever Claude Code prints next. The day-monitor test stops matching Claude Code's wording and matches the model name it chose, which stays the same across versions. This is a test fix, not a promise.

## Looks

None — this plan changes a test configuration, an end-to-end test's assertion and the root install script; nothing under an app's interface.

## Depends On
- None.

## Blocks
- None.
