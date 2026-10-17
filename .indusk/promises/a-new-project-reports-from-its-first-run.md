---
name: a-new-project-reports-from-its-first-run
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: a-new-project-starts-instrumented
sites: []
tests: []
incidents: []
clauses:
  - name: the-scaffold-sits-where-the-app-runs
    kind: split
    statement: "The instrumentation is written in the declared code repo for the runtime found there, never at a workbench root; a repo with no app yet is told so, and `indusk update` scaffolds it once one appears."
  - name: the-service-is-named
    kind: split
    statement: "Every template sets the service name in code to the project's name."
  - name: the-spans-reach-the-daemon
    kind: split
    statement: "With nothing set, a scaffolded app exports to the daemon's fixed ports; a set endpoint still wins."
  - name: every-span-says-where-it-ran
    kind: split
    statement: "Every span carries the project and its environment, development unless set."
  - name: a-newer-template-is-offered-not-forced
    kind: limit
    statement: "`indusk update` never overwrites a template file a project has changed; a newer version is written beside it."
  - name: the-daemon-is-the-one-running
    kind: rests-on
    rests_on: the-daemon-readers-follow-is-the-one-running
---

A project InDusk scaffolds sends its spans, named after the project and carrying where they ran, to the local daemon from its first run, with no file edited by hand.

## History
- 2026-10-17 — declared (a-new-project-starts-instrumented), from its planning conversation.
