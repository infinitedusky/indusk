# Test Kinds

Every phase waited about five minutes on `pnpm test`. 216 seconds of that were
eight admin files that booted `next dev` and real Jaeger servers to check rules
about what a chip shows. Their load also forced the root suite to run its
packages one after the other. The cause was two of our own rules taken
together: "assertions are behavioural" and "prefer the boundary for a real
red" turned into "test every rule through the outermost door".

Full ADR: `.indusk/planning/archive/test-kinds/adr.md`.

## What was decided

**Five kinds, each with its moment.** A test plan names each assertion's kind,
and the kind says when the test runs:

- `unit`: in the phase;
- `contract`: in the system tier, at landing and on release;
- `live check`: once, recorded in the plan;
- `smoke`: at deploy;
- `promise`: continuously.

The default is the smallest kind that can prove the assertion. `contract` is
only for a question about something we do not own. An impl with
`test_kinds: required` has every trajectory row's kind checked when it is
written.

**Code that decides takes its clock and its reads as inputs.** The admin's
store and health read accept an optional `Deps`. Their nine rules became unit
tests that run in under half a second, and one of them found a bug the HTTP
test had missed.

**Servers only in the system tier.** Each package's `vitest.tiers.ts` lists
the tests that start a server or a detached process, or that wait on the
clock. `pnpm test` holds rules only and runs both packages in parallel.
`pnpm test:system` runs both packages' system tiers.

**A phase runs what it touched.** That is its own rows' tests plus
`vitest related` over its changed files. Both tiers run at landing.

**No test run is replayed from turbo's cache.** turbo keys its cache on a
package's own files, and the never-wait guard in mcp reads the admin's tests.

**The suite's own promises.** `everyday-tests-never-wait` is a guard over both
packages. `everyday-suite-stays-fast` marks every root run held or broken with
its duration (120 s threshold). A slow run fails nothing; a run that
overlapped another, or failed fast, is not judged.

## Tradeoffs accepted

- Page rendering and real Jaeger are checked at landing and release, not at
  every phase.
- Six HTTP files that assert what the page draws stay in the system tier until
  someone rewrites them as component tests.
- Every `pnpm test` really runs (about a minute), even when nothing changed.
- A time limit that fails the run was rejected. The cause is the kind of test,
  not the number.
