# A plan that changes a file under apps/indusk-mcp/hooks must read that area's CLAUDE.md files and carry the resync of .claude/hooks (what sessions run); and a "no signal" reason must name a span that can fire for that case

Why: run-the-graph's impl changed `apps/indusk-mcp/hooks/check-gates.js` without resyncing `.claude/hooks/`, the copy sessions actually run. The resync rule lives in `apps/indusk-mcp/CLAUDE.md` and `hooks/CLAUDE.md`, which load only when a file in those directories is read; planning never read them, so the plan did not know the rule existed. In the same round several "no signal" reasons were circular: they relied on a span that cannot fire in the very case the reason excuses.

What to do: when the Files lines or inventory of a plan include a path in an area that has its own CLAUDE.md (`apps/indusk-mcp/`, `hooks/`, `apps/indusk-admin/`), read that file during planning (a Read triggers its load) and turn each rule that applies (resync, rebuild, restart the cockpit) into a task. When a clause is given no signal, check that the reason does not depend on a signal or span that is absent in that case; if it does, give the clause a signal or a test instead.

Pointer: .indusk/planning/run-the-graph/plan-review.md (third cold read, hook resync finding and circular "no signal" findings); highlight h-20261020-014.
