# A test that shells out to a bare command name (e.g. `indusk ...`) runs whatever is installed globally, not the code under test — pin the binary in the test environment

dusk's test-daemons-never-leak plan (`.indusk/planning/archive/test-daemons-never-leak/`) found that setting `INDUSK_SKIP_TELEMETRY_AUTOSTART=1` for the everyday Vitest suite changed nothing — trajectory row A1 stayed red. The cause: `init`'s extension hook runs the shell command `indusk telemetry register`, and bare `indusk` resolves from `PATH` to whatever is globally installed on the developer's machine (1.57.2), not the package's own built CLI under test. The everyday suite's extension hooks had always been exercising the developer's global install, silently — a switch read by the in-repo code never had a chance to matter because the in-repo code never ran.

The fix: both packages' everyday Vitest configs now set `INDUSK_BIN` to the package's own built CLI, and the code that shells out reads that variable instead of assuming `indusk` on `PATH`.

**How to apply:** when a test suite shells out to a CLI by bare command name (not a resolved path), and that CLI is also the package being developed, verify which binary actually runs before trusting that an environment switch or code change reached it — `which <cmd>` or an explicit version print inside the test. Prefer pinning the binary via an explicit env var / resolved path in the test harness over relying on `PATH` resolution, especially once the CLI is also installed globally (via `npm link`, a global install, or a prior `pnpm install -g`) on the machine running the suite.

See `.indusk/planning/archive/test-daemons-never-leak/retrospective.md` ("Getting to Done") and `brief.md`.
