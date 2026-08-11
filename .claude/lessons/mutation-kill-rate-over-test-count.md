# Judge test suites by mutation kill-rate, never by test count — and preserve run artifacts so the judgment stays possible

In dawn-external-orchestrator's acceptance quality read, three suites of 15, 14, and 9 tests (three different models, two harnesses) all killed **8/8** hand-injected semantic mutants — identical detection power. Test count measured verbosity and grouping style, nothing else. An earlier "27 vs 14 tests" contrast that looked like a meaningful model delta dissolved on a re-run (the same config produced 15) — it was sampling noise.

**The method (cheap, no framework needed):** pick ~8 semantic mutants that represent real bug classes for the module (boundary acceptance loosened, a precedence dropped, a field not reset, a comparator inverted, a field swap, an off-by-N, a type leakage). Apply one at a time to a copy of the implementation in an isolated sandbox with the suite; a mutant the suite fails on is *killed*, one it stays green through *survived*. Survivors mark missing coverage; overlapping kills mark redundancy. An hour of work turns "more tests" into "more detection" or "same detection, more words."

**Corollary:** quality reads require the artifacts. Generated code that gets reset after recording pass/fail metrics can't be evaluated later — preserve run outputs (or accept re-running) whenever outcome *quality*, not just outcome *status*, will be judged.

