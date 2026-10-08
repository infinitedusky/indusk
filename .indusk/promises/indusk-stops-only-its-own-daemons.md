---
name: indusk-stops-only-its-own-daemons
kind: state
lifetime: holds
state: enforced
domain: admin
owner: small-fixes
sites:
  - apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts
  - apps/indusk-mcp/src/lib/process-identity.ts
  - apps/indusk-mcp/src/lib/telemetry/stop.ts
tests:
  - apps/indusk-mcp/src/lib/admin/daemon-stop.test.ts
  - apps/indusk-mcp/src/lib/telemetry/stop.test.ts
incidents: []
supersedes: telemetry-stop-stops-what-it-started
---

`indusk telemetry stop` and `indusk ui stop` judge a process by its command line, never by whether its port answers; each signals only its own, and says, non-zero, when one would not stop.

## History
- 2026-10-08 — declared (small-fixes), replacing `telemetry-stop-stops-what-it-started`, which is retired when small-fixes closes.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A12, row A13, row A17.
