---
name: everyday-tests-never-wait
kind: structure
lifetime: holds
state: enforced
domain: planning
owner: tests-never-make-us-wait
sites: []
tests:
  - apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts
incidents: []
---

The everyday suite never starts a server, a process, the command line, a git repository or a workbench, and never waits on the wall clock; such a test runs when a plan's rows name it or its changes reach it, and in the release's tests.

## History
- 2026-10-05 — registered (test-kinds, Build Phase 5). Eight admin files once booted `next dev` and real Jaeger servers to check rules, making every phase wait five minutes.
- 2026-10-18 — changed by tests-never-make-us-wait: tests-never-make-us-wait: a test that starts the command line or git is a process start, and those files were 80% of the suite's time. It read: "The everyday suite never starts a server and never waits on the wall clock. A test that starts `next dev`, a Jaeger or always-on server, or a detached process, or that sleeps, belongs in its package's system tier (`vitest.tiers.ts` `SYSTEM`), which runs at landing and on release. The guard reads every everyday test file in both packages and names the file, line and call. This is what keeps a phase's verification in seconds." Owned before by test-kinds; tests-never-make-us-wait takes it over.
