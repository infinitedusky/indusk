# Run the product in a project it was not built in — the live check is where it meets ground it wasn't shaped by

planner-promises' scratch-project live check (A23) found two defects invisible from inside dusk itself: InDusk's own installed hooks carry tokens for dusk's own promises, so any normal-mode project's first `promises check` failed — shipped since day-promises, hidden because a workbench's hooks sit outside the code root the check scans. And the planner skill told agents to read a `master.md` file that new projects simply don't have.

Why it matters: every test in a plan's own suite runs inside dusk, against dusk's own registry, dusk's own hooks, dusk's own planning tree. A defect that only exists when the assumptions built into the host project aren't there is invisible to every fixture and every unit test, because the fixtures are modeled on dusk. The live check is the only place those assumptions get to be wrong.

What to do: for any feature that ships as a general-purpose tool (a hook, a CLI, a skill) rather than a dusk-specific feature, run it for real in a fresh project dusk did not build — not a fixture directory, an actual `indusk init` elsewhere. Do this as part of the plan's live checks, not as an afterthought. See `.indusk/planning/archive/planner-promises/retrospective.md`, "Getting to Done" and "What We Learned".
