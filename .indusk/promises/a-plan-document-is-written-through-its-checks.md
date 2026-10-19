---
name: a-plan-document-is-written-through-its-checks
kind: state
lifetime: holds
state: declared
domain: planning
owner: a-run-can-be-trusted
sites: []
tests: []
incidents: []
clauses:
  - name: shell-write-refused
    kind: split
    statement: "A shell command that writes, moves or deletes a file under a plan's folder is refused, naming the file and the tool to use instead."
  - name: reads-pass
    kind: limit
    statement: "A shell command that only reads a plan document is never refused."
---

A shell command that writes a plan document is refused, so every change to a plan document passes the checks that guard it.

## History
- 2026-10-19 — declared (a-run-can-be-trusted), from its planning conversation.
