---
title: "A promise reads the same on its plan's page — Test Plan"
date: 2026-10-17
status: accepted
---

# A promise reads the same on its plan's page — Test Plan

## Purpose

The assertions that mean a plan's page and its brief page colour each promise by the health the Promises page shows. Each names the smallest level that proves it. They become the impl's Test Trajectory rows.

## `a-promise-reads-the-same-on-its-plan-page`

A plan's page and its brief page colour each of the plan's promises by the same health the Promises page shows for it, read from the same rule.

### `broken-reads-broken` — A behaviour promise with a break that is still live has the broken colour on its plan's page and its brief page.

- Signal: the plan's page and brief page themselves, read by a person or by the look check; upheld when a promise the Promises page shows broken has the broken colour there; broken when it shows any other colour.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan whose enforced behaviour promise has a break no incident records shows that promise's dot in the broken colour on its plan's page, not the healthy green it shows today | unit |

### `each-health-alike` — A promise that broke and was fixed, one seen holding, one with no signal and one known broken each have on those pages the colour the Promises page gives them, and a promise with no signal is never green.

- Signal: the same pages; upheld when each promise's dot matches its colour on the Promises page; broken when one differs, or a promise with no signal is green.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | On a plan's page, a promise that broke and was fixed, one seen holding, one with no signal, one known broken and a state promise each show the colour the Promises page gives them, and the enforced behaviour promise nothing has reported on is grey, not green | unit |

### `no-rule-of-its-own` — The plan's page and its brief page decide no health themselves; they read it from the package's health rule, from the source the nav's red dot reads.

- Signal: the health the plan's parts carry; upheld when it is the package's answer for the alarm source; broken when the plan page's answer differs from the nav's for the same promise.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A3 | For a project with a production source holding and a local break, the plan's parts read each promise's health exactly as the nav's red dot does, from the alarm source, so a laptop break alone does not turn the plan page red | unit |

## Notes

- The pages are not started in these tests: the parts are read by the package from a fixture project and handed health from fake source reads, and the promise chips are rendered from those parts.
