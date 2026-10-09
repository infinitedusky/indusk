---
title: "model-per-phase — Test Plan"
date: 2026-10-09
status: accepted
---

# model-per-phase — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean phases run on their tier's model and sessions end at plan boundaries. Each assertion names its level, the smallest that can prove it, and so when its test runs. They are grouped by the promise in the brief that they prove.

## Behavioral Assertions

### `each-phase-runs-on-its-model` — every phase runs on its tier's model, with no hand switching

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A phase whose plan names no tier is built on the model the config gives the work step's default tier. | unit |
| A2 | A phase whose plan names a tier is built on the model the config gives that tier. | unit |
| A3 | Changing a tier's model in the config changes the model the next phase is built on, with no plan edited. | unit |
| A4 | A project whose config names no tiers builds every phase on the session's own model, as today. | unit |
| A5 | Claude Code runs a phase handed to it on the named model, observed once against the real `claude`. | live check |

### `a-model-override-says-why` — a different tier carries its reason

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | An impl that gives a phase a tier other than its step's default, with no reason, is refused, naming the phase. | unit |
| A7 | The same impl with a reason is accepted; a tier that is not one of strong, med, weak or baby is refused, naming it. | unit |

### `a-struggling-phase-asks-for-a-stronger-model` — three misses name the next tier up

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A phase whose tests still fail after three attempts on `med` stops and names `strong` as the tier to run it on. | unit |
| A9 | A phase already on `strong` that fails three times stops as a blocker, as today, naming no higher tier. | unit |

### `a-plan-boundary-names-the-next-session` — every boundary says what to run next

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | Approving a plan ends by naming `/work <plan>` to run in a new session. | unit |
| A11 | Closing a phase ends by naming the command for the next phase, or for `/falsify` after the last build phase. | unit |

### `phase-boundary-record-never-malformed` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | A phase run on its own tier still records where it began, in the same shape Shape and verify read. | unit |

## Notes

- A5 is the open question from research: whether a subagent's or skill's `model:` setting is honoured. It runs first in the build; if it is not honoured, A1–A3 hold by `/work` naming the switch for the person, and the impl says so.
