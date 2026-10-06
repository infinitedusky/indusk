# A test that shells out to a bare command name runs whatever is on PATH, not the code under test — pin the binary explicitly

dusk's everyday test suite ran `indusk telemetry register` (via init's extension on_enable hook) by bare command name. That resolved from PATH to the developer's globally-installed 1.57.2, not the code under test — so the suite's hooks always exercised the installed CLI, and a fix landed in the repo's source could sit red indefinitely (A1 in test-daemons-never-leak) without the test noticing, because the test never actually invoked the changed code.

**How to apply:** when a test spawns a CLI/binary that the project also builds, do not rely on PATH resolution — pin it explicitly (e.g. an `INDUSK_BIN` env var set in the test spawn helper) so the test always exercises the local build. Before trusting that a code change reached a test via a shelled-out command, verify which binary actually ran — don't assume the fix is covered just because a test for that code path exists and passes.

See `.indusk/planning/test-daemons-never-leak/brief.md` and `test-plan.md` (A1, INDUSK_BIN in the everyday Vitest configs).
