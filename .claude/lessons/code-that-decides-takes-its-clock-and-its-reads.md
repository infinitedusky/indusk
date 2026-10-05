# Code that decides takes its clock and its reads — or its only test is a real server and a real wait

The admin's mark store called `Date.now()` and read Jaeger by name. The only way to test "a late run is still read" was to boot `next dev` and a real Jaeger, record a run, sleep six seconds past a cache, and reload the page. Eight files like that took 216 of the admin suite's 255 seconds, and forced the root suite to run its packages one after the other.

Why it matters: every one of those assertions was a rule — given these runs and this time, the chip is red — and a rule needs neither a server nor a wait. A test that can only reach its rule through a running system is slow, flaky under load, and still misses what it does not drive: the unit test that replaced the slow-window HTTP test found, in under a second, that a tail read spending the whole budget stopped the window from ever being read further — the HTTP test's slow proxy never slowed the tail.

What to do: give code that decides an optional last argument with its clock and its reads (`now`, `resolve`, `read`, `probe`), the real ones by default. Test it with a fake that answers from a list and a clock the test moves. Keep one test against the real system for the contract with it, in the system tier. Guarded by `apps/indusk-admin/src/lib/__tests__/promise-store.test.ts` and `promise-health.test.ts` (test-kinds A4–A12).
