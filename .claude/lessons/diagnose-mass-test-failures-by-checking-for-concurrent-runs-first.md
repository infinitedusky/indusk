# A sudden mass of failures in one area (e.g. 38-39 admin HTTP tests) may be a concurrent process holding a shared lock (like `.next/`), not a real regression — check for another process before re-running or debugging the "bug"

The eval agent, grading a branch's commits, runs that branch's tests in the same worktree a person is using. Its `next dev` held the admin's `.next/` lock and produced 38-39 false admin HTTP failures inside a person's concurrent `pnpm test` run (which passed 343/343 when run alone). The failure pattern — a large, suspiciously uniform block of failures all in one subsystem — is itself the signal: a real regression rarely fails that cleanly and that completely.

Before treating a mass failure as a real bug, check whether another process (an evaluator, another test run, a dev server) is running concurrently in the same worktree and could be holding a shared resource. This needs a structural fix — evaluate against a snapshot, or make concurrent runs visible — but until that lands, this is a diagnostic habit: suspicious mass failures get a process-list check before a debugging session.

See the day-monitor plan's test-daemons-never-leak Maintenance work (dusk).
