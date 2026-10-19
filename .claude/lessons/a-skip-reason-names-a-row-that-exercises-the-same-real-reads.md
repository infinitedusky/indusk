# A skip reason or self-check must be able to fail — a live check skipped as "proved by rows" must name a row whose reads are real, and a self-verification must not run through a rule that exempts the impl it checks

The a-run-can-be-trusted plan review found two checks that could not fail: live checks skipped as "proved by A1–A21" when every read in those rows is injected (so nothing real is ever exercised), and the plan's self-verification run through a rule that exempts the very impl being checked.

Rule: a skip reason names the specific row that exercises the same real reads (real git, real process, real file) as the skipped check, or the check is not skipped. A self-check is run through a path that does not exempt its subject.

See .indusk/planning/a-run-can-be-trusted/plan-review.md; highlight h-20261019-030.
