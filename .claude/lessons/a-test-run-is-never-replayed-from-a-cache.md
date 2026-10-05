# A test run is never replayed from a cache — a cache keys on the files it was told about, and a test can read others

turbo cached the `test` task, keyed on each package's own files. The never-wait guard lives in mcp and reads the admin's test files; a change that only added a server-booting admin test left mcp's key unchanged, so turbo replayed mcp's last green and the guard never ran. The same replay made a root `pnpm test` take seconds, which the suite's speed promise would have marked as a fast suite.

Why it matters: a replayed result answers a question about an older tree. Any test that reads beyond its package — a guard, a parity check, a registry check — goes stale silently, and it is exactly those cross-cutting checks that catch what one package's tests cannot.

What to do: set `"cache": false` on the test task. A test run is a question asked now; the whole everyday suite costing a minute is the price, and the speed promise watches it. Guarded by `apps/indusk-mcp/src/__tests__/turbo-test-not-cached.test.ts` (test-kinds A20), which asks turbo itself (`--dry=json`), so a package-level override is seen too.
