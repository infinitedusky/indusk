# When a new binding field lands on an append-only record, state how many existing entries it actually covers

Adding `baseRulesHash` to approvals was thought to bind approvals to the element rules. Because absence is a rule (an entry without the field binds nothing), all 193 existing admin approvals bound nothing on arrival. Only 22 could be stamped honestly from git history; 171 stayed unbound and were declared under "Not promised" in the brief.

How to apply: when a plan adds a field that gates behaviour on an append-only record, count the existing entries it covers, say the number in the brief, and backfill only what history proves, naming the rule used in the commit. Never let "absence is a rule" pass as full coverage. Record: .indusk/planning/mockups-draw-components-as-stories/brief.md and impl.md Build Phase 5.
