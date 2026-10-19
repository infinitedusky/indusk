# A plan with clauses gets a signals phase from the start, because promises confirm refuses a clause no real run reported upheld

After mark-first, `indusk promises confirm` blocks close until each clause's signal has reported in a real run. audit-concerns-are-answered was planned before that rule and added a signals phase (Build Phase 7) only after landing; the plan then stayed unarchived because four clauses still waited on real runs (A32).

**How to apply:** when a plan states promises as clauses, write an impl item for each clause's signal emitter and a live run that reports it, in the first impl, and note which real run will report it. When a closing rule lands while plans are in flight, add the requirement to each as a phase before their builds finish.

Source: highlight h-20261019-015; plan audit-concerns-are-answered retrospective.
