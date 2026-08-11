# Deferred Verification authored as a gate bullet, not a trajectory-table row, is invisible to the audit

When a plan's automated close-out audit (e.g. a mitigation-drift or deferred-verification checker) parses the Test Trajectory table for `Deferred Verification` rows, a deferred item written instead as a bullet inside a Phase's Verification-gate section is structurally invisible to that audit — even though a human reading the document would understand it perfectly.

**The concrete case:** dawn-external-orchestrator's A8 acceptance criterion (the comparative model/harness quality read) was authored as a Verification-gate bullet rather than a `### Deferred Verification` trajectory row. `auditPlanAtClose` returned `deferred: []` and the mitigation-drift audit never saw the plan's only deferred item — A8 was resolved correctly by manual sign-off anyway, but the shape evaded the automated check that exists specifically to catch unresolved deferrals at close.

**The fix:** deferred verification belongs in the trajectory table structurally, not as prose in a gate section — either author it there from the start, or (if the auditor should also tolerate the prose form) extend the auditor to parse gate-section bullets for deferral markers. Until one of those is true, a Verification-gate bullet claiming "deferred" is not actually tracked by any automated mechanism, only by human memory.

**Why it matters beyond this plan:** any system with both (a) a structured table format the tooling parses and (b) a looser prose format humans also write in will have this exact class of blind spot — the tooling's coverage is exactly the structured shape it parses, and content expressed in the untracked shape is invisible to it regardless of how clearly a human would read it.
