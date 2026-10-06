# A leftover-resource guard chained with && after tests is skipped on exactly the crashed/failing runs most likely to leak — run it unconditionally, and give it a grace period or it cries wolf

`test-daemons-never-leak` initially wired its orphaned-telemetry-process guard as `pnpm test && node check-test-daemons.js` — chained after the test command. The && short-circuits on any test failure or crash, which is exactly when a background process is most likely to be left behind (the normal cleanup path in `afterAll`/`afterEach` never got to run). So the guard that exists specifically to catch leaks skips itself on the runs most likely to have one.

The second failure mode cuts the other way: a guard that reads the process list at one instant right after the test run ends can catch a daemon that is still in its normal shutdown sequence (sent SIGTERM, hasn't exited yet) and report it as a leak. A guard with false positives like that gets disabled by a future developer annoyed at flaky red — which is worse than not having the guard, because the failure mode goes back to silent.

**How to apply:** when adding an end-of-suite guard for a leaked background resource (process, temp file, open port, lock), run it unconditionally after the test step — not chained with `&&` — so it also fires on failed/crashed runs. Give it a grace period (poll for a few seconds, not one instant) before declaring something still shutting down a leak. Both properties were added to `with-daemon-guard.js` only after falsification caught the gap the test plan's original wording ("report the leak") hadn't specified "even when the tests fail."

See `.indusk/planning/test-daemons-never-leak/test-plan.md`, `apps/indusk-mcp/scripts/with-daemon-guard.js` (or equivalent).
