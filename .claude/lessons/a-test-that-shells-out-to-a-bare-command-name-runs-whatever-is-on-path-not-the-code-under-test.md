# A test that shells out to a bare command name runs whatever is on PATH, not the code under test — pin the binary in the test environment

test-daemons-never-leak found that `init`'s extension hook ran `indusk telemetry register`, resolved from PATH to the globally installed 1.57.2 — so the everyday suite's hooks always exercised the developer's global install, never the code under test. A1 sat red for this reason: the switch the fix introduced lived in the repo's own code, but the test invoked the binary by bare name, so it never reached the switch.

**How to apply:** when a test spawns a CLI by name (`indusk`, `git`, any bare command) rather than an absolute path, check which binary actually resolves before trusting that an environment switch or code change reached it. Pin the binary explicitly in the test environment (this project's fix: `INDUSK_BIN` set in both everyday Vitest configs) rather than relying on PATH resolution order. This generalizes beyond telemetry: any test asserting on a code change's effect, where the exercised process is spawned by bare name, is silently testing the installed version instead of the worktree.

Related: [[a-per-call-cleanup-convention-is-not-a-fix-for-a-background-process-a-test-triggers]] (the same incident's other root cause — a convention without enforcement).
