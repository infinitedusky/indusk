# A leftover-process guard chained with && skips exactly the crashed runs most likely to leak

A check for leftover daemon processes was chained after the test run with &&, which means it only ran when the tests passed — but a crashed or failed run is precisely when cleanup code is most likely to have been skipped, so the guard was absent exactly when it mattered most. Separately, a guard that reads one instant of the process list will report a daemon that's still in the middle of shutting down as a leak — a false positive that erodes trust and gets the check disabled.

Fix: run the leftover guard unconditionally after the test run (not chained with &&), e.g. via a wrapper like with-daemon-guard.js, and give it a grace period before declaring a process a leak. A flaky guard that cries wolf gets switched off; a guard that only runs on success never fires when needed.

Originated from the test-daemons-never-leak plan's retrospective.
