# Before re-running a suite with mass failures, check for a concurrent process holding shared state

The eval agent, grading a branch's commits, runs that branch's tests in the same worktree as a human's concurrent `pnpm test`. The eval's next.js dev server held the admin app's .next/ lock, producing 38-39 false admin HTTP failures — in isolation the same suite passed 343/343. The failure looked like a real regression but was actually two processes fighting over the same build directory.

Fix: when a test run produces a suspicious wave of failures (especially clustered in one app/package), check for another process in the same worktree before concluding the code is broken and re-running. This needs a structural fix of its own — evaluate against a snapshot, or make concurrent runs visible — but until then, diagnosis-by-inspection beats diagnosis-by-retry.

Originated from the test-daemons-never-leak plan's retrospective.
