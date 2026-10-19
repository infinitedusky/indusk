---
name: a-plan-is-read-cold-before-approval
kind: state
lifetime: holds
state: declared
domain: planning
owner: audit-concerns-are-answered
sites: []
tests: []
incidents: []
clauses:
  - name: the-reader-checks-the-plan
    kind: split
    statement: "The reader asks whether each planned test proves its promise's sentence or something narrower, whether the impl builds what each promise claims, which skip reason it would not accept, and which files a promise depends on that the plan does not touch."
  - name: the-reader-sees-documents-only
    kind: limit
    statement: "The reader is never handed the planning conversation or the planning agent's notes."
  - name: the-plan-is-answered-before-approval
    kind: split
    statement: "Each concern is answered, by changing a plan document or with the reason nothing is needed, before the plan is presented; the answers are shown with it."
  - name: the-planning-run-reads-it-cold
    kind: split
    statement: "The unattended planning run reads the plan cold as its last step, before it stops for approval."
---

Before a plan is put to the person for approval, a reader that has not seen the planning conversation reads its brief, test plan, ADR and impl against each other, and the planning agent answers each concern it raises.

## History
- 2026-10-19 — declared (audit-concerns-are-answered), from its planning conversation.
