---
title: "The planner asks for promises"
date: 2026-10-04
status: draft
workflow: feature
---

# Planner promises — Brief

## Problem

A plan that should make promises gets them only if someone writes the
registry files by hand. In the demo, the first plan requires promises and
they should come out of planning.

## Direction

- The planner skill asks, at brief and test-plan time, what this plan promises
  will stay true, and writes each as a promise in `.indusk/promises/` with this
  plan as owner, `state: declared`.
- The impl's rows name the promise each test guards; the promise becomes
  `enforced` when its tests pass.
- The minimal slice of `day-contract` (component 4c in the Day master plan,
  promises declared in planning, named by every row, confirmed at close).

## Part of

[indusk-demo](../indusk-demo/master.md), step 6.
