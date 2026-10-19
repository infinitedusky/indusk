# Never leave a choice "for the ADR" in a workflow that has no ADR; settle it in the document that has it, or stop and ask

In approval-waits-for-the-planning-run (a bugfix: brief + test plan + impl, no ADR), the test plan left "where 'stopped' is read from" open "for the ADR". No ADR was ever going to be written, so the impl author settled it, and picked a weaker reading (run not running, from in-memory state) than the brief's sentence ("stopped ready for approval"). The cold read caught it (plan-review.md Q1 row A6, Q2 decision 1, Q4 build-host.ts restart/cannot-continue). It forced a brief amendment.

Rule: before deferring a choice, check the workflow actually has the document you name. If it does not, decide it in the test plan, or if it changes what the brief promises, raise it as an amendment. A choice deferred to a document that does not exist goes to whoever writes next, and they choose without the brief's wording in front of them.

Pointer: .indusk/planning/approval-waits-for-the-planning-run/plan-review.md (highlight h-20261019-016).
