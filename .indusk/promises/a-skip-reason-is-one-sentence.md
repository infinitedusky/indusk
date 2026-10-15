---
name: a-skip-reason-is-one-sentence
kind: state
lifetime: holds
state: enforced
domain: gates
owner: skip-reason-why
sites:
  - apps/indusk-mcp/src/lib/build/build-session.ts
  - apps/indusk-mcp/src/lib/build/next-step.ts
  - apps/indusk-mcp/src/lib/build/runner.test.ts
  - apps/indusk-mcp/src/lib/cleanup/gate.ts
  - apps/indusk-mcp/src/lib/lifecycle.ts
  - apps/indusk-mcp/src/lib/rituals/reason.ts
tests:
  - apps/indusk-mcp/src/__tests__/skip-reason-length.test.ts
  - apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts
  - apps/indusk-mcp/src/lib/build/next-step.test.ts
  - apps/indusk-mcp/src/lib/build/build-session.test.ts
incidents: []
---

A skipped falsification, cleanup or audit is refused at the retrospective unless its reason is one short sentence, and the skills that write a skip show one.

## History
- 2026-10-14 — declared (skip-reason-why), from its planning conversation.
- 2026-10-15 — enforced, confirmed for skip-reason-why: proven by row A4, row A5, row A6, row A7, row A11, row A12, row A14, row A15, row A16.
