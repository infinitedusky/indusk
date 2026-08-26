# A checker function that validates a generator's literal output, with no test exercising either together, redrifts every time the generator changes — pin them with a round-trip test, not a second reading

In `apps/indusk-mcp/src/lib/worktree/shareable.ts`, `missingIgnoreRules()` validates a `.gitignore` by checking for the literal substring `"\n/*\n"`. This has now drifted from what `ensureShareableScaffolding()` actually generates TWICE across this same plan:

1. Build Phase 2 (commit 9883b140-era work, self-caught): the checker looked for `/*/`` after the generator had already moved to emitting `/*`.
2. Build Phase 4→8 (commit e4c5aedf, found by this eval, NOT self-caught): the generator moved from `/*` to `/*/` (to stop denying root files), but the checker still looks for the OLD `\n/*\n` string. Verified directly: `missingIgnoreRules()` run against a workbench freshly scaffolded by this same commit's own `ensureShareableScaffolding()` reports the deny-by-default rule as MISSING, even though it is present and correct — a false positive on a workbench that just did everything right.

No test in the suite calls `missingIgnoreRules` at all (`grep -rn "missingIgnoreRules" src/**/*.test.ts` returns zero matches), so nothing caught the second drift before commit. The commit's own next-phase plan (Build Phase 8) explicitly asserts `missingIgnoreRules` "already exists and is correct" and schedules wiring it into `restore`/`sync` as a refusal gate — which means Phase 8, if implemented on that premise, would refuse every freshly-scaffolded, correctly-configured workbench.

## Why

A checker that re-encodes a literal fragment of what a generator produces is only as correct as the last time someone remembered to update both together. There is no structural link between the two — changing the generator's constant does not fail to compile, does not fail any existing test, and looks like a clean, self-contained diff. The drift is invisible until the checker is actually invoked against real generator output, which nothing in this plan's test suite does.

## How to apply

Whenever a "generate X" function and a "does X satisfy the contract" function both encode knowledge of X's literal shape, either (a) derive the checker's expectation from the same constant the generator uses (e.g. `body.includes(GITIGNORE_HEADER.split("\n")[/* the deny-by-default line */])` rather than a hand-typed duplicate string), or (b) add a round-trip test: scaffold with the generator, then assert the checker reports zero gaps against that exact output. A round-trip test is stronger than a unit test of either function alone — it is the only test that fails when the two drift apart, which is precisely the failure mode that has now hit this file twice. See also [[verify-the-adversarial-gate-you-wrote-not-just-its-presence]] (the meta-pattern: a claim of correctness needs actual verification, not a memory of having fixed it once) and [[patch-that-cannot-find-its-target-must-refuse-not-half-apply]] (a sibling case of two related things silently falling out of sync).

