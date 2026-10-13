---
title: "cockpit-redraw — Test Plan"
date: 2026-10-13
status: accepted
---

# cockpit-redraw — Test Plan

## Purpose

The assertions that, together, mean the cockpit looks as Sandy meant it and
holds it: the nav widens by dragging, re-approval is a person's, the brief page
shows the brief's parts beside the agent, and every look the brief names is
held by value. Each names the smallest level that proves it, grouped by the
promise it proves.

## Behavioral Assertions

### `the-nav-widens-by-dragging` — the nav's edge drags wider or narrower within limits, and the width is remembered

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A1 | Dragging the nav's edge to the right widens the nav and narrows the page beside it; dragging past the widest or narrowest allowed width stops at that width. | unit |
| A2 | After a reload the nav opens at the width the person left it at. | unit |
| A3 | Below 760 px wide there is no drag edge: the nav is the drawer it was. | unit |
| A4 | Collapsing the nav to its strip and expanding it again returns it to the dragged width. | unit |

### `only-a-person-reapproves` — re-approving a changed brief is the person's alone

| ID | Assertion | Level |
|----|-----------|-------|
| A5 | An agent's command that runs `indusk plans reapprove` is refused, saying only a person re-approves, and the plan's approval is unchanged. | unit |
| A6 | An agent's command that calls the admin's re-approve route is refused the same way. | unit |
| A7 | The person's Approve on a waiting amendment, pressed in their browser, still re-approves the plan. | unit |

### `a-plan-page-shows-the-parts-of-its-brief` — the brief page shows the brief's parts beside the agent; the plan page opens with the description

| ID | Assertion | Level |
|----|-----------|-------|
| A8 | The brief page shows the plan's description, promises, expectations and looks, with the agent's column beside them. | unit |
| A9 | The plan page opens with the description and, until the brief is finished, "The brief is incomplete" with a way to the brief; once it is finished, a link to it. | unit |
| A10 | Every screen this plan names reads approved and the running admin holds it by value at each reference device, in a real browser. | contract |
| A11 | Live: talking to the agent on a brief page, a promise it adds and a look it draws appear on the page and are brought into view, without leaving it. | live check |

### `a-plan-builds-only-after-approval` — a must-not-break that lacked a row for its amendment clause

| ID | Assertion | Level |
|----|-----------|-------|
| A12 | While an amendment is waiting, checking off a build item is refused, naming the amendment. | unit |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The redrawn nav fits the cockpit's look as Sandy meant it. | Aesthetic judgement, not an observable rule. | Sandy approves each mockup before the plan is approved, and each story against its mockup during the build. |

## Notes

- A10 is `contract`: whether a browser draws what the mockup draws is a
  question about Chromium, so it runs in the system tier.
- A12 states a rule `check-gates-amendments.test.ts` already proves; the row
  gives the promise its named test.
