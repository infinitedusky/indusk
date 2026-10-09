---
name: a-release-ships-only-its-own-source
kind: structure
lifetime: holds
state: declared
domain: gates
owner: clean-release-build
sites: []
tests: []
incidents: []
---

Every compiled file in a published package comes from a source file in the repository at release time; a build starts from an empty output folder and leaves the `indusk` command runnable.

## History
- 2026-10-09 — declared (clean-release-build), from its planning conversation.
