---
title: "Cockpit audit fixes — what plan-cockpit's cold audit found"
date: 2026-10-11
status: accepted
workflow: bugfix
---

# Cockpit audit fixes — Brief

plan-cockpit met every promise as worded and closed on 2026-10-10. Its cold
audit ([audit.md](../archive/plan-cockpit/audit.md), advisory) found where a
row proves something narrower than its sentence, and a few behaviours nothing
guards. This plan fixes those, and nothing else. What each finding is, and
the code it points at, is in the audit; the retrospective's *Audit Findings
Left Open* names the ones carried here.

## Expectations

None — this plan makes the cockpit's existing claims true; nothing new is
expected to follow from it.

## Promises

### This plan makes

1. **`the-thirty-days-say-only-what-was-seen`** (state). A promise's thirty days count a day as held only when the promise was seen upheld that day and not broken, as broken when a violation was heard that day (under its current or any earlier name), and as neither when nobody was watching — and the dashboard and the promise page show the same days for the same promise, over the same thirty.
2. **`a-question-is-answered-in-full`** (state). When an agent asks several questions at once, the decision card shows each of them and an answer reaches the agent for each.
3. **`approval-waits-for-a-finished-plan`** (state). A plan is listed as waiting for approval only when its impl is written and no session is still writing it.
4. **`a-promise-sits-in-its-innermost-path`** (state). The dashboard groups a promise under the innermost Path that declares its plan, and the nav shows the plan there.

### Existing promises

**Must not break**

- **`every-promise-is-listed`**, **`a-promise-page-shows-its-proof`**, **`broken-promises-come-first`**. The dashboard and the page are what change.
- **`decisions-wait-in-one-place`**. The card and the route change.
- **`the-editor-shows-the-same-health-as-the-admin`**. Its row is proven by comparing package functions to each other; this plan adds a row that runs `indusk promises status` and both pages for one project.
- **`indusk-leaves-main-clean`**. Each decision answered commits a note on `main`; the audit found no row that says what happens when `main` cannot take it.
- **`display-names-are-defined-once`**. The time format is now one `stamp`; the dashboard and the page must keep reading it.

**Changes**

None.

**Replaces**

None.

### Not promised

- The old Promises table's owner/domain/kind groupings, its retired toggle and its "as of when heard" marker, dropped by plan-cockpit with no row. They were replaced by the dashboard's state/plan/Path grouping on purpose; whether any should come back is Sandy's call, not this plan's default.
- Declaring a promise's marks, or running a promise's checks against live data: [promise-devtools](../../research/promise-ui/plans/promise-devtools/brief.md).
- Anything in the audit's list of other files that would have to change beyond the docs sidebar (fixed at plan-cockpit's close): the extension's packaging of the moved fix module is checked when the extension next releases.

## Settled by default

Sandy said these were not answers to give now (2026-10-11): the plan is to be
approved and left until the cockpit's own use shows what is wrong. Until then:

- **Held** is read strictly — seen upheld that day and not broken; a promise with no recorded runs shows no held days. Revisit when a dashboard row misleads in practice.
- **A finished impl** is one no running session is writing; the impl's own status is the alternative. Revisit when a plan is offered for approval too early.

## Looks

Added by main-suite-green (2026-10-14): this brief predates the rule that a brief carries a `## Looks`. Read from the impl's Files Affected against `.indusk/mockups/admin/screens.json`. **This amendment waits for the person's re-approval in the cockpit**; nothing here is approved until then.

### This plan makes

None.

### Existing looks

**Must not break**

- **`dashboard.empty`**, **`nav.collapsed`**, **`promise.broken`**, **`promise.enforced`**. The promise dashboard and page change in what they count and where a promise sits, not in how they look.

**Changes**

- **`decision-card.ask`**. When an agent asks several questions at once, the card shows each of them with its own answer; the approved look stays held until a person approves this one.
- **`dashboard.default`**. A promise is grouped under the innermost Path that declares its plan, and its thirty days show only what was seen; the approved look stays held until a person approves this one.
- **`nav.expanded`**. The nav lists a plan under its innermost Path; the approved look stays held until a person approves this one.

**Replaces**

None.

## Depends On

- [plan-cockpit](../archive/plan-cockpit/retrospective.md) — closed 2026-10-10

## Blocks

- None.
