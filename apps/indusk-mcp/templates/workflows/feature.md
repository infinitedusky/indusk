# Feature Workflow

Features use the full planning lifecycle. This is the default when no workflow type is specified.

## Documents Created
- `research.md` — the background, the findings and the decisions made on the way
- `brief.md` — what the planning conversation produced: expectations, promises and looks (frontmatter carries `workflow: feature`)
- `test-plan.md` — the behavior that must be true, before the decision is made; for a brief that states clauses, the clause plan: a section per promise and per clause, each clause with its signal
- `adr.md` — how the promises will be kept: the decision, and what was rejected
- `impl.md` — phased implementation checklist
- `retrospective.md` — closing audit (via /retrospective)

## Notes
- This is the full lifecycle documented in the plan skill
- Use the standard templates from the plan skill
- Write the impl with `phase_summary: required`: each phase opens with a paragraph, each task is one plain instruction saying what to do, and its detail is folded under it
- Include a boundary map in the impl if there are 2+ phases
- Every phase gets verification, context, and document gates
