# A test fixture that sets process.env in its constructor and restores it in cleanup() races every other fixture instance alive at the same time — scope the env var per-call, not per-process

`apps/indusk-mcp/src/lib/bookkeeping/fixture.test-support.ts`'s `makeFixture()` sets `process.env.INDUSK_HOME = home` when it is constructed and restores the previous value only when its `cleanup()` runs. Any second fixture created before the first calls `cleanup()` — whether from a concurrently-running test in the same file, or from an earlier test whose `afterEach` hasn't fired yet — overwrites `INDUSK_HOME` out from under the first fixture's in-flight assertions.

Observed in bookkeeping-lives-where-it-is-read (commit 0cbf69b9, Build Phase 1 rows written): running `notes.test.ts` + `home.test.ts` three times in a row against the identical, unchanged code produced 7 failed/2 passed, then 5 failed/4 passed, then 0 failed/9 passed. The checklist item claimed "all nine cases red on their assertions" — a claim about a deterministic state that the suite cannot actually produce reliably, because the result depends on scheduling, not on the code path under test.

**Why it matters:** a red/green claim recorded in an impl's Verification note is supposed to be reproducible evidence. A fixture that globally mutates `process.env` turns "red" and "green" into a coin flip, and nobody who re-runs the suite later will get the same answer the author saw — including `indusk verify`'s red-test detection, which runs the same command and trusts its exit code.

**What to do instead:** thread `INDUSK_HOME` as an explicit `env` object passed to each call that needs it (the way `apps/indusk-mcp/src/__tests__/helpers/cli.ts`'s `runCli(cwd, args, env)` already does elsewhere in this package), rather than mutating `process.env` and relying on `cleanup()` to run before the next fixture is built. Any fixture or helper that sets a process-global for the duration of a test is a latent race the moment two instances can be alive at once — which Vitest does not prevent within a single file by default.

See `.indusk/planning/bookkeeping-lives-where-it-is-read/impl.md`, Build Phase 1.
