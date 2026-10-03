# Parallelizing one package's test suite can starve a sibling package's timing-sensitive tests under turbo — run `pnpm test` combined on trunk right after changing how any package's tests run

watch-reopen-collision's "Getting to Done" (retrospective, `.indusk/planning/archive/watch-reopen-collision/`) found that a same-day, separately-merged change (the fix/vitest-parallel migration, making `apps/indusk-mcp`'s vitest files run in parallel across every core) broke the root `pnpm test` run — but only when run combined, not per-package. `turbo test` ran the admin package's suite at the same time as the newly-parallel indusk-mcp suite; the admin's real-Jaeger HTTP tests are timing-sensitive and timed out under the combined core load (3 failed; 8/8 passed when the admin suite ran alone).

The test-tier merge had been verified by running each package's tests separately — a reasonable-looking check that missed the actual failure mode, which only appears under turbo's cross-package concurrency.

The fix: root `pnpm test` now runs `turbo test --concurrency=1` (confirmed in `package.json`), so packages run one after another instead of turbo scheduling both suites' workers across all cores simultaneously.

**How to apply:**
1. Any time you change how one package's test suite is parallelized, scheduled, or how many workers it spawns, run the **combined** root test command (`pnpm test`, not `pnpm --filter <pkg> test`) on trunk immediately after — per-package verification cannot see interference between siblings.
2. Timing-sensitive tests (real network calls, real daemons, anything with a timeout) are the ones that surface this first; a package with only pure unit tests may look fine under the same change.
3. If a change like this must ship, consider whether the root runner should serialize packages (`--concurrency=1`) rather than relying on each package's own suite to be well-behaved in isolation.

See `.indusk/planning/archive/watch-reopen-collision/retrospective.md` ("Getting to Done", "What We Learned", "What We'd Do Differently") and root `package.json`'s `test` script.
