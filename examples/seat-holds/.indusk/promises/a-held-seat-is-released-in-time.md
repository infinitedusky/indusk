---
name: a-held-seat-is-released-in-time
kind: behaviour
lifetime: holds
state: enforced
domain: seats
owner: seat-holds
sites:
  - src/server.ts
tests:
  - src/seats.test.ts
incidents: []
---

A seat that is held and not booked is released when its hold window passes, never late.

## History
- 2026-10-07 — shipped with the seat-holds example (InDusk demo-app-template), enforced: its rules are tested in `src/seats.test.ts`, and every release is marked in `src/telemetry.ts`.
- 2026-10-17 — the release is written through the signal helper (`src/signal.ts`), no longer by hand; its site moved from `src/telemetry.ts` to `src/server.ts`.
