# When a test plan says "report the leak," write "even when the tests fail" explicitly — the implicit case is exactly the one an implementer will skip

Falsification on the test-daemons-never-leak work found that Build Phase 1 had written the leftover check with an implicit `&&` chain, skipping it on failure — because the test plan's instruction ("report the leak") didn't say "even when the tests fail," the implementer filled that gap with the easier, wrong default. The same falsification pass also caught that a switch meant to redirect which binary a test runs (see pin-the-binary-a-hook-shells-out-to-in-tests) hadn't actually reached the hook — A1 sat red the whole time because nobody checked which binary the test was invoking.

Two generalizable habits: when authoring a test-plan item for a guard or check, spell out the edge case explicitly rather than trusting the implementer to infer it from the goal ("report the leak" should have been "report the leak, including on a failing or crashed run"). And when a "fix" is a switch or flag meant to change what a test exercises, verify which binary/path the test actually ran before trusting the fix landed.

See the day-monitor plan's test-daemons-never-leak Maintenance work (dusk).
