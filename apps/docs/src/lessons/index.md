# Lessons Learned

Insights extracted from retrospectives — what worked, what didn't, and what to do differently next time.

Lessons are added here during the retrospective/archival process — not during implementation.

## Community Lessons

Baked-in rules every InDusk project inherits — they ship with the MCP package:

- **[Tests first within each phase](/lessons/tests-first-within-each-phase)** — every impl's Test Trajectory commits to specific tests with writable/passes-at phase references. Author writable tests as failing; close the phase only when passes-at tests pass. Untestable items get Deferred Verification with three required fields.
- Other community lessons: see `apps/indusk-mcp/lessons/community/` in the repo — each ships as a markdown file installed during `indusk init`.

## Plan Retrospective Lessons

Insights captured during specific plans' retrospectives — narrower than community lessons but generalize beyond their plan of origin:

- **[Agent Roles](/lessons/agent-roles)** — three-tier agent role separation (working / eval / infrastructure) and the highlights queue as the boundary mechanism.
- **[Eval Agent Bug Fix](/lessons/eval-agent-bug-fix)** — silent-failure modes when subprocess stderr is swallowed; ESM-vs-CJS pitfalls in spawned Node subprocesses.
- **[Eval Agent OTel](/lessons/eval-agent-otel)** — opt-in observability for background agents; OTel as the diagnostic tool that unblocked the bug-fix plan.
- **[Eval Scorecard Format Fix](/lessons/eval-scorecard-format-fix)** — `Array.isArray` over `?? []` for non-nullish-but-falsy values; LLM output as statistical not deterministic; wrapper-overrides-LLM for fields the wrapper has truth for; falsification ritual's cheat-sheet effect.
- **[Rationale Baseline Frontmatter](/lessons/rationale-baseline-frontmatter)** — regex anchor risk for value-bearing keys vs. presence/enum keys; falsification fixtures must be minimal so the targeted rule is the only one that can fire; same-session falsification beats next-day falsification despite the cheat-sheet effect; TS↔JS parity tests via subprocess are cheap and load-bearing.
