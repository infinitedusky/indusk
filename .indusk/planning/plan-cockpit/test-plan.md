---
title: "Plan cockpit — Test Plan"
date: 2026-10-10
status: draft
---

# Plan cockpit — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
cockpit is working. Each names its level — the smallest of unit / contract /
live check / smoke / promise that can prove it — and they are grouped by the
promise in the [brief](brief.md) they prove. They become the rows of the
impl's Test Trajectory.

Most are `unit`: a page or the nav rendered from a fixture project in the
admin's browser test project, at a set width where width matters. Two are
`live check`s, run once against the real admin and the seat-holds demo and
recorded in the plan.

## Behavioral Assertions

### `every-plan-is-one-click-away` — Every active plan in a project is one click away from any page of the admin.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | On a plan page, the promise dashboard and a promise page, the nav lists every active plan in the project, and clicking one opens its page with it marked current. | unit |

### `paths-keep-their-order` — The nav shows Paths and their plans in the order the project declares them, nested as deep as they are declared, each Path with how many of its plans are released.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | Paths and the plans in them appear in the order the project's master files declare, numbered. | unit |
| A3 | A Path declared inside a Path inside a Path shows three levels deep. | unit |
| A4 | Each Path shows how many of its plans are released, counting only plans a release has shipped. | unit |
| A5 | A plan that no Path declares still appears in the nav. | unit |

### `the-nav-fits-a-phone` — Below 760 px wide the nav is a drawer, closed by default, and no page scrolls sideways; above it the nav can collapse to a strip and remembers that choice.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | At 400 px wide the nav is closed, and the menu button opens and closes it. | unit |
| A7 | At 400 px wide, with forty plans, none of the plan page, the dashboard or a promise page scrolls sideways. | unit |
| A8 | On a desktop width, a collapsed nav is still collapsed after a reload. | unit |

### `a-plan-shows-two-workflows` — A plan's page shows Planning and Release as two lists, each with its own progress, every step's state read from the plan's documents and phases, never set by hand.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | A plan's page shows Planning and Release as two separate lists, each with its own count of steps done. | unit |
| A10 | A plan's steps follow its type: a bugfix shows no Research or Decision step, and a ritual skipped with a reason shows as skipped, not missing. | unit |
| A11 | A plan mid-build shows Planning complete and Release in progress at Build; one at review shows Build, Falsify, Cleanup and Audit done and Review current. | unit |
| A12 | Changing a plan document's status on disk changes its step on the next refresh, and nothing on the page sets a step's state. | unit |

### `decisions-wait-in-one-place` — When a plan is waiting on the person it is listed under Needs you, and its page shows the one decision with accept, the alternative and a reply in words; the answer reaches the agent and is recorded in the plan's history.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | A plan whose agent has asked a question, a plan waiting for approval, and a plan stopped for review each appear under Needs you, naming the step they wait at; a plan waiting on nothing does not. | unit |
| A14 | A waiting plan's page shows exactly one decision, with accept, the alternative and a reply in words. | unit |
| A15 | Choosing an answer on the card gives the running agent that answer, and it carries on. | unit |
| A16 | A reply in words reaches the plan's agent whether or not a session is running for it. | unit |
| A17 | After the admin is restarted, the plan's history still shows each decision, the answer and when. | unit |

### `every-promise-is-listed` — The promise dashboard lists every promise in the project in words, and can be grouped by state, plan or Path, sorted, and filtered by text.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | The dashboard lists every promise in the registry, each as its sentence in words with its name and its plan's title. | unit |
| A19 | Grouping by state, by plan and by Path each puts every promise in exactly one group; sorting by latest activity puts the most recently seen first. | unit |
| A20 | Filtering by text matches a promise's sentence, its name and its plan. | unit |
| A21 | A declared promise with tests written but not all passing shows as being proven. | unit |

### `broken-promises-come-first` — A broken promise is counted in the nav and listed first on the dashboard.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A22 | A broken promise is counted in the nav on every page. | unit |
| A23 | Broken promises are listed first on the dashboard, the latest break first. | unit |

### `a-promise-page-shows-its-proof` — Each promise has a page showing the tests that name it with their state, the marks it is watched by and how each was last seen, thirty days held and broken per source, and its dated history; when it is broken while every test passes, the page says the tests miss the case.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A24 | Every promise on the dashboard opens its own page, which has its own address. | unit |
| A25 | The page lists every test row, in any plan active or archived, that names the promise, with its state and its test files. | unit |
| A26 | The page lists each place the promise was marked in the running system and when each was last seen holding or broken; a promise never seen says so. | unit |
| A27 | The page shows each of the last thirty days held and broken, per source, with broken days marked. | unit |
| A28 | The page's history lists, dated, when the promise was declared, confirmed and changed, and each incident. | unit |
| A29 | A broken promise whose every test passes says the tests miss the case that breaks it. | unit |

### `the-admin-keeps-what-it-heard` (changes) — … each promise's own page shows them counted per day over thirty days, whether or not a page was open when they happened.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A30 | A violation recorded while no admin page was open appears on that promise's page, on the day it happened. | unit |

### `a-break-opens-a-fix-in-one-click` (must not break) — From a broken promise, one action starts the developer's own `claude` in the project with the promise, its symptom, its trace link and its tests already given.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A31 | *Start a fix plan* on a broken promise's page starts the developer's own `claude` in the project with the promise, its symptom, its trace link and its tests given. | unit |
| A32 | With the seat-holds demo running, turning its fault switch on shows the promise broken on the dashboard and counted in the nav; its page says why; *Start a fix plan* starts the fix; no terminal is used. | live check |

### `the-editor-shows-the-same-health-as-the-admin` (must not break) — A promise's state in the editor is the one the admin and `indusk promises status` report, for each source, from one reader.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A33 | For the same project, the dashboard, a promise's page and `indusk promises status` report the same state for each promise and source. | unit |

### `display-names-are-defined-once` (must not break) — How a promise or a plan is named for a person, and a plan's dates, are worked out in one place in the package.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A34 | The cockpit's promise words, plan titles and release dates are the ones the package's display module gives; the admin has no naming of its own. | unit |

### `a-review-shows-its-evidence` (must not break) — When a build stops for review, the panel shows what was built and the evidence.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A35 | A plan stopped for review shows, with its decision, each promise with the passing tests that prove it, what falsification found and fixed, and the files changed; accepting it there accepts the plan. | unit |

### `a-plan-can-start-from-the-admin` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A36 | A new plan can still be started from the admin under the new nav. | unit |

### `the-demo-break-is-caught-locally` (must not break)

Proven by A32 (live check), which names it as well.

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The cockpit reads as the mockup does: a newcomer watching the recording follows it. | Judgment of a viewer, not a fact a test reads | The demo-rehearsal take, reviewed by Sandy before it is recorded |

## Notes

- A16's shape depends on the ADR's answer to how a reply reaches a plan with
  no running agent (research, open question 1); its assertion holds either way.
- A26 is limited by what exists: nothing declares a promise's marks, so the
  list is of places it has been seen; "never seen" is the honest empty state.
- Width assertions (A6, A7) run in the browser project at a set viewport; if
  that proves flaky they move to the system tier, not to `live check`.
