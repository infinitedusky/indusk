# A Deferred Verification row mitigated by "a downstream plan will run this for real" is only honest if the shipped guide marks the untested part as unrun

day-always-on's retrospective audited its two Deferred Verification rows (U1, U2 — the Fly deploy smoke) as downstream-plan, no warning: mitigated by `day-always-on-deploy`, whose brief the user accepted the same day specifically to make that mitigation valid.

The condition that keeps a downstream-plan mitigation honest rather than hand-wavy: the shipped artifact (here, the deploy guide) must mark the unrun parts — the Docker image, the fly.toml — as UNRUN in a visible warning callout until the downstream plan actually closes. Shipping a config nobody has executed under a word like "reference," with no callout, is a pass asserted without observation — indistinguishable from a real deploy to a reader of the docs.

**The rule:** when a Deferred Verification row's mitigation is "a later plan proves this," check that the current plan's own shipped docs/guide say — visibly, not just in the plan file — that the thing is unproven. The downstream plan closing is what removes the callout, not what justifies omitting it.

Pointer: `.indusk/planning/archive/day-always-on/retrospective.md`, `/guide/always-on`.
