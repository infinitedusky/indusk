# Test-first discipline applies to every checklist item in a phase, including non-code setup items — not just the items that write source

During lifecycle-rebalance Phase 1, the gate blocked an attempt to check off the "Create/confirm this plan's worktree" item before the phase's trajectory tests (A1–A12) had been authored. The instinct was that test-first governs code items only — a worktree-kickoff item isn't "code," so it felt safe to check off immediately.

That instinct is wrong. `trajectory: required` + `rationale: required` gate the whole phase's completion on tests existing first, not on a per-item basis. Any item in a writable-tests phase — including scaffolding, setup, or infra items with no test of their own — should still wait until the phase's tests are authored RED, because checking off *any* item before the tests exist breaks the phase's own "tests came first" claim, even if that specific item has nothing to test.

**How to apply:** when a phase's trajectory table has rows `Writable at: <this phase>`, author and commit those rows RED before checking off *any* checklist item in the phase — including non-code items like worktree creation, dependency installs, or config scaffolding. Don't reason item-by-item about whether test-first "applies" to that item; it applies to the phase as a whole.

See `.indusk/planning/lifecycle-rebalance/impl.md` Phase 1, commit 692ecc5d.
