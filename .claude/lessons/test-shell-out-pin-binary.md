# Tests that shell out to a bare command name silently run the global install, not the code under test

A test suite's init-extension hook ran `indusk telemetry register` as a bare command, which resolved from PATH to the globally-installed 1.57.2 — not the code under test. The everyday suite's hooks were exercising the developer's global install the whole time, and this went unnoticed because the test passed either way.

Fix: pin the binary under test via an explicit env var (INDUSK_BIN) read by both everyday test configs, instead of relying on PATH resolution. Before trusting that a switch or fix "reached" a code path, check which binary a test actually invokes — a passing test that shells out to a bare command name may be validating the wrong artifact.

Originated from the test-daemons-never-leak plan's retrospective; the same report's hindsight note observed A1 sat red for this exact reason — hooks ran the global CLI, not the local build.
