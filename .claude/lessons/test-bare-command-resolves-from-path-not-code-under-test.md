# A test that shells out to a bare command name runs whatever is on PATH, not the code under test — pin the binary in the test environment

During test-daemons-never-leak (dusk), the everyday test suite's init-extension hook ran `indusk telemetry register` as a bare command. Node resolved it from PATH — the developer's globally-installed 1.57.2 — not the package build under test. Every test that exercised this hook was silently exercising the wrong binary; the switch meant to fix the leak (see [[a-per-call-cleanup-convention-is-not-a-fix-for-a-background-process-a-test-triggers]]) landed in the source tree but the hook kept calling the old global install, so the fix sat dark until someone checked which binary actually ran.

**Why:** shelling out by bare name (`execSync("indusk ...")`, `spawn("mytool", ...)`) depends on PATH resolution order, which is a property of the machine running the test, not the code change under review. A test can pass — or a regression can hide — entirely because of what else happens to be installed globally.

**How to apply:** when a test (or a hook a test triggers) shells out to this project's own CLI or any in-repo binary, pin it explicitly — an env var read at the call site (dusk's fix: `INDUSK_BIN`, set in the everyday Vitest configs) that overrides the bare prefix, rather than relying on PATH order. Before trusting a "the fix works" test result for anything that shells out, check which binary it actually invoked (`which <cmd>` inside the test, or log the resolved path) — don't assume the source tree's copy ran just because the source tree changed.

See `.indusk/planning/test-daemons-never-leak/brief.md` and `.../test-plan.md`.
