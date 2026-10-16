---
title: "A nav row reads at a glance — Test Plan"
date: 2026-10-16
status: draft
---

# A nav row reads at a glance — Test Plan

## Purpose

This document lists the behavioural assertions that, taken together, mean a
plan's row in the nav reads at a glance: title on one line, stage on the next,
and the worktree as a small mark beside the stage that opens to its name
without opening the plan. Each assertion names its level — the smallest that
can prove it — and so when its test runs. They are grouped by the promise in
the brief they prove.

Every assertion here is about what a person sees and clicks in the nav, and
every one is decided by the admin's own components and stylesheet, so nearly
all are `unit` tests in the admin's browser test project (real Chromium, the
real `globals.css`, no server), run by `pnpm test`. They measure the drawn
row — where the title, stage and mark sit, what a click at a point lands on —
rather than reading class names, so they hold whatever markup the build
chooses. One existing test that boots the admin and reads its served HTML is
kept as a regression guard; it is a `contract` test in the system tier.

Whether the row *reads better* is not a test: it is judged by a person when
the looks are approved. The three looks the brief names (`plan-row.worktree`,
`worktree-mark.closed`, `worktree-mark.open`) are already approved as mockups;
the stories built from the real components are approved against them by a
person in the cockpit, never by an agent.

## Behavioral Assertions

### `a-nav-row-keeps-its-parts-apart` — A plan's row in the nav shows its title on one line and its stage on the next, with its worktree as a mark beside the stage and apart from it; hovering or clicking the mark widens it in place to show the worktree's name, without opening the plan.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | In the nav, a plan with a worktree shows its title on the first line and its stage on the second, with a mark on the stage's line that shows no text, 8 px after the stage; the row is no taller than the row of a plan without a worktree. | unit |
| A2 | Clicking the mark does not open the plan; clicking the row's title, its badge or its stage still does. | unit |
| A3 | Hovering the mark widens it in place, on the stage's line, to show the worktree's name; moving the pointer away closes it again. | unit |
| A4 | Clicking the mark, or pressing Enter or Space on it, opens it to the worktree's name and announces it as expanded; doing so again closes it and announces it as collapsed. | unit |
| A5 | An open mark with a long worktree name ends in an ellipsis inside the row: the row keeps its width and its two lines, and the nav does not scroll sideways. | unit |

### `every-plan-is-one-click-away` and `the-nav-fits-a-phone` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | In a collapsed nav, the row of a plan with a worktree shows only its badge, no mark, and is as tall as any other row; clicking the badge opens the plan. | unit |
| A7 | A plan without a worktree is drawn as today: no mark, and the whole row is one link to the plan. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A8 | Served by the admin, the nav row of a plan assigned to a worktree still names that worktree in the page, even with the mark closed. | contract | a regression guard over the admin-plan-worktrees test that reads the served sidebar for the worktree's name; a closed mark shows no text, so the name must stay in its label |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The row reads at a glance. | A judgement, not a measurement (the brief has no expectation for it). | A person approves the `plan-row.worktree`, `worktree-mark.closed` and `worktree-mark.open` stories against their approved mockups in the cockpit before the plan is accepted. |

## Notes

- A1–A5 are red today: the worktree is a tag reading "⎇ name" inside the stage's text, inside the plan's link, with no gap and nothing to hover or click. A6 and A7 pass today and guard the collapsed nav and the rows without a worktree. A8 already exists in the system tier and passes today.
- A2 and A6 are measured by where a click lands — the element at the centre of the badge, the stage or the mark — not by the element tree, so they prove the click whether the build stretches the title's link over the row or draws the row another way.
- A4's "announces" is the mark's expanded state as a screen reader reads it (`aria-expanded`), the same attribute the approved mockups style the open mark by.
- The existing plan-row stories (needs, working, released, current, numbered, idle, queued) should render unchanged; that is checked by rendering the stories and comparing their snapshots, in the impl's verification, not by a row here.
