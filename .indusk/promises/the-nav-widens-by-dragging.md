---
name: the-nav-widens-by-dragging
kind: state
lifetime: holds
state: enforced
domain: gates
owner: cockpit-redraw
sites:
  - apps/indusk-admin/src/components/cockpit/CockpitFrame.tsx
tests:
  - apps/indusk-admin/src/components/cockpit/CockpitFrame.test.tsx
  - apps/indusk-admin/src/components/ui/NavHandle.test.tsx
incidents: []
---

Above phone width a person can drag the nav's edge to make it wider or narrower within limits, and the admin remembers that width.

## History
- 2026-10-13 — declared (cockpit-redraw), from its planning conversation.
- 2026-10-14 — enforced, confirmed for cockpit-redraw: proven by row A1, row A2, row A3, row A4, row A15.
