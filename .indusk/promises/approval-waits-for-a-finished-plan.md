---
name: approval-waits-for-a-finished-plan
kind: state
lifetime: holds
state: enforced
domain: admin
owner: a-run-can-be-trusted
sites:
  - apps/indusk-mcp/src/lib/plans/waiting.ts
tests:
  - apps/indusk-mcp/src/lib/plans/waiting.test.ts
  - apps/indusk-mcp/src/lib/session/manager.test.ts
incidents: []
---

A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written for the documents as they stand with every finding answered; a plan whose impl is written without such a plan review, and that no run is still writing, is listed as needing its plan review.

## History
- 2026-10-11 — declared (cockpit-audit-fixes), from its planning conversation.
- 2026-10-15 — enforced, confirmed for cockpit-audit-fixes: proven by row A8, row A12.
- 2026-10-19 — changed by approval-waits-for-the-planning-run: approval waits for an answered plan review (Sandy, 2026-10-19). It read: "A plan is listed as waiting for approval only when its impl is written and no session is still writing it." Owned before by cockpit-audit-fixes; approval-waits-for-the-planning-run takes it over.
- 2026-10-19 — changed by a-run-can-be-trusted: the offer read a plan review as answered without checking it was written for the documents as they stand. It read: "A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written with every finding answered; a plan whose impl is written without an answered plan review, and that no run is still writing, is listed as needing its plan review." Owned before by approval-waits-for-the-planning-run; a-run-can-be-trusted takes it over.
