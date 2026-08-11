# Give real-git/real-subprocess integration tests an explicit 30s timeout, not vitest's 5s default

A test that builds a real repo and spawns multiple git (or other) subprocesses can exceed vitest's 5s default under load, even though the logic is correct — the failure is pure test-infra flake, not a bug. A flaky tripwire trains the reader to ignore it, which is worse than not having the check at all.

Fix: pass an explicit timeout as the test's second `it(...)` arg — `30_000` has been the working number both times this has come up.

Seen twice in dusk: `apps/indusk-mcp/src/lib/run/swap.test.ts:222` (dawn-hook-parity — an end-to-end run through a 2→3-script gate chain, one spawn per edit) and `apps/indusk-mcp/src/lib/shape/*.test.ts` (lifecycle-rebalance Phase 2 — A5/A8/A10/A11/A12 build a real repo and spawn ~10 git subprocesses each). Both fixes were timeout-only: no assertion text and no trajectory/state changed, because the test was already correct — only vitest's default budget was wrong for the workload.

When authoring or reviewing a test that shells out to git (or spawns any real subprocess) more than once or twice per case, set the timeout up front rather than waiting for the first flaky CI run to surface it.
