# Prevent test daemon leaks with a safe default + a guard, not a remembered convention

A cleanup convention every test suite must remember ("call stopTelemetryForHome") failed silently twice — 2,058 orphaned telemetry processes on 2026-08-13, 860 on 2026-10-03, both found by accident, not by a failing test.

Why: a remembered per-suite cleanup step has no enforcement; it only has to be forgotten once per suite, and leaks compound silently across CI runs until someone notices the process table.

Two more failure modes found in the same incident:
1. Tests that shell out to a bare command name (e.g. `indusk telemetry register`) resolve from PATH, not from the code under test — the everyday suite's hooks were exercising the developer's globally-installed CLI, not the local build. Pin the binary explicitly in the test environment (`INDUSK_BIN`) so a test exercises what it claims to.
2. A leftover-check chained after tests with `&&` is skipped on exactly the failing/crashed runs most likely to leave leftovers — that's precisely when you need it. Run the guard after failure too (not just on success), and give it a grace period before flagging, or a process still shutting down reads as a false leak and the guard gets switched off as noisy.

How to apply: for any test suite that can spin up a background process (daemon, server, watcher), default to not starting it (`INDUSK_SKIP_TELEMETRY_AUTOSTART` here), pin any CLI binary the tests shell out to, and run a post-suite leak guard unconditionally (both pass and fail paths) with a grace period — never rely on "the test file calls cleanup" as the only line of defense. See `.indusk/planning/archive/test-daemons-never-leak/` for the full incident and fix.
