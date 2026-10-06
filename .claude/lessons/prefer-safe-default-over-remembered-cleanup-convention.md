# A cleanup step every test suite must remember to call fails silently — ship a safe default plus a guard that names the leak, not a convention

A convention like "call stopTelemetryForHome() in every test suite's teardown" degrades silently: nobody gets an error when they forget, they just leak. This happened twice in dusk — 2,058 orphaned telemetry processes on 2026-08-13, 860 on 2026-10-03 — both found by accident, not by a failing check.

The fix that held: a safe-by-default environment variable (`INDUSK_SKIP_TELEMETRY_AUTOSTART` in the everyday Vitest configs) so most suites never spawn a daemon at all, plus a guard that runs after every suite and names any daemon still alive in a temp home. Prefer "default + guard" over "remembered convention" whenever a resource (process, lock, temp dir) can leak across test runs — the guard is what turns a silent leak into a loud, attributable failure.

See the day-monitor plan's test-daemons-never-leak Maintenance work (dusk).
