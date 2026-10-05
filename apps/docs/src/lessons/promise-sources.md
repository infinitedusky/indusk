# Promise Sources — Lessons

**A verification command that matches nothing passes.** The plan's
Verification items named `pnpm --filter @infinitedusky/indusk-admin`; the
package is `indusk-admin`. pnpm prints "No projects matched the filters" and
exits 0. The suites were run another way, so nothing false was recorded — but
the command as written would have passed with no test run. Copy a verification
command from one that has been run, and prefer `--fail-if-no-match`.

**Isolation has three axes.** "One dead source never hides another" was
designed for a source that fails by its answer — unreachable or blind. The
build phases tested exactly that. Falsification found the other two:
configuration (`"jaeger": "https://…"` threw a `TypeError` that killed every
reader, local included) and time (a host that never answers held a 2 s read for
7 s, and every source waited with it). Plan failure rows on all three.

**Duplication hides shared defects.** `status` and `watch` each built their
"what to do" line by re-reading the config, and both printed "Check undefined is
up" for a malformed one. Each copy looked fine alone; the defect showed only
when cleanup put them side by side. One `sourceAdvice`, built from the failure
rather than the config, fixed both.

**An accepted decision can be refuted by an existing test.** ADR D3 said status
exits 2 when any source fails. An existing row asserting that a laptop with no
daemon exits 0 went red under it on the first run. Run the existing suites
early in a build phase, not only at its close.

**Show everything, interrupt for one thing.** Every source is displayed; one
source — production — raises. The same shape will serve staging when it
arrives.
