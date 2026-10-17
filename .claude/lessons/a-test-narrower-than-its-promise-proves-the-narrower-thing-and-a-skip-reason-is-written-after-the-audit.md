# A test scoped narrower than its promise proves only the narrower thing; and a ritual skip reason written before the audit reads the change must be re-checked against the audit

Why: in impl-tasks-are-instructions, the template test for the promise "every task is an instruction" filtered to a phase's own tasks (empty gate heading), so it passed while the OTel, Context and Document gate tasks still taught the old rule. Separately, the falsify skip reason "no code path to break" was written before the audit and was wrong: the plan added test code and a matcher whose filter was the very defect falsification would have hunted; the cleanup reason "nothing to decompose" contradicted a Shape note that had deferred a duplicated helper to cleanup.

What to do: (1) when a test filters its subject, compare the filter to the promise's own sentence and widen it, or say in the row what it leaves unproven; (2) after the audit step runs, re-read the skip reasons for falsify and cleanup against its "skip reason you would not accept" section, and rewrite any it contradicts; (3) a Shape note that defers work to a ritual must be reconciled when that ritual is skipped.

Pointer: .indusk/planning/archive/impl-tasks-are-instructions/audit.md (sections "Does each row prove its promise's sentence" and "Which skip reason would you not accept"); commit 5980005c7 corrected the cleanup reason.
