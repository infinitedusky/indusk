# Monitor — Lessons

**Plan:** `.indusk/planning/archive/day-monitor/` · **Decision:** [Monitor](../decisions/day-monitor.md) · **Closed:** 2026-09-19

What the day-monitor plan taught that applies beyond it.

## A monitor's own failures are the ones it cannot see

The loop exists to notice when something stops happening — here, a commit the
evaluator never scored. Falsification found three ways the loop itself could
fail without a trace: the evaluator died on a missing `claude` before it could
mark anything; a bad answer from the query port crashed the reader instead of
reporting "unknown"; and marks from plan worktrees carried a project id the
trunk filtered out. Each looked, from the outside, exactly like a quiet week.

Hunt the silent failures of the watcher before trusting its silence: for every
"nothing happened", ask what would produce the same output if the watcher were
broken.

## Every spawn needs an `error` listener

A binary that cannot start emits `error` and never `close`. A spawn wrapped in
a promise that waits for `close` becomes an uncaught exception, and whatever
was meant to run after it — the promise mark — never does. Settle once from
either event, and give `stdin` an error listener too.

## A bundler follows `require.resolve` of a binary

The admin imported a read-only query, which imported the daemon module, which
resolved the Jaeger binary; Turbopack tried to parse the binary as source and
every page 500'd. Type-checking was clean. Keep modules that resolve or spawn
binaries out of any graph a web app bundles, and prove it by booting the app.

## Identity from a folder name breaks in worktrees

Plans run in `<project>-worktrees/<plan>`. Anything that must agree between the
trunk and its worktrees — a mark's project id — comes from the shared git
directory, not `basename(cwd)`.

## Run the real thing early

The facts that shaped the design came from running things, not reading them:
`claude` prints its errors on stdout; the evaluator already emitted spans, but
only when configured by hand; the admin's bundler choked on a binary; a
`spawnSync`'d CLI cannot reach a stub served by its own parent. Each took
minutes to find by running, and would have survived any amount of reading.

## What we'd do differently

- **Scope the formatter to the files you changed.** Directory-wide formatter
  runs swept an unrelated 1,456-line fixture and reformatted an admin file with
  the wrong config.
- **Make a fresh worktree test-ready.** The bundled admin is an ignored build
  artifact; a new worktree fails nine tests with no hint why.
- **Read the test plan against the tools' output shapes.** "`list_plans` shows
  it" assumed active plans listed their phases; they did not.
