# The eval agent grading a branch's commits runs that branch's own tests in the same worktree a person may be testing in concurrently — a shared dev-server lock (e.g. `.next/`) turns into false mass failures that look like real regressions

During the test-daemons-never-leak plan (`.indusk/planning/archive/test-daemons-never-leak/`), two full test runs showed 38–39 admin HTTP test failures that had nothing to do with the plan's changes — the admin suite alone was 343/343. The cause: the evaluator, grading this branch's commits, was running the admin's HTTP tests in the same worktree at the same time as a person's concurrent `pnpm test`; its `next dev` held the app's `.next/` lock, and the person's run collided with it.

This was diagnosed correctly — by finding the other process holding the lock, not by re-running the suite until it went green — but the retrospective explicitly flagged it as a hazard of its own, not fixed by this plan: "it should run against a snapshot, or a person's run should know it is there. Not this plan's to fix; recorded for a plan of its own."

**How to apply:** when a test run inside this repo shows a cluster of failures concentrated in one app/package (especially dev-server-backed suites like Next.js, with shared build locks or caches), suspect a concurrent process in the same worktree before suspecting the diff — check for another `next dev`, another test runner, or another agent (`indusk agent list`) before re-running or investigating the diff as the cause. This is a known open hazard, not yet mitigated by snapshot isolation or mutual visibility between the evaluator and a human's concurrent run.

See `.indusk/planning/archive/test-daemons-never-leak/retrospective.md` ("Getting to Done", "Insights Worth Carrying Forward").
