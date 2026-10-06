# The eval agent runs a branch's tests in the same worktree a concurrent dev session is using — diagnose mass failures by checking for the other process first

The evaluator, grading a branch's commits, runs that branch's tests in the same worktree the branch's own dev session may still be using. One case: the evaluator's `next dev` held the admin app's `.next/` lock, producing 38-39 false admin HTTP test failures in a person's concurrent `pnpm test` run (the same suite passed 343/343 run alone).

When a test run shows a suspicious mass of failures concentrated in one app/area, check for another process holding a lock or port in the same worktree before concluding the code is broken. This needs a structural fix (evaluate against a snapshot, or make concurrent runs visible/serialized) — until then, treat correlated mass failures as a signal to check `ps`/lsof before re-running or bisecting.

From the test-daemons-never-leak plan's retrospective, 2026-10-03.
