# A leftover-check chained with && after tests is skipped on exactly the runs most likely to leave leftovers

A leak/leftover-check script run as `test && check-leftovers` never executes when the test command fails or crashes — precisely the runs most likely to leave orphaned state behind. Separately, a check that reads the process list at one instant will report a process that's still shutting down (not leaked) as a leak, producing false positives.

Fix: run the guard unconditionally after tests, success or failure (with-daemon-guard.js pattern — use a shell construct that always runs the check, not &&), and give the check a grace period before declaring something leaked. A guard that cries wolf on normal shutdown timing gets disabled by the next person who hits it, which defeats the point of having it.

From the test-daemons-never-leak plan's falsification phase, 2026-10-03 — the test plan should have specified "report the leak even when the tests fail" explicitly; falsification caught the && skip that Build Phase 1 had written.
