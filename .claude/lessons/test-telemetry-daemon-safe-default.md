# Default test config to skip telemetry autostart, don't rely on a remembered cleanup call

A cleanup convention every test suite was supposed to remember ("call stopTelemetryForHome") failed silently twice — 2,058 orphaned telemetry processes found by accident on 2026-08-13, then 860 more on 2026-10-03. Conventions that depend on every test author remembering a teardown call don't scale; they fail invisibly until someone notices the process table.

Fix: make the safe behavior the default, not an opt-in. Set INDUSK_SKIP_TELEMETRY_AUTOSTART in the everyday Vitest configs so tests don't spin up daemons unless they explicitly ask to, and pair it with a guard that names any daemon left running in a temp home. Prefer default+guard over a remembered convention — a convention is a promise a human makes to future code; a default is a promise the code makes to itself.

Originated from the test-daemons-never-leak plan's retrospective.
