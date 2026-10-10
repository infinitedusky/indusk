---
title: "Plan cockpit — the promise dashboard, the promise page and the plan page"
date: 2026-10-10
status: draft
workflow: feature
---

# Plan cockpit — Brief

Stage 1 of the promise UI: the admin becomes the mockup in
[`research/promise-ui/mockups/plan-cockpit.html`](../../research/promise-ui/mockups/plan-cockpit.html).
What exists today, what the mockup draws and how its words map onto InDusk's
data are in [research.md](research.md).

## Expectations

1. **The recording shows a break caught and a fix started, entirely in the cockpit.**
   - Measure: the demo-rehearsal take — the break appears on the dashboard, its page shows why, and *Start a fix plan* starts the fix, with no terminal on screen
   - Look: at demo-rehearsal, the next step of the demo

2. **Sandy opens the cockpit, not a terminal, to find what needs them.**
   - Measure: Sandy's report; the admin emits no page telemetry today, so a page-view mark would be needed to count it
   - Look: two weeks after landing

## Promises

### This plan makes

1. **`every-plan-is-one-click-away`** (state). Every active plan in a project is one click away from any page of the admin.
2. **`paths-keep-their-order`** (state). The nav shows Paths and their plans in the order the project declares them, nested as deep as they are declared, each Path with how many of its plans are released.
3. **`the-nav-fits-a-phone`** (state). Below 760 px wide the nav is a drawer, closed by default, and no page scrolls sideways; above it the nav can collapse to a strip and remembers that choice.
4. **`a-plan-shows-two-workflows`** (state). A plan's page shows Planning and Release as two lists, each with its own progress, every step's state read from the plan's documents and phases, never set by hand.
5. **`decisions-wait-in-one-place`** (state). When a plan is waiting on the person it is listed under Needs you, and its page shows the one decision with accept, the alternative and a reply in words; the answer reaches the agent and is recorded in the plan's history.
6. **`every-promise-is-listed`** (state). The promise dashboard lists every promise in the project in words, and can be grouped by state, plan or Path, sorted, and filtered by text.
7. **`broken-promises-come-first`** (state). A broken promise is counted in the nav and listed first on the dashboard.
8. **`a-promise-page-shows-its-proof`** (state). Each promise has a page showing the tests that name it with their state, the marks it is watched by and how each was last seen, thirty days held and broken per source, and its dated history; when it is broken while every test passes, the page says the tests miss the case.

### Existing promises

**Must not break**

- **`a-break-opens-a-fix-in-one-click`**. The promise page's *Start a fix plan* is the admin's form of it; this plan's rows name it.
- **`a-review-shows-its-evidence`**. The decision card shows the review stop; the evidence stays as it is.
- **`display-names-are-defined-once`**. The cockpit names promises and plans, and dates plans, through that one module.
- **`the-editor-shows-the-same-health-as-the-admin`**. The new pages read health through the one reader the editor uses.
- **`the-demo-break-is-caught-locally`**. The demo's break must show on the new dashboard and promise page.
- **`a-plan-can-start-from-the-admin`**. The new nav and plan page keep the way a plan is started.

**Changes**

- **`the-admin-keeps-what-it-heard`**. The admin records every production violation its recorder sees, with when it happened and the incident it belongs to, and each promise's own page shows them counted per day over thirty days, whether or not a page was open when they happened.

**Replaces**

None.

### Not promised

- Editing plan documents in the UI: the cockpit reads plans and records decisions; writing a plan stays where it is.
- The home view as the hierarchy of premises, promises and phases: stage 2, [contract-ui](../contract-ui/brief.md).
- Declared eval triggers that run checks: InDusk watches marks on spans; a promise's checks running against live data is [promise-devtools](../../research/promise-ui/plans/promise-devtools/brief.md), after the launch.
- Multi-user accounts and permissions.

## Depends On

- [display-names](../archive/display-names/retrospective.md) — closed 2026-10-10
- [incident-recording](../archive/incident-recording/retrospective.md) — closed 2026-10-08

## Blocks

- demo-rehearsal (the demo's next step), via [indusk-demo](../indusk-demo/master.md)
- [contract-ui](../contract-ui/brief.md) — opens onto these pages
