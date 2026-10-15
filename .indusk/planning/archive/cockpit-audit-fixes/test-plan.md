---
title: "Cockpit audit fixes — Test Plan"
date: 2026-10-11
status: accepted
---

# Cockpit audit fixes — Test Plan

## Purpose

The behavioural assertions that, taken together, mean the audit's findings are
fixed, grouped by the promise in the [brief](brief.md) they prove. Each names
its level. They become the rows of the impl's Test Trajectory.

All are `unit`: each is a rule fed inputs, over the fixture project the
cockpit's own tests already use.

## Behavioral Assertions

### `the-thirty-days-say-only-what-was-seen` — A promise's thirty days count a day as held only when seen upheld and not broken, as broken when a violation was heard, and as neither when nobody was watching; the dashboard and the page show the same days.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A promise seen upheld on three days and broken on one shows "held 3 · broke 1" on the dashboard. | unit |
| A2 | A promise that was never seen shows no held days, not thirty. | unit |
| A3 | Five violations heard on one day count as one broken day. | unit |
| A4 | A violation heard under a promise's earlier name is counted on its day, on the dashboard and on the promise page alike. | unit |
| A5 | For one promise, the dashboard row and the promise page give the same number of held days and broken days. | unit |
| A6 | The dashboard and the promise page count the same thirty days: a violation on the first of the page's thirty days appears on both, and one on the day before appears on neither. | unit |

### `a-question-is-answered-in-full` — When an agent asks several questions at once, the decision card shows each of them and an answer reaches the agent for each.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | An agent that asks two questions at once has both shown on the plan's card, and answering them gives the agent an answer to each. | unit |

### `approval-waits-for-a-finished-plan` — A plan is listed as waiting for approval only when its impl is written and no session is still writing it.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A plan whose impl is a draft while a session is still writing it is not under Needs you for approval; once the session ends, it is. | unit |

### `a-promise-sits-in-its-innermost-path` — The dashboard groups a promise under the innermost Path that declares its plan, and the nav shows the plan there.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | A plan declared by an outer Path and by a Path inside it is grouped under the inner Path on the dashboard, and the nav lists it there. | unit |

### `the-editor-shows-the-same-health-as-the-admin` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | For one project, `indusk promises status`, the dashboard and a promise's page report the same state for each promise and source. | unit |

### `indusk-leaves-main-clean` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | When `main` cannot take the history commit, an answered decision says it was sent and that the history was left uncommitted, with the reason, and nothing else on `main` is touched. | unit |

## Untestable Assertions

None.

## Notes

- A3 and A11 describe behaviour that exists today and that no row guards at
  its edge; they are regression guards.
- A1, A2 and A5 depend on the "held" reading in the brief's *Settled by
  default*; if it is revisited, these rows change with it.
