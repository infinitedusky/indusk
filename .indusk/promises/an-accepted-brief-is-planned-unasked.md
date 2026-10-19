---
name: an-accepted-brief-is-planned-unasked
kind: behaviour
lifetime: holds
state: enforced
domain: planning
owner: a-brief-is-planned-unasked
sites:
  - apps/indusk-mcp/src/lib/build/build-session.ts
  - apps/indusk-mcp/src/lib/build/next-planning-step.ts
  - apps/indusk-mcp/src/lib/build/planning-runner.ts
  - apps/indusk-mcp/src/lib/build/read-planning.ts
  - apps/indusk-mcp/src/lib/plans/accept-brief.ts
  - apps/indusk-mcp/src/lib/plans/ask-admin.test.ts
tests:
  - apps/indusk-mcp/src/lib/plans/accept-brief.test.ts
  - apps/indusk-admin/src/lib/build-host.test.ts
  - apps/indusk-mcp/src/lib/build/next-planning-step.test.ts
  - apps/indusk-mcp/src/lib/build/build-session.test.ts
  - apps/indusk-mcp/src/lib/plans/planning-step-refusals.test.ts
  - apps/indusk-mcp/src/lib/build/planning-runner.test.ts
  - apps/indusk-admin/src/app/api/plans/approve/route.test.ts
  - apps/indusk-mcp/src/lib/build/read-planning.test.ts
  - apps/indusk-mcp/src/__tests__/planner-ends-after-accept.test.ts
incidents: []
clauses:
  - name: starts-on-acceptance
    kind: split
    statement: "Accepting a brief starts the planning session when every look the brief names is approved, and when a look is approved last, approving it starts it."
  - name: each-document-passes-its-check
    kind: split
    statement: "The session writes each document the workflow needs in order, and each passes the contract check and the impl's structure check before the next is written."
  - name: never-approves
    kind: limit
    statement: "The session never approves the plan, never approves a look and never starts the build."
  - name: decides-and-records
    kind: split
    statement: "A choice the documents leave open is decided by the session and recorded with its reason in the document it shapes; one it cannot make ends the session with a blocker saying what it needs."
  - name: approval-starts-the-build
    kind: split
    statement: "Approving the plan starts the unattended build, which runs to review as it does today."
---

Once a person accepts a brief and approves every look it names, an unattended session writes its test plan, its ADR when the workflow has one, and its impl, then stops for the person's approval.

## History
- 2026-10-19 — declared (a-brief-is-planned-unasked), from its planning conversation.
- 2026-10-19 — enforced, confirmed for a-brief-is-planned-unasked: proven by row T1, row T2, row T3, row T4, row T5, row T6, row T7, row T8, row T11, row T12, row T13, row T14, row T15, row T16, row T17, row T18, row T19, row T20, row T21, row T22.
