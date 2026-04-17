# Lessons Learned

Insights extracted from retrospectives — what worked, what didn't, and what to do differently next time.

Lessons are added here during the retrospective/archival process — not during implementation.

## Community Lessons

Baked-in rules every InDusk project inherits — they ship with the MCP package:

- **[Tests first within each phase](/lessons/tests-first-within-each-phase)** — every impl's Test Trajectory commits to specific tests with writable/passes-at phase references. Author writable tests as failing; close the phase only when passes-at tests pass. Untestable items get Deferred Verification with three required fields.
- Other community lessons: see `apps/indusk-mcp/lessons/community/` in the repo — each ships as a markdown file installed during `indusk init`.
