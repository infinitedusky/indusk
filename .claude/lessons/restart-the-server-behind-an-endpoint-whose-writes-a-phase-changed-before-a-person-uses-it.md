# A long-running dev server is part of what a person's use of a changed endpoint depends on — restart whatever serves an endpoint whose writes a phase changed before a person uses it, or have the endpoint refuse an older client

**Rule:** after a phase changes what an endpoint writes or requires, restart the server that serves it before a person uses it. Better, make the endpoint refuse a request from an older client rather than accept it and record less.

**Why:** in storybook-components the cockpit's `next dev`, started that morning, kept serving the pre-falsification approve route. A person pressed Approve; the route wrote story approvals without the new `stylesheetHash` and returned success, so every one of the 68 looks stayed proposed, with nothing to say why. The code on disk was right; the process holding the old module was not. The test suite could not see it because tests boot their own server.

**How to apply:**
- A phase that changes an approval or write route ends its Verification with the restart (or states that the person's cockpit must be restarted), not just a green test run.
- Prefer a refusal: a route that binds more than before should reject a body missing the new field (as Approve now refuses a composed mockup without `componentsHash`), so an old page or old server fails loudly instead of recording a weaker approval.
- When a person reports "I approved and nothing changed", check the running process's start time against the commit before debugging the record.

See `apps/indusk-admin/CLAUDE.md` (the approve route) and `.indusk/planning/storybook-components/impl.md`, Build Phase 9.
