---
name: everyday-suite-stays-fast
kind: behaviour
lifetime: holds
state: enforced
domain: planning
owner: test-kinds
sites:
  - apps/indusk-mcp/scripts/with-daemon-guard.js
tests:
  - apps/indusk-mcp/src/__tests__/suite-speed.test.ts
incidents: []
---

The everyday suite, `pnpm test` at the root, finishes within two minutes. Every run is marked in the local telemetry daemon, held or broken, with how long it took; a slow run fails nothing and reads red on the Promises page. A run that overlapped another test run is not judged. The target is about a minute; the threshold is twice that, so a busy machine does not cry wolf.

## History
- 2026-10-05 — registered (test-kinds, Build Phase 5), at 53–55 s per run.
