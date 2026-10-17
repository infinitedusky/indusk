---
name: an-impl-phase-explains-itself
kind: state
lifetime: holds
state: enforced
domain: planning
owner: impl-tasks-are-instructions
sites:
  - apps/indusk-mcp/hooks/_phase-summary.js
  - apps/indusk-mcp/hooks/validate-impl-structure.js
  - apps/indusk-mcp/src/lib/promises/reopen.ts
  - apps/indusk-mcp/src/lib/shape/findings.test.ts
  - apps/indusk-mcp/src/lib/shape/shape.test.ts
  - apps/indusk-mcp/src/lib/trajectory/validator.test.ts
tests:
  - apps/indusk-mcp/src/__tests__/phase-summary-rule.test.ts
  - apps/indusk-mcp/src/__tests__/planner-impl-summary-template.test.ts
  - apps/indusk-mcp/src/__tests__/ritual-templates-phase-summary.test.ts
  - apps/indusk-mcp/src/__tests__/phase-summary-module.test.ts
  - apps/indusk-mcp/src/lib/promises/reopen-phase-summary.test.ts
incidents: []
---

Every phase of a new impl opens with a plain summary saying what it does for the whole plan; every task is one plain instruction saying what to do, and every verification item one plain statement of what must hold, each with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused.

## History
- 2026-10-15 — declared (story-first-phases), from its planning conversation.
- 2026-10-15 — enforced, confirmed for story-first-phases: proven by row A1, row A2, row A3, row A4, row A14, row A15, row A16, row A18, row A19, row A21, row A22, row A26.
- 2026-10-17 — changed by impl-tasks-are-instructions: a checklist of outcomes hid the work from the checks (Sandy). It read: "Every phase of a new impl opens with a plain summary saying what it does for the whole plan, and every task is one plain sentence with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused." Owned before by story-first-phases; impl-tasks-are-instructions takes it over.
