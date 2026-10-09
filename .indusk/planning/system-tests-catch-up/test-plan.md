---
title: "system-tests-catch-up — Test Plan"
date: 2026-10-09
status: draft
---

# system-tests-catch-up — Test Plan

## Purpose

The behaviour is already right; these assertions say what the three tests should have asserted after 2026-10-08, and that the whole system tier passes again.

## Behavioral Assertions

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A1 | The catchup skill's check passes on today's text ("open violations outrank the roadmap") and fails on a skill that puts the roadmap first | unit | a regression guard over `an-open-incident-stays-loud`'s catchup half, worded to the meaning, not one phrasing |
| A2 | With the project's server unreachable, a behaviour promise with no incident reads hollow `unverified`, the promise whose break the admin recorded reads `amber`, and no chip reads green | contract | the A17 regression guard, asserting what incident-recording made true |
| A3 | Production's chip is red while the incident the admin recorded for its break is open, and `fixed` once that incident is fixed with `indusk promises fix` | contract | the A9 regression guard over `lesson: a-fixed-break-is-history-not-health`, through the incident the recorder writes rather than one written by hand |
| A4 | Every system-tier test in dusk passes | contract | the release's precondition today; the repair is done when this holds |

## Notes

- A1–A3 pass the moment they are rewritten: the code is right and the old tests asserted what the 10-08 changes deliberately replaced. They are regression guards, not red-then-green rows.
