# When a brief is amended, re-read the ADR's rejected alternatives and every config switch that can turn a promise off

An amendment to an accepted brief changes more than the brief's sentences. Before the build continues, re-read the ADR's Alternatives Considered for anything the amendment now makes the plan do, and list every config switch or code option that can turn a promise off or widen what counts as met, then reconcile each with the brief.

Why: in decisions-as-questions the brief was amended so every cost holds by default (h-20261019-041). The ADR still listed "stop on every question" as rejected, though the default now does exactly that, and code options went beyond the brief unreconciled: workflow.steps.release_follow_on: false disables the release refusal, and a superseded follow-on counts as closed. The audit found these only after the build.

How to apply: on an amendment, grep the ADR for alternatives the amendment contradicts and update or restate them; grep the code and config for flags on each amended promise and either cut them, put them in the brief, or record the person's decision to keep them. Related: revisit-a-recorded-decision-before-code-reverses-it-not-after-an-audit-catches-it. Source: .indusk/planning/decisions-as-questions/audit.md.
