# Authoring the trajectory's own tests first can surface a contradiction in the research/brief/ADR that three design documents all missed

Writing the plan's own Test Trajectory assertions — actually executing them, not just drafting the table — is itself a test-first act on the plan's design, and it can catch design-level contradictions no amount of document review caught.

**What happened:** `test-phase-structure`'s research, brief, and ADR all agreed on two assertions: A1 ("an impl with no test phase is refused") and A4 ("every existing impl still validates unchanged"). Both read as reasonable in isolation across three separate documents. They cannot both hold — every one of the 52 existing impls has no test phase, so A1 and A4 directly contradict each other. This was invisible across research, brief, and ADR, and became visible within minutes of actually authoring and running the assertions.

**The resolution** — a `test_phases: required` frontmatter opt-in, mirroring the existing `trajectory: required` pattern — turned out to be the hinge the plan's entire zero-migration story depended on. It was found by doing the test-first step, not by more careful reading.

**A related finding from the same session:** A4's premise ("all 52 impls validate today") was simply false — nine already failed before this plan touched anything. Rewriting A4 as a **differential guard** that pins those nine specific pre-existing failures by name (rather than asserting a blanket "all pass") was both more honest and stricter: a new regression cannot hide inside an already-failing baseline, and this rewritten form went on to catch three real regressions during the plan's own execution.

**Why it matters:** design documents (research/brief/ADR) are prose reasoning about behavior; a trajectory assertion is the behavior stated precisely enough to execute. Contradictions that survive prose review often can't survive being run. Treat "author and execute the trajectory rows" as a design-validation step in its own right, not merely a downstream implementation task — and when a regression-guard assertion's premise turns out to be false, prefer rewriting it as a differential guard (pin the known-bad set by name) over either deleting it or leaving a false premise standing.

See `.indusk/planning/archive/test-phase-structure/` for the full plan.
