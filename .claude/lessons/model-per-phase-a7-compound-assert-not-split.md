# Applying the and-joined-assert lesson caught a live instance — split A7 in model-per-phase before Build Phase 1 authors its test

The model-per-phase plan's test-plan.md and impl.md (commit f58abead) both state row A7 as "The same impl with a reason is accepted; a tier that is not one of strong, med, weak or baby is refused, naming it." — two claims in one row, the exact pattern the existing advisory lesson `trajectory-row-and-joined-asserts-tests-only-the-first-half` warns about.

Mitigating factor: the Test Phase 1 checklist bullet for A6/A7 does enumerate three separate cases (tier+no-reason refused, tier+reason accepted, unknown-tier refused) as prose, so the authoring guidance is there. But the trajectory row itself — the thing State tracking and close-out audits key off — stays compound. If Build Phase 1 only exercises the "accepted" half and checks A7 green, the "unknown tier refused" half can go unverified with nothing flagging it, because the row shows green either way.

Why this matters: this is a second real occurrence of the pattern the existing lesson describes, confirming it's not a one-off — the and-joined row shape recurs across plans. The existing lesson is advisory (no enforcer), so nothing caught this at either test-plan or impl drafting time.

How to apply: when authoring or reviewing a trajectory row whose Asserts clause contains "and" or a semicolon joining two distinguishable outcomes, split it into two rows (e.g., A7a "with a reason, accepted" / A7b "unknown tier, refused") before the phase that builds the assertion. If the row is already committed, split it in the next phase that touches it — don't just rely on the checklist prose to cover both halves.
