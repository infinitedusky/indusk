---
name: a-session-says-how-it-ended
kind: state
lifetime: holds
state: enforced
domain: admin
owner: small-fixes
sites:
  - apps/indusk-admin/src/components/session/SessionPanel.tsx
tests:
  - apps/indusk-admin/src/components/session/SessionPanel.result.test.tsx
incidents: []
---

The admin's session panel says a turn failed, a turn finished, or the session ended, with the reason; never Claude Code's own status word beside an error.

## History
- 2026-10-08 — declared (small-fixes), from its planning conversation.
- 2026-10-08 — enforced, confirmed for small-fixes: proven by row A7, row A8, row A22.
