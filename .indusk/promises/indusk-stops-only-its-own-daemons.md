---
name: indusk-stops-only-its-own-daemons
kind: state
lifetime: holds
state: declared
domain: admin
owner: small-fixes
sites: []
tests: []
incidents: []
supersedes: telemetry-stop-stops-what-it-started
---

`indusk telemetry stop` and `indusk ui stop` judge a process by its command line, never by whether its port answers; each signals only its own, and says, non-zero, when one would not stop.

## History
- 2026-10-08 — declared (small-fixes), replacing `telemetry-stop-stops-what-it-started`, which is retired when small-fixes closes.
