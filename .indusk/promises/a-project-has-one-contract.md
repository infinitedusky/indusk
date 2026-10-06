---
name: a-project-has-one-contract
kind: state
lifetime: holds
state: declared
domain: planning
owner: workbench-plan-authoring
sites: []
tests: []
incidents: []
---

A repo's promises are read and written in one place: the repo's own `.indusk/promises/` once it holds one, otherwise the workbench's shadow contract. Every reader goes through the same resolver: the plan commands, the registry check, the watcher and the admin. A promise is never read from both.

## History
- 2026-10-06 — declared (workbench-plan-authoring), from its planning conversation.
