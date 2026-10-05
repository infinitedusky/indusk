# The everyday suite never waits — a test that starts a server or sleeps belongs in the system tier

Every phase ran the whole suite, and the whole suite took five minutes: eight admin files booted `next dev` and real Jaeger servers, then slept past caches, to check rules about what a chip shows. Each file was reasonable alone. Nothing stopped the ninth, and their load forced the root suite to run its packages one after the other.

Why it matters: the everyday suite answers "is this rule right?" at every phase, so its cost is paid many times a day. A test that waits for a real system answers a different question — does our code still fit Next, Jaeger, the OS — which only needs asking at landing and on release. Mixing the two made every phase pay for the rare question.

What to do: give the rule its clock and its reads as inputs and test it with fakes (`code-that-decides-takes-its-clock-and-its-reads`); a test that must start a server, a detached process or wait on the wall clock goes in its package's `vitest.tiers.ts` `SYSTEM`, which `pnpm test:system` runs at landing and release. Guarded by `apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts` (test-kinds A14), which reads both packages' everyday files and names the file, line and call.
