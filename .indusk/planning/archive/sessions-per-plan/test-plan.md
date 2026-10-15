---
title: "Sessions per plan — Test Plan"
date: 2026-10-14
status: accepted
---

# Sessions per plan — Test Plan

## Purpose

What must be true for several plans to each have an agent at once, and for the
machine-wide cap to hold. Every assertion is decided by a rule the session manager
or an admin route applies to the sessions it holds, so each is a `unit` fed fake
sessions, except one live check in the running admin.

## Behavioral Assertions

### `a-session-belongs-to-its-plan` — A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same plan is refused, naming the session already running, so a plan can have a planning session and a build at the same time.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | With a planning session running for one plan, a planning session for another plan starts. | unit |
| A2 | A second planning session on the same plan is refused, and the refusal names the session already running. | unit |
| A3 | A plan can have a planning session and a build running at the same time. | unit |
| A4 | A draft's conversation starts while a plan's session is running. | unit |
| A5 | Starting a build of one plan from the admin is not refused because another plan has a session. | unit |
| A6 | With sessions running on two plans, each plan's page and decision card show that plan's own session and question, never the other's. | unit |
| A7 | In the running admin, a person starts planning on two plans and talks to both without stopping either. | live check |

### `sessions-are-capped` — The number of sessions running together on a machine is capped by sessions.max in the InDusk home's config.json (~/.indusk/config.json), 4 by default; a start beyond the cap is refused, naming the sessions running and how to stop one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | With as many sessions running as the cap allows, another start is refused, naming each running session and how to stop one. | unit |
| A9 | With no `sessions.max` set, a fifth session is refused and a fourth is not; with `sessions.max: 2` in the InDusk home's config, a third is refused. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A10 | With two sessions running, stopping one leaves the other running and recorded. | unit | a regression guard over `a-session-can-be-stopped`, which the brief must not break |
| A11 | A session that ends records its end for its own plan, and the others' records stay. | unit | a regression guard over `a-session-says-how-it-ended` |

## Notes

- The test that asserts today's rule, "a second session is refused while one runs"
  (`manager.test.ts`, admin-plan-authoring's A21), states the rule this plan removes.
  It changes with the build, to A2's same-plan refusal; that change is the decision,
  not a weakened test.
