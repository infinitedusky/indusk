---
name: a-release-runs-as-its-project-declares
kind: state
lifetime: holds
state: declared
domain: gates
owner: release-records-its-failures
sites: []
tests: []
incidents: []
---

`indusk release` runs a project's declared release with its slow tests before or after the publish as the config says, and reports the release done when the config's completion condition holds, for any project that declares one.

## History
- 2026-10-09 — declared (release-records-its-failures), from its planning conversation.
