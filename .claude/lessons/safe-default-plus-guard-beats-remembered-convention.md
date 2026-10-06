# A cleanup convention every test suite must remember will fail silently — ship a safe default plus a guard instead

If correctness depends on every test file remembering to call a cleanup step (e.g. "call stopTelemetryForHome in every suite"), it will eventually be forgotten, and the failure is silent — nothing turns red, resources just leak. dusk's telemetry daemon leaked 2,058 orphaned processes on 2026-08-13 under exactly this convention, and 860 more on 2026-10-03 after the convention was still in place but a new suite forgot it. Both were found by accident (someone noticed the machine was slow), not by a test failing.

The fix that held: a **safe default** that makes the dangerous behavior opt-in rather than opt-out (tests never auto-start a daemon unless they explicitly ask), plus a **guard** that names any leftover by PID/kind when a test run finishes, so a regression is loud instead of silent. See `.indusk/planning/archive/test-daemons-never-leak/retrospective.md` for the full implementation (`INDUSK_SKIP_TELEMETRY_AUTOSTART`, `check-test-daemons.js`, `with-daemon-guard.js`).

Generalizes beyond telemetry: any "please remember to clean up X" rule in a test suite (temp files, ports, background processes, DB connections) is a candidate for the same treatment — default it off, and add a guard that names what's left rather than trusting every author to remember.
