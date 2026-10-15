---
title: "skip-reason-why — Test Plan"
date: 2026-10-14
status: accepted
---

# skip-reason-why — Test Plan

## Purpose

The assertions that, together, mean a skipped close-out step reads cleanly on the plan's page and a skip's reason is a summary. Each names the smallest level that proves it, grouped by the promise in the brief it proves.

## Behavioral Assertions

### `a-skipped-step-shows-why-on-request` — A step skipped with a reason reads "Skipped" on the plan's page, and its reason appears only when a person opens the "why?" beside it, whatever the reason's length.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | On the page of a plan whose falsification was skipped with a reason, the Falsify step's status reads "skipped" with a "why?" beside it, and the reason's words are not on the page. | unit |
| A2 | Opening "why?" shows the reason beneath the Falsify step; opening it again hides the reason. | unit |
| A3 | A step skipped with a reason of 950 characters reads exactly "skipped" in its status; the reason is shown only once "why?" is opened. | unit |

### `a-skip-reason-is-one-sentence` — A skipped falsification, cleanup or audit is refused at the retrospective unless its reason is one short sentence, and the skills that write a skip show one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | A finished plan whose cleanup is skipped with a reason longer than 120 characters is not ready for its retrospective, and cleanup is named as what is not satisfied. | unit |
| A5 | The same holds for a skipped falsification and a skipped audit with a reason over 120 characters. | unit |
| A6 | Such a plan's status says its skip reason is too long, not that it is waiting for the ritual to run. | unit |
| A7 | Each of the cleanup, falsify and audit skills states, beside its skip example, that the reason is one sentence of at most 120 characters, and its example is one. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A8 | A step with no reason (done, in progress, not yet) draws with no "why?". | unit | a regression guard: the four existing step looks must not change |
| A9 | A plan skipped with a reason of 120 characters or fewer is still ready for its retrospective. | unit | a regression guard: a short skip is still a valid skip (and `a-plan-is-audited-by-a-fresh-reader-before-it-closes` still accepts an audit skip with a reason) |

## Notes

- The looks `step.skipped` and `step.skipped-open` are held by the looks machinery, not by rows here: the mockups are approved in the cockpit before `plans approve`, and `plans accept` holds the plan until the step's two new stories are approved against them.
- Archived plans are never re-checked for readiness, so their long reasons do not block anything; they read "skipped" by A3.
