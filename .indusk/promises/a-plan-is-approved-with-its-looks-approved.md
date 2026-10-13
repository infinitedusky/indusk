---
name: a-plan-is-approved-with-its-looks-approved
kind: state
lifetime: holds
state: enforced
domain: gates
owner: brief-as-the-contract
sites:
  - apps/indusk-mcp/src/lib/plans/approved-brief.ts
tests:
  - apps/indusk-mcp/src/__tests__/plans-approve-looks.test.ts
  - apps/indusk-mcp/src/__tests__/plans-accept-stories.test.ts
incidents: []
---

A plan is approved only after a person has approved each look its brief names, every screen and every new component drawn as its own mockup, and a look still proposed or not yet drawn is named in the refusal.

## History
- 2026-10-12 — declared (brief-as-the-contract), from its planning conversation.
- 2026-10-13 — changed by brief-as-the-contract: a story is never named without a mockup: a new component is drawn as its own mockup in the brief, so no look is exempt at approval. It read: "A plan is approved only after a person has approved each look its brief names, and one still proposed is named in the refusal."
- 2026-10-13 — enforced, confirmed for brief-as-the-contract: proven by row A8, row A24, row A33.
