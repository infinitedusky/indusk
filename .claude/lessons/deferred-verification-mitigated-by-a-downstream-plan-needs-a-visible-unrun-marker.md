# When a Deferred Verification row's mitigation is "a downstream plan will cover this," the condition that keeps it honest is a visible UNRUN marker until that plan actually closes

day-always-on's two Deferred Verification rows (U1, U2 — the Fly.io deploy smoke test) both classified as `downstream-plan`, mitigated by pointing at `day-always-on-deploy`, a plan whose brief the user accepted on 2026-09-21. Retrospective audit flagged the condition that keeps this mitigation valid rather than aspirational: the guide documentation marks the image and the fly.toml config as UNRUN in a visible warning callout, and that callout stays until `day-always-on-deploy` actually closes.

Why it matters: "a downstream plan will verify this" is a legitimate mitigation for a Deferred Verification row — but only conditionally. Without a visible unrun marker, a config nobody has executed yet, shipped under the word "reference," reads to every future reader as a pass asserted without observation — exactly the failure mode Deferred Verification rows exist to prevent by naming their gap honestly.

What to do instead: when a Deferred Verification row's mitigation names a downstream plan rather than an in-plan test, the current plan's own documentation (guide pages, README, whatever a reader hits first) must carry a visible "unrun/unverified until X closes" marker at the exact place the unrun thing is described — not just a pointer buried in the retrospective. Remove the marker only when the downstream plan actually closes, not when it's merely accepted or in progress.

See `.indusk/planning/archive/day-always-on/retrospective.md` and `.indusk/planning/day-always-on-deploy/`.
