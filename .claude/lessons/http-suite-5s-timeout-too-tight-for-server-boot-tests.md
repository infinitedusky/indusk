# indusk-admin's http-* tests fail on 5s vitest default because they boot a Next server — known-red-on-main, not a regression signal

`apps/indusk-admin`'s `http-smoke`, `http-project-research`, and `http-project-scorecards` tests fail with `Test timed out in 5000ms` on main itself (4/4 failures observed directly on trunk, separate from any worktree), because they boot a real Next.js server and 5s is too tight for that under load. This is flaky/load-sensitive, not something a given change broke — confirmed during dawn-verify Phase 4 by running the same suite on main before attributing the failures to the plan's changes.

**Precedent for the fix:** dawn-hook-parity already solved this exact class by raising real-git+gate integration tests to 30s, with the reason recorded in a comment at the timeout site — do the same here rather than re-diagnosing from scratch.

**Why this matters for verification work:** joins `agent-roles-phase4` (fixed in commit eb82d818) and the two port-sensitive `daemon-identity` T22/T23 cases as known-red-on-main. Before treating any of these as evidence a change broke something, check whether it's already red on an unmodified checkout — see [[worktree-test-env-parity-gitignored-artifacts]] for the general baseline-before-diagnosing practice.
