---
name: commands-take-values-as-arguments
kind: state
lifetime: holds
state: declared
domain: gates
owner: clean-release-build
sites: []
tests: []
incidents: []
---

Every command InDusk runs with a value from a person, a manifest or the network receives that value as one argument, never inside a shell string, so a value with quotes, semicolons or `$(…)` arrives as text.

## History
- 2026-10-09 — declared (clean-release-build), from its planning conversation.
