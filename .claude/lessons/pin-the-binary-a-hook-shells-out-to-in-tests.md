# A test that shells out to a bare command name (e.g. `indusk telemetry register`) runs whatever is on PATH, not the code under test — pin it with an env var like INDUSK_BIN

init's extension hook ran `indusk telemetry register` resolved from PATH, which on a developer's machine is the globally installed version (1.57.2) — not the workspace build the test suite is supposed to be exercising. The suite's hooks were silently testing the developer's global install the whole time, and a real bug (A1) sat red because the switch under test never reached the code path it was meant to change.

Whenever a test spawns a subprocess by bare command name, that command resolves through the test runner's PATH, which is environment-dependent and not the same binary CI or `pnpm test` would otherwise assume. Pin it explicitly — dusk's fix was `INDUSK_BIN` in both everyday Vitest configs, overriding the bare prefix in hook commands. Before trusting "this test exercises my change," check which binary the test actually invokes.

See the day-monitor plan's test-daemons-never-leak Maintenance work (dusk).
