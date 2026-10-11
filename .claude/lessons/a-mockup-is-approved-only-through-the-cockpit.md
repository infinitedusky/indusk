# An agent draws and proposes a mockup and never approves it — approval is a person's Approve in the cockpit, and nothing an agent can run stands in for it

**The rule.** A mockup (and the foundation it defines) becomes the reference an app is held to only when a person presses Approve on the app's Looks page in the cockpit. An agent may draw mockups, change the foundation and propose; it never writes `.indusk/mockups/<app>/approved.json`, never runs or builds a stand-in for approving (a script, a shell redirect, a curl to the admin daemon, an import of `looks/approvals`' `approve`), and never treats a mockup as approved because its record entry "would verify".

**Why.** The promise `a-mockup-is-approved-by-a-person` exists because a check cannot be allowed to approve its own reference: if an agent could approve the mockup it is then held to, the look contract would hold anything. The ADR (`.indusk/planning/ui-promises/adr.md`, decision 3) binds each entry to the content hashes of the mockup and the foundation, so a changed mockup reads *proposed* by construction.

**What enforces it, and what does not.** `hooks/looks-approval-guard.js` refuses an agent's Write/Edit/MultiEdit to any app's `approved.json`; `indusk looks approve` exits 2 and writes nothing. Neither sees a shell write. An entry carrying the mockup's true hashes and any `by` reads approved, because the hash binding proves the content, not the approver (recorded in ui-promises Build Phase 2 Forward Intelligence and the Dawn keep/shed record). So the guard is a tripwire, not the guarantee — the rule is yours to keep.

**How to apply.** When a task needs an approved mockup, draw it, say what to open (the app's Looks page at each device) and stop. If the hook refuses a write, do not route around it by shell. Do not describe a proposed mockup as approved, and report coverage and look checks against the last approved version only.

**Delivery.** Advisory until the guard hook prints `lesson: a-mockup-is-approved-only-through-the-cockpit` in its refusal, as `apps/indusk-mcp/hooks/CLAUDE.md` requires of a refusing hook; that hook edit is the working agent's, not the eval agent's.
