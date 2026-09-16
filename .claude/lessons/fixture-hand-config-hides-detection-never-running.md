# A fixture that hand-sets a value production must detect blinds every test to whether detection runs — add one row that leaves it unset

**Pattern:** a test fixture writes a config value by hand (e.g. `verify.testCommand`) that production is supposed to *derive* (runner detection at `init`/`update`). Every behavioural test downstream of that value goes green, and none of them can tell whether the derivation ever ran in the fixture's environment.

**Where it bit (dawn-workbench-execution, 2026-09-16):** fifteen trajectory rows were green for a split verify in a workbench, with every fixture setting `verify.testCommand` explicitly. Tooling detection had run once at `init` against the workbench root — the wrapper, which holds no `vitest.config.ts` — so `verify.testRunner` had never been written in any real workbench, and a split verify without a runner reports every row **unverified under a clean verdict**. Falsification found it by reading; no row could have.

**Why it matters:** the failure mode is clean-by-silence. The product reports success while doing nothing, and the fixture's hand-set value is exactly what makes the test suite unable to notice.

**What to do instead:**
- When a fixture sets a value production derives, add **one row that leaves it unset** and asserts the derived value appears (or that the command refuses loudly without it).
- In any plan whose verdict can be clean-by-silence, make "no row reads unverified / nothing was skipped" a Test Phase 1 assertion, not something added after a red row for the wrong reason.
- Ask of each fixture knob: *is this something the code under test is supposed to figure out?* If yes, at least one test must not supply it.
