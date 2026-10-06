# A test that shells out to a bare command name runs whatever is installed, not the code under test — pin the binary

Tests that invoke a CLI via a bare command name (e.g. `indusk telemetry register` from an extension hook) resolve that name from the test process's PATH — the developer's globally installed version, not the workspace build. This silently decouples the test from the code under test: the suite can be green while exercising a stale global install.

Fix: pin the binary explicitly in the test environment (e.g. `INDUSK_BIN` env var honored by hook commands, set in every test config that shells out). Applies to any test suite that shells out to a project CLI from a hook, fixture, or helper — not just telemetry.

From the test-daemons-never-leak retrospective (apps/indusk-mcp, 2026-10-03): the everyday Vitest suite's hooks always exercised the developer's global 1.57.2 install because `indusk telemetry register` resolved from PATH, not the workspace build. See `.indusk/planning/archive/test-daemons-never-leak/` (now archived).
