---
title: "Plan titles and stories — Test Plan"
date: 2026-10-14
status: accepted
---

# Plan titles and stories — Test Plan

## Purpose

The assertions that, together, mean every plan is named by a short title a
person would say, a master plan's page tells its story, and Needs you lists a
plan waiting on an amendment, without breaking the nav or the plan page. Each
names the smallest level that proves it, grouped by the promise it proves.

## Behavioral Assertions

### `a-master-plan-tells-its-story` — a master plan's page says what the master is for, then lists each of its plans in the declared order by title, with its description and how far along it is

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A1 | A master plan's page opens with the master's title as its heading and what the master is for beneath it, then how many of its plans are released, in draft and queued; the released count is the one its Path shows in the nav. | unit |
| A2 | The page lists every plan the master declares, in the declared order, numbered from 1, each by its title with its description. | unit |
| A3 | A released plan's row says "Released" and opens that plan; a plan in draft or being built says its stage as the nav says it and opens that plan; a declared plan with no folder yet says "Queued", is dimmed, opens nothing, and shows the title and description its master wrote for it. | unit |
| A4 | A master keeps its plans in its declared order whether each is written as a name alone or as a name with a title and description; a plan declared by name alone, with no folder yet, reads as its handle in words with no description. | unit |
| A5 | A master plan's page tells the look check it draws `plan.master`, whatever state the master's own documents are in. | unit |
| A6 | `plan.master`, the retitled plan and nav screens and the three `subplan-row` stories read approved, and the running admin holds each by value at every reference device in a real browser, against a fixture master with a plan in each stage. | contract |
| A7 | Live: on the running admin, Day's and Dawn's master pages each say what the master is for and list every plan in order with its title, description and stage. | live check |

### `a-plan-reads-by-its-title` — wherever InDusk names a plan, in the admin and in the editor, it shows the plan's title; the description is separate; a plan with no title reads as its handle turned into words

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A8 | A plan whose brief has a short title is named by it; a plan with no title, or a title that is only its handle, reads as its handle in words ("cockpit-redraw" reads "Cockpit redraw", product words spelled their way). | unit |
| A9 | A master plan is named by the title written in its `master.md`, and its description is the one written there. | unit |
| A10 | In the editor, a promise whose plan the checkout cannot read is grouped under that plan's handle in words, never the bare handle. | unit |
| A11 | Every plan row and Path in the nav, and every plan under Needs you, reads by its title with initials taken from that title; each still links to `/p/<project>/plan/<handle>`. | unit |
| A12 | The plan page's and the brief page's heading and crumb read the plan's title; the address keeps the handle. | unit |
| A13 | A plan worked in its own worktree is named by the title written in that worktree's brief, not the trunk's. | unit |

### `decisions-wait-in-one-place` — a must-not-break this plan completes: a plan waiting only on an amendment is listed under Needs you

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A14 | A plan waiting only on an amendment is reported as waiting on the person, at its Brief step; an approved plan with no amendment and nothing else waiting is not. | unit |
| A15 | That plan is listed under Needs you on every page, as its own page already says it waits. | unit |
| A16 | An answer sent to an amendment's wait through the plan's decision is refused, pointing at the amendment card, and the plan is neither approved nor released. | unit |

### `every-plan-is-one-click-away` — must not break

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A17 | Every active plan is still one click away from the plan page, the dashboard and a promise page, now under its title. | unit |

### `paths-keep-their-order` — must not break

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A18 | Paths and their plans keep the declared order, nesting and released counts under their titles. | unit |

### `the-nav-fits-a-phone` — must not break

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A19 | With a plan whose title is as long as the longest written, the drawer at 400 px still leaves no page scrolling sideways. | unit |

### `a-plan-page-shows-the-parts-of-its-brief` — must not break

| ID | Assertion (user-visible behaviour) | Level |
|----|------------------------------------|-------|
| A20 | The plan page still opens with the description, now under the title, and whether the brief is finished, one click from the brief. | unit |

### Not for a promise

| ID | Assertion (user-visible behaviour) | Level | Why |
|----|------------------------------------|-------|-----|
| A21 | The admin and the editor name a plan by the package's one title rule; neither holds a second. | unit | a regression guard over display-names' single definition, which this plan's title changes touch in three apps |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Each retitled plan's title and description say what the plan is, in words Sandy would use. | Judgement of wording, not an observable rule. | Sandy reads the retitle commits at review; the second expectation counts the plans left with no title written. |

## Notes

- A6 is `contract`: whether a browser draws what the mockup draws is a
  question about Chromium, so it runs in the system tier.
- A7 is the brief's first expectation, read once by Sandy; A1–A3 and A6 prove
  the promise.
- A14–A16 sit under `decisions-wait-in-one-place`, which the brief lists as a
  must-not-break because the nav does not keep it today for an amendment.
- A17–A20 restate rules existing tests prove; each row names that test so the
  retitle is held to it.
