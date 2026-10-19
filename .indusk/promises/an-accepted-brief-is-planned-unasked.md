---
name: an-accepted-brief-is-planned-unasked
kind: behaviour
lifetime: holds
state: declared
domain: planning
owner: a-brief-is-planned-unasked
sites: []
tests: []
incidents: []
clauses:
  - name: starts-on-acceptance
    kind: split
    statement: "Accepting a brief starts the planning session when every look the brief names is approved, and when a look is approved last, approving it starts it."
  - name: each-document-passes-its-check
    kind: split
    statement: "The session writes each document the workflow needs in order, and each passes the contract check and the impl's structure check before the next is written."
  - name: never-approves
    kind: limit
    statement: "The session never approves the plan, never approves a look and never starts the build."
  - name: decides-and-records
    kind: split
    statement: "A choice the documents leave open is decided by the session and recorded with its reason in the document it shapes; one it cannot make ends the session with a blocker saying what it needs."
  - name: approval-starts-the-build
    kind: split
    statement: "Approving the plan starts the unattended build, which runs to review as it does today."
---

Once a person accepts a brief and approves every look it names, an unattended session writes its test plan, its ADR when the workflow has one, and its impl, then stops for the person's approval.

## History
- 2026-10-19 — declared (a-brief-is-planned-unasked), from its planning conversation.
