---
name: landing-installs-after-a-dependency-change
kind: state
lifetime: holds
state: declared
domain: gates
owner: template-reload-on-cold-cache
sites: []
tests: []
incidents: []
---

Landing's install step brings the checkout's dependencies to the lockfile before it builds, so it installs the landed build even when the merge changed dependencies.

## History
- 2026-10-15 — declared (template-reload-on-cold-cache), from its planning conversation.
