---
name: one-definition-per-shared-rule
kind: structure
lifetime: holds
state: enforced
domain: planning
owner: dawn-verify
sites: []
tests:
  - apps/indusk-mcp/src/__tests__/lifecycle-single-definition.test.ts
  - apps/indusk-mcp/src/__tests__/execution-roots-single-definition.test.ts
  - apps/indusk-mcp/src/__tests__/head-sha-single-definition.test.ts
  - apps/indusk-mcp/src/__tests__/phase-start-nudge-single-definition.test.ts
  - apps/indusk-mcp/src/__tests__/repos-root-single-definition.test.ts
  - apps/indusk-mcp/src/__tests__/workbench-repos-single-definition.test.ts
  - apps/indusk-mcp/src/lib/shape/shared-definitions.test.ts
  - apps/indusk-mcp/src/__tests__/promises-single-definition.test.ts
incidents: []
---

Every rule two enforcement lanes must agree on has exactly one definition under `src/lib`, and every consumer imports it rather than re-spelling it.

## Why it holds

A copy of a shared rule diverges silently: one copy could not read `Test Phase N`, another omitted `state`, and the `git()` runner was carried byte-identically into a second domain. No behavioural test can catch a divergence that has not happened yet, so each shared definition is pinned by a count — the test asserts one definition exists, and names the consumers that must import it.

## History
- 2026-08-05 — first pin (`resolveImplPath`, `TERMINAL_STATES`) by dawn-verify.
- 2026-09-18 — registered as a promise (day-promises); the promise vocabulary's own pin joins the tests.
