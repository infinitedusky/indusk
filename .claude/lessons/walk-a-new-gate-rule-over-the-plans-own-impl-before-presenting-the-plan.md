# Walk any new gate or join rule a plan introduces over that plan's own phase graph before presenting it; a rule that its own plan cannot pass deadlocks the build

Why: run-the-graph introduced a join gate (a phase merges only if each clause it touches has its signal task in that phase or a done phase). Test Phase 1's rows name clauses whose signal tasks sit in later phases, so the plan's own first phase could never merge: the rule deadlocked the plan that wrote it. It was found only by the cold read, and the fix was to drop the signal-task requirement from the join (the contract rule already holds signal tasks plan-wide).

What to do: when a plan adds a rule that gates progress (a join check, a hook refusal, an ordering rule), run it by hand, or with a fixture, over the plan's own impl in phase order before presenting the plan: for each phase, does the rule pass at the moment that phase ends? Write the result in the test plan as a row ("this plan's own graph passes the rule"). Tests-first plans are the sharpest case, because their Test Phase 1 writes rows that only pass later.

Pointer: .indusk/planning/run-the-graph/plan-review.md (third cold read, join gate finding); highlight h-20261020-012. See also a-plan-that-changes-a-system-wide-invariant-lists-the-existing-code-that-assumes-the-old-one.
