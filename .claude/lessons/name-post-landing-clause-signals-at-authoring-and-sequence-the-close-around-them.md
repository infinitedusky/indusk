# When a clause's signal can only be reported by a real run after landing, the impl names it at authoring time and sequences the close around it — confirm-before-archive otherwise blocks the plan

a-run-can-be-trusted made twelve clause signals that only a real post-landing run can report (live checks L1–L3 and the first real reports), so under Step 8a's order (confirm, then archive, then land) its own close was impossible: `promises confirm` refused 12 clauses with no real-run report, nothing could be archived or landed, and a person had to decide the order (retrospective.md; highlight h-20261019-037).

Rule: at authoring time, list which clauses' signals can only report after landing, and say in the impl how the close is sequenced for them (land, run the live checks, then confirm and archive), or choose signals a pre-landing run can report. A plan with `clauses: required` closes only on real-run reports, so this is part of the plan, not a surprise at the retrospective.

See .indusk/planning/a-run-can-be-trusted/retrospective.md.
