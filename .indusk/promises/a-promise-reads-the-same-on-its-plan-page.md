---
name: a-promise-reads-the-same-on-its-plan-page
kind: state
lifetime: holds
state: declared
domain: admin
owner: plan-page-promise-health
sites: []
tests: []
incidents: []
clauses:
  - name: broken-reads-broken
    kind: split
    statement: "A behaviour promise with a break that is still live has the broken colour on its plan's page and its brief page."
  - name: each-health-alike
    kind: split
    statement: "A promise that broke and was fixed, one seen holding, one with no signal and one known broken each have on those pages the colour the Promises page gives them, and a promise with no signal is never green."
  - name: no-rule-of-its-own
    kind: limit
    statement: "The plan's page and its brief page decide no health themselves; they read it from the package's health rule, from the source the nav's red dot reads."
---

A plan's page and its brief page colour each of the plan's promises by the same health the Promises page shows for it, read from the same rule.

## History
- 2026-10-17 — declared (plan-page-promise-health), from its planning conversation.
