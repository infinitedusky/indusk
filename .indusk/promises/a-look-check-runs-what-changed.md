---
name: a-look-check-runs-what-changed
kind: state
lifetime: holds
state: declared
domain: admin
owner: tests-never-make-us-wait
sites: []
tests: []
incidents: []
clauses:
  - name: the-changed-looks
    kind: split
    statement: "A change to an app's interface checks the looks drawn from the files it changed, on the devices those looks are drawn for."
  - name: no-other-look
    kind: limit
    statement: "A look the change did not touch is not checked while the plan is built."
supersedes: a-look-check-costs-what-changed
---

A visual test checks only the looks a change touched.

## History
- 2026-10-18 — declared (tests-never-make-us-wait), from its planning conversation.
- 2026-10-18 — recorded as replacing `a-look-check-costs-what-changed`, which is retired when tests-never-make-us-wait closes.
