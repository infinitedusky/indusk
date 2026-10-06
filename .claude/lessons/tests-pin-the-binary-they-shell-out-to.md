# A test that shells out to a bare command name runs whatever is on PATH, not the code under test — pin the binary in the test environment

dusk's everyday test suite had hooks that ran `indusk telemetry register` via a bare command name. That resolved from PATH to the developer's global install (1.57.2), not the code under test — so the hooks always exercised whatever happened to be installed on the machine, never the working tree. The suite's hook coverage was silently testing the wrong binary the entire time this went unnoticed.

Found during test-daemons-never-leak (dusk plan, archived at `.indusk/planning/archive/test-daemons-never-leak/`), fixed by setting `INDUSK_BIN` in both everyday Vitest configs to pin the binary explicitly.

**How to apply**: whenever a test or test-support script shells out to a tool by bare name (not an absolute path or an explicitly-resolved binary), check what actually gets invoked — `which <name>` in the test's env, or trace the spawn. If the tool has both a global/system install and a workspace build, the test environment must pin to the workspace one explicitly (an env var override, an absolute path from the build output), or the test is exercising an untested artifact.
