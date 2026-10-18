# A guard that exempts test helpers must read what the helpers do, including a helper that re-exports or calls another helper — process starts hid behind helpers twice

tests-never-make-us-wait, 2026-10-18: the everyday guard exempted src/__tests__/helpers/ and matched only direct calls, so about 55 everyday tests started Node or git through hook-runner and test-git unflagged (found by the Build Phase 4 falsification). After the guard learned to read helpers, the audit found the same gap one layer deeper: versioned-workbench re-exports test-git's git, so a helper-through-helper start is still missed.

Why: an exemption is a blind spot the size of everything behind it. How to apply: when a guard exempts a folder, make it compute what that folder does (a fixpoint over calls and re-exports) and test the guard on a two-hop example; when a promise is about what tests start, also scan every package's tests, not only the ones the guard was written for (the editor extension's were never scanned).

See apps/indusk-mcp/src/__tests__/everyday-tests-never-wait.test.ts (helperStarters) and .indusk/planning/archive/tests-never-make-us-wait/retrospective.md.
