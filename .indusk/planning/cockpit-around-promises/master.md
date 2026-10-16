---
title: "The cockpit around promises"
description: "The admin organised around promises: one agent present on every page of a plan, one way to read it; a promise seen holding and breaking beside the running app."
date: 2026-10-15
status: living
subplans:
  - one-conversation-view
  - contract-ui
  - cockpit-audit-fixes
  - decided-prompts-stay-closed
  - template-reload-on-cold-cache
  - demo-scenarios
  - embedded-browser
---

# The cockpit around promises

A child of [promise-core](../promise-core/master.md), which holds what this
group is for and where it sits in the order (its "Settled 2026-10-14/15"
section). The plans below are the open plans gathered under it on 2026-10-15.

## Four sections (Sandy, 2026-10-16)

A project's cockpit is four sections:

- **Map** — the nouns, the state: promises grouped by their type, the design
  system (looks) beside the behaviour system, and the expectations — what we
  expect to follow, each with its measure — with an agent to ask about it and
  brainstorm with. Today's promises dashboard is its start. Not yet a plan;
  `looks-as-promises` builds the design-system half.
- **Territory** — the running application itself, beside the map
  ("the map is not the territory"), and what really happened: each
  expectation's measured result. `embedded-browser` is its start;
  `expectations-loop` reads the results back, and a proposal it makes from one
  arrives in Activity as a decision.
- **Paths** — two paths to what we are trying to accomplish: the planned path
  (plans in master order, where briefs are written and decisions made — the
  nav's Paths today) and the execution path (the graph of phases the agents
  run). The execution path is `daily-list-and-graph-view`'s, under
  [run-the-master](../run-the-master/master.md).
- **Activity** — the verbs, triage: a scrolling feed (a decision asked or
  made, a promise broken or holding again) beside broken promises, decisions
  and phases in the order they will run. `daily-list-and-graph-view`'s.

## Closed

- **cockpit-audit-fixes** (2026-10-15) — the cockpit's thirty days count only what was seen, a several-question ask is answered in full, approval waits for a finished plan, and a plan sits in its innermost Path. **Carried from its audit, not yet a plan:** rows A5, A10 and A13 prove less than their promises (one source, identical inputs, either Path accepted); the admin fixture still encodes held = 30 − broke. See [archive](../archive/cockpit-audit-fixes/retrospective.md).
- **decided-prompts-stay-closed** (2026-10-15) — every request a session makes is recorded with how it was decided, and the panel draws it decided. See [archive](../archive/decided-prompts-stay-closed/retrospective.md).
