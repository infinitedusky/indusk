---
title: "A finished ritual stays done — Test Plan"
date: 2026-10-16
status: accepted
---

# A finished ritual stays done — Test Plan

## Purpose

The behavioural assertions that, taken together, mean a plan's page keeps showing a finished ritual as done. All are `unit`: what a step reads is decided by a rule fed a plan's facts, with no server, clock or outside system involved. They are grouped by the promise they prove.

## Behavioral Assertions

### `a-finished-ritual-stays-done` — a plan's Falsify, Cleanup and Audit steps read done once their ritual is finished, and keep reading done when a later build phase reopens the plan to building

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan whose falsification and cleanup phases are closed and whose audit is written, with a later build phase still open, shows Falsify, Cleanup and Audit done and Build current | unit |
| A2 | The same plan read from its files on disk shows the same: Falsify, Cleanup and Audit done, Build current | unit |
| A3 | A plan with only its falsification closed and a build phase open shows Falsify done, and Cleanup and Audit not yet | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A4 | A plan midway through its falsification (the phase still open) shows Falsify current, and Cleanup and Audit not yet | unit | a regression guard over `a-plan-shows-two-workflows`: a ritual being worked still reads current |
| A5 | A ritual skipped with a reason still reads skipped, with its reason, not done | unit | a regression guard over `a-skipped-step-shows-why-on-request` |

## Untestable Assertions

None.

## Notes

- A4 and A5 pass today and must keep passing; A1–A3 fail today because a step is read only from where the plan stands.
