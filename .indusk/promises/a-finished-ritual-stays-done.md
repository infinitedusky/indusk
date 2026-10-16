---
name: a-finished-ritual-stays-done
kind: state
lifetime: holds
state: declared
domain: admin
owner: finished-rituals-stay-done
sites: []
tests: []
incidents: []
---

A plan's Falsify, Cleanup and Audit steps read done once their ritual is finished (its phase closed or its audit written; a ritual skipped with a reason reads skipped, with that reason, not done), and keep reading done when a later build phase reopens the plan to building.

## History
- 2026-10-16 — declared (finished-rituals-stay-done), from its planning conversation.
- 2026-10-16 — changed by finished-rituals-stay-done: The built and tested behaviour reads a skipped ritual as skipped with its reason; the sentence said done.. It read: "A plan's Falsify, Cleanup and Audit steps read done once their ritual is finished (its phase closed, its audit written, or a skip with a reason), and keep reading done when a later build phase reopens the plan to building."
