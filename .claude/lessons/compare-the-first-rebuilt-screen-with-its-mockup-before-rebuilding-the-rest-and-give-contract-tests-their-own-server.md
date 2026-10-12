# Compare the first rebuilt screen with its approved mockup before rebuilding the rest, and give contract tests their own dev server so browser rows run in the phase that owes them

**Rule:** when a plan rebuilds many screens to approved mockups, put a side-by-side comparison of the first rebuilt screen with its mockup at the first screen's phase, not at the end. And the dev server a person approves through must not be the one the contract tests boot.

**Why:** storybook-components rebuilt every admin screen across Build Phases 7 and 8 and read U1 (does the rebuilt cockpit look like its mockups) as "does not match" only at Build Phase 8, after all of them were done. Meanwhile the marker-counting coverage check read everything covered, because a name marked once satisfied it whatever the screen looked like. Separately, A7, A18 and A19 (the browser rows) were owed at landing for six phases because a stale `next dev` held `.next/`, and Next locks that directory, so the contract tests could not boot a server beside it.

**How to apply:**
- Order the screens so the first rebuilt one is also the first compared; if it does not match, the cause (a component, a token, the composition) is fixed once instead of eleven times.
- A coverage rule that counts markers proves the names exist, not that the screen matches. Name what it does not see in the plan and keep a person's comparison (or a computed-style comparison like A30) as the check.
- Give the contract tests a dev server on its own directory or port (`next dev` with a separate `distDir`), or restart the person's server in the phase boundary, so a browser row is red or green in the phase that owns it, never deferred to landing.

See `.indusk/planning/storybook-components/impl.md` (Build Phases 7, 8 and the deferred rows) and the research note on U1.
