# A cleanup/leak guard chained with && after tests is skipped on exactly the crashed runs most likely to leak — and a guard with no grace period cries wolf on a process still shutting down

Two failure modes for a post-test leak/cleanup guard:

1. **Chaining with `&&`** (`run-tests && check-for-leaks`) means the guard never runs when the tests themselves fail or crash — exactly the runs most likely to leave something behind. Run the guard unconditionally after the test command (e.g. `; node check-leaks.js` or a harness wrapper), not gated on success.
2. **No grace period** means a process still in the middle of shutting down (SIGTERM sent, not yet exited) gets reported as a leak on a single instantaneous process-list read. Give the guard a brief grace period / retry before declaring a leak.

Why: both bugs were found via falsification, not the original test plan — "report the leak" should have explicitly carried "even when the tests fail" as an assertion. A guard that cries wolf on transient shutdown timing gets switched off by frustrated developers, which defeats its purpose.

From the test-daemons-never-leak retrospective (apps/indusk-mcp, 2026-10-03), `with-daemon-guard.js`. See `.indusk/planning/archive/test-daemons-never-leak/` (now archived).
