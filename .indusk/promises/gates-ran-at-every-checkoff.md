---
name: gates-ran-at-every-checkoff
kind: behaviour
lifetime: holds
state: enforced
domain: gates
owner: enforce-plan-gates
sites:
  - apps/indusk-mcp/hooks/check-gates.js
tests:
  - apps/indusk-mcp/src/__tests__/hook-cwd-independence.test.ts
incidents:
  - i-2026-09-15-gates-silently-off
---

Every checkoff in an impl runs the gate chain: a phase-transition edit is judged by `check-gates.js` before it lands, from any working directory the session is in.

## Why it holds

A gate whose absence is indistinguishable from its approval is not a gate. The hooks are registered by the project root (`hookCommand`), so a session that has changed directory still loads them; the incident below is the class this promise exists for. Its observer is Day step 5's gate ledger — until that exists, the running system reports nothing about this promise, and its chip is hollow, which is the honest reading.

## History
- 2026-05 — established by enforce-plan-gates (PreToolUse gate chain).
- 2026-09-15 — hook-cwd-independence closed the incident: hooks registered by the project root.
- 2026-09-18 — registered as a promise (day-promises), health hollow until the gate ledger.
