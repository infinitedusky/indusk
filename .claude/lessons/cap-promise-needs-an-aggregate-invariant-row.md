# A promise about a cap or limit needs a row that asserts the aggregate never exceeds it, not only that a plain start at the limit is refused — and a fix that adds an exemption is new untested behavior

In sessions-per-plan, the falsification fix for A14 (a build's next step refused at the cap) added an `inBuild` opt-out that let build steps past `sessions.max`. It passed its own row, and A8/A9 (a plain start at the cap is refused) stayed green, yet the promise `sessions-are-capped` was broken: pressing Build on several plans admitted all of them and every later step skipped the cap. Only the cold-reader audit asked whether the total could exceed `max`; no row asserted it.

Rule: when a promise bounds a quantity, write the aggregate invariant (the total never exceeds the bound, across every path that can start the thing) as a trajectory row with the promise, at test-plan time. When a fix for a found bug adds an exemption or a bypass, give the exemption a row stating what still holds, and prefer a reservation held by the owner of the counter (`SessionManager.admitBuild`) over a flag any caller can set.

Pointers: `.indusk/planning/sessions-per-plan/audit.md`, `.indusk/planning/sessions-per-plan/retrospective.md` (What We Learned), A15 in `apps/indusk-mcp/src/lib/session/manager.test.ts`.
