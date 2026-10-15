# A phase that edits apps/indusk-mcp/skills/ must resync .claude/skills and run skill-sync-parity.test.ts itself — phases run only `vitest related`, which never reaches it

An existing parity test protects nothing if no phase runs it. skill-sync-parity.test.ts would have caught stale .claude/skills at Build Phase 1 of story-first-phases, but a phase's Verification runs only its rows and `vitest related` over changed files, and the parity test imports none of them. So a phase that edits a skill source must (1) resync the installed copy and (2) name skill-sync-parity.test.ts in its Verification command. Related: mirrored-artifacts-need-structural-parity-tests (the test exists; this lesson is about who runs it).

Source: retro-lesson highlight h-20261015-001, story-first-phases.
