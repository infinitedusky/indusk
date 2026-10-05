# Feature Workflow

Features use the full planning lifecycle. This is the default when no workflow type is specified.

## Documents Created
- `research.md` — the background, the findings and the decisions made on the way
- `brief.md` — what the planning conversation produced: expectations and promises (frontmatter carries `workflow: feature`)
- `test-plan.md` — the behavior that must be true, before the decision is made
- `adr.md` — how the promises will be kept: the decision, and what was rejected
- `impl.md` — phased implementation checklist
- `retrospective.md` — closing audit (via /retrospective)

## Notes
- This is the full lifecycle documented in the plan skill
- Use the standard templates from the plan skill
- Include a boundary map in the impl if there are 2+ phases
- Every phase gets verification, context, and document gates
