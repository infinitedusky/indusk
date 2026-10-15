# Write each promise's tests against every entry point of its enforcer in Test Phase 1, and run context-tiers-register in any phase that edits a CLAUDE.md

In story-first-phases the root CLAUDE.md went 83 bytes over its budget unnoticed until a full-suite run in a late phase, and the promise tests covered Write only while Edit and the gated loop were other entry points. A phase's fast verification (its rows plus vitest related) never reaches the root budget test, so name context-tiers-register.test.ts in the Verification command of any phase whose Context task edits a CLAUDE.md, and list the enforcer's entry points when writing Test Phase 1.

Source: retro-hindsight highlight h-20261015-018 (story-first-phases).
