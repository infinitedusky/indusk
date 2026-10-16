---
title: "Looks as promises"
description: "Visual promises, approved on the plan page; the looks page becomes the design system."
date: 2026-10-15
status: living
subplans:
  - stories-replace-mockups
  - mockup-matching
  - approvals-merge-cleanly
  - owned-changes
  - plan-page-shows-its-looks
---

# Looks as promises

A child of [promise-core](../promise-core/master.md), which holds what this
group is for and where it sits in the order (its "Settled 2026-10-14/15"
section). The plans below are the open plans gathered under it on 2026-10-15.

## Carried here

- **The promise-page looks cannot be checked** (from `one-promise-language`,
  2026-10-15): `promise.broken` and `promise.enforced` read unchecked — their
  path is the promise list, which reports only the dashboard's states, and no
  promise is broken to show. Needs a seed with a broken promise and the promise
  page reporting its state.
- **The 57-second floor of an unchanged look check** (from `looks-check-speed`,
  2026-10-16, Sandy: accepted as information): about 40 looks can never be
  checked in dusk's checkout — pages that do not report their state, fixture
  plans answering 404 — and an unchecked look is always reopened, so every run
  pays for them. Make them checkable, or reuse an "unchecked, same reason"
  result when nothing changed. With it, a one-component check should reach
  seconds (it measured 89–95 s; the full check 98 s, from ~35 min).
