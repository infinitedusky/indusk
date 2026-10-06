# Mass test failures in one run but not another often mean a concurrent process is sharing state (a lockfile, a .next/ build dir) — look for the other process before re-running

The eval agent, grading a branch's commits, runs that branch's tests in the same worktree as a human's concurrent `pnpm test`. The two runs collided on the admin app's `.next/` lock, producing 38-39 false HTTP failures in one run while the same suite passed 343/343 run alone. The failure pattern (a cluster of unrelated-looking failures, all in one subsystem, non-reproducible alone) is the signature of a shared-resource collision, not a real regression.

**How to apply:** when a test run shows a block of failures that don't individually make sense (especially concurrent HTTP/build-artifact/lock-related errors), check for another process running against the same worktree (`ps`, lockfiles, `.next/`, port binding) before concluding the code is broken and before just re-running to "see if it's flaky." This needs a structural fix (evaluate against a snapshot, or make concurrent runs visible/blocked) — noted as still open in test-daemons-never-leak's retrospective.

See `.indusk/planning/test-daemons-never-leak/` retrospective notes, 2026-10-03.
