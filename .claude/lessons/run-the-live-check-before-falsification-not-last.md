# Run the live check before falsification, not as the last build item — it should seed the hunt, not conclude it

planner-promises ran its scratch-project live check late, as one of the final build items, and only afterward ran the falsification ritual. The live check found a shipped defect (installed hooks carrying tokens for the host project's own promises, breaking every fresh project's first `promises check`) and four skill problems. Falsification — which goal-flips to deliberately hunt for breakage — would have had a concrete, already-confirmed lead to start from instead of hypothesizing from scratch.

Why it matters: a live check against a real, unfamiliar environment (a fresh project, a real deployment) finds defects unit tests and fixtures structurally cannot, because fixtures are shaped by the same assumptions as the code under test. Running it last means its findings arrive after the falsification hunt has already spent its effort elsewhere.

What to do: schedule the plan's live check(s) before the falsification phase, not after the last build phase. Treat its findings as falsification's starting hypotheses rather than a late-breaking surprise. See `.indusk/planning/archive/planner-promises/retrospective.md`, "What We'd Do Differently".
