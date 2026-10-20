# When a plan another plan depends on lands, re-read every "not built / another plan's" claim in the dependent plan's documents

Why: run-the-graph's test plan, ADR and impl kept saying decisions-as-questions was unbuilt and out of scope long after it landed on main and was merged in. Nothing re-reads those claims when the named plan lands, so the held-question trigger was left unwired: question holds stayed plan-wide and were never released by the answer. The cold plan review caught it; the author had not.

What to do: when merging main into a plan, grep the plan's brief, test plan, ADR and impl for the names of plans that landed in that merge (and for "not built", "out of scope", "another plan's"). For each hit, decide whether the claim is now false and rewrite the document, the rows and the phase tasks that rested on it. A plan that rests on a promise another plan was to build must be checked against what actually shipped, not against what was planned.

Pointer: .indusk/planning/run-the-graph/plan-review.md (finding on Build Phase 9 and the question-hold trigger); highlight h-20261020-005.
