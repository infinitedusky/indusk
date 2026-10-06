# Prefer a safe default + a leak guard over a remembered test-cleanup convention

A cleanup convention every test suite must remember ("call stopTelemetryForHome") failed silently twice — 2,058 orphaned telemetry processes on 2026-08-13, 860 on 2026-10-03, both found by accident, not by any check.

The fix: a safe default (INDUSK_SKIP_TELEMETRY_AUTOSTART in the everyday Vitest configs, so tests don't start a daemon unless they opt in) plus a guard that names any daemon still running in a temp home after the suite exits. When a side effect (a spawned process, a temp dir, a lock file) must be cleaned up, don't rely on every test author remembering to call the cleanup — make the default not create the side effect, and add a guard that catches the cases where something still did.

From the test-daemons-never-leak plan's retrospective, 2026-10-03.
