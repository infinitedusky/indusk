# A "nothing is changed" refusal must cover every step that can fail after the first mutation, not only the mutating step itself

**Why:** In a-brief-is-accepted-on-current-main the merge of main was planned and tested to undo itself on a conflict. The audit found later steps that can still refuse or fail after the merge and sit outside the undo: admitBuild and planLocation at build-host.ts:395-401 (a session-slot refusal), and the acceptance commit at accept-brief.ts:64 (a commit hook, signing or lock failure). In each case the person is told nothing was changed while the merge commit stays on the branch.

**How to apply:** When a promise says a refusal changes nothing, list every step after the first mutation that can throw, and either run the checks that can refuse before the mutation or put them inside the undo. Add a trajectory row that makes each of those steps fail and asserts the head, tree and status are unchanged.

Pointer: .indusk/planning/a-brief-is-accepted-on-current-main/audit.md (section "What does the diff change that no row touches"); highlight h-20261019-027.
