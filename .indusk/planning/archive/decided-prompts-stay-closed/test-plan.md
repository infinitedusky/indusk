---
title: "Decided prompts stay closed — Test Plan"
date: 2026-10-14
status: accepted
---

# Decided prompts stay closed — Test Plan

## Purpose

What must be true for a request the session decided to stop looking undecided, and for every decided request to stay decided. Grouped by the brief's promises; each row becomes a trajectory row in the impl.

## Behavioral Assertions

### `a-prompt-shows-only-when-a-person-must-choose` — the panel offers a choice only for a request waiting on a person

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | During a build, a request to write inside the plan's worktree shows in the panel already allowed, with no Allow or Deny to press. | unit |
| A2 | During a build, a request to write outside the worktree shows already denied, with the reason the build was given, and no Allow or Deny. | unit |
| A3 | A request nothing has decided yet, in a running session, still shows Allow and Deny. | unit |
| A4 | In the new-project conversation, a request its agent's rule decided is not listed as waiting on the person. | unit |

### `a-decided-request-stays-decided` — every request is in the log, and once decided it stays decided

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | A request a planning session allowed on its own rule appears in the log as allowed; it no longer disappears. | unit |
| A6 | A request the person allowed or denied in the panel shows the outcome they chose, and a panel that connects afterwards (a reload) shows it decided, with no buttons. | unit |
| A7 | A question a build declined on its own shows as declined, with the reason, never as waiting. | unit |
| A8 | Watching a real build in the cockpit, no prompt is left looking undecided, and reloading the page leaves every one decided. | live check |

## Untestable Assertions

None.

## Notes

- A1, A2 and A7 run the build's own decision path against the session manager with a fake session (the harness `build-session.test.ts` already uses), and read the events a panel would hear.
- A4 reads the conversation thread's turns from the events alone, with no answered set handed in; the panel and the thread must agree because both read the same recorded decision.
