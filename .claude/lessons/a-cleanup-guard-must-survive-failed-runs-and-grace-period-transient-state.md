# A leftover-resource guard chained with && skips exactly the failing runs most likely to leak, and must tolerate things still shutting down

Two independent failure modes for a "check nothing was left behind" guard, both found in dusk's `test-daemons-never-leak` plan via falsification:

1. **`&&`-chaining skips the guard on failure.** `cmd && check-leftovers.js` means the guard never runs when `cmd` fails or crashes — exactly the runs most likely to leave something behind (a crash skips normal teardown). Run the guard unconditionally after the test command (dusk's fix: `with-daemon-guard.js` wraps the command and always runs the check after, pass or fail), not chained with `&&`.

2. **A single instant of process-list state produces false positives on things already shutting down.** The guard's first real run named a daemon that was gone a second later — a process mid-teardown, not a leak. A check that reads one snapshot and immediately fails cries wolf, and a guard that cries wolf gets switched off by the next person who hits it. Give the check a grace period (dusk re-checks for ~5 seconds and only names what's still running after that window) before reporting a leak.

Both apply to any "assert nothing was left running/open/locked after this test command" guard, not just telemetry daemons.
