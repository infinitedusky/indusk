---
title: "Day step 4a — Promises — Test Plan"
date: 2026-09-18
status: draft
---

# Day step 4a — Promises — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
promise primitive is working: a registry a project can write by hand, a check
that refuses a registry that lies, adoption in three projects, and an admin
page that shows declared state without ever pretending to have observed
anything. Each assertion names the mechanism by which it will be tested — not
the test code, but the test approach. When all assertions can be made true by
an architecture, we have a feature; when all are passing in code, it is shipped.

The assertions become the rows of the impl's `## Test Trajectory`. The ADR
that follows is constrained by "what makes all of these true?" — in
particular the registry's location and format, the per-kind link rule, and
whether `declared` is a state of its own.

Vocabulary, so the rows read alone: a **promise** is a sentence about
behaviour the system upholds, with a kind (`behaviour`, `state`,
`structure`), a state (`declared`, `enforced`, `known-violated`, `retired`), a
domain, an owner plan and links (code sites, tests). The **check** is
`indusk promises check`. A **chip** is the promise's badge on the admin's
Promises page. "Names a promise" means a file contains the promise's name in
the form the ADR fixes (looper's form is a greppable comment in code and an
`expects=` argument in tests).

## Behavioral Assertions

**Every assertion must be observable from outside the system.**

### The check refuses a registry that lies

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | In a project with no registry, `indusk promises check` exits non-zero and names the path where one is expected. A missing registry is never reported as clean. | vitest integration (CLI against a temp project) |
| A2 | A name cited in code or in a test that has no entry in the registry fails the check, naming the file and the name. | vitest integration (CLI) |
| A3 | An `enforced` `behaviour` or `state` promise with no test naming it, or no code site naming it, fails the check, naming the promise and which link is missing. | vitest integration (CLI) |
| A4 | An `enforced` `structure` promise with no check naming it fails; one with a check and no code site passes. | vitest integration (CLI) |
| A5 | A `known-violated` promise with no incident fails; one with an incident passes with no code site and no test. | vitest integration (CLI) |
| A6 | A promise whose domain is not on the project's declared list fails, naming the domain and listing the declared ones. A project with no declared domains fails on its first promise, saying where to declare them. | vitest integration (CLI) |
| A7 | A promise whose owner is not a plan in this project (active or archived) fails, naming the owner. | vitest integration (CLI) |
| A8 | A `declared` promise passes with no links while its owner plan is not archived, and fails once the owner is archived. | vitest integration (CLI) |
| A9 | A code site or test naming a `retired` promise fails, naming the file: a retired name cannot keep reporting. | vitest integration (CLI) |
| A10 | A registry entry missing its kind, state, statement or owner fails the check naming the entry; the entry is never skipped. | vitest integration (CLI) |
| A11 | A registry where every promise has the links its kind requires exits 0 and prints a summary: promises by state and by kind, and the incidents. | vitest integration (CLI) |
| A12 | The check reads code sites and tests from the code repo and the registry from the plan root when the project is a one-repo workbench, and refuses by name when zero or several repos are declared. | vitest integration (CLI, over the four workbench layouts) |

### Adoption

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A13 | Looper's eleven expectations, carried into the InDusk registry form, pass the check in looper's repo with the same states as today: eight `enforced`, three `known-violated`; looper's own validator is retired from its lint step in favour of the InDusk one. | manual smoke (looper) |
| A14 | Numero holds at least three `enforced` promises, each with a code site and a test, and the check passes in its CI. | manual smoke (numero) |
| A15 | Dusk holds three promises, one per kind, and the check passes as part of `pnpm test` at the repo root: a structure promise on the shared definitions (the pins), a state promise on the phase-boundary record, and a `behaviour` promise on the gates having run at every checkoff. | vitest integration (CLI against the dusk root) |
| A16 | An incident record carries symptom, root cause, the promise, its source (`local`, `smoke`, `deployed` or `desk`), status and fix; one missing a field, or with a source outside the four, fails the check naming the incident. | vitest integration (CLI) |

### The Promises page

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A17 | The admin sidebar has a Promises entry beside Scorecards; the page lists every promise in the registry, one row each, with chip, name, statement, kind, domain, owner plan, code sites, tests and incident count. | vitest browser (component) + http smoke (next-dev) |
| A18 | The page groups by owner plan, by domain, by state and by kind; each grouping shows every promise exactly once. | vitest browser (component) |
| A19 | Every `enforced` promise renders as a hollow chip labelled as declared, not yet observed; nothing on the page renders an upheld or violated health. | vitest browser (component) |
| A20 | A `known-violated` chip shows its incident; a `declared` chip is outlined; `retired` promises are hidden by default and shown by a toggle. | vitest browser (component) |
| A21 | Every promise state has a chip label and colour; a state added to the union without one fails the parity test naming the state. | vitest (render-parity test, extended) |
| A22 | An archived plan that owns promises shows "holding N" on its archived segment in the sidebar and on its plan page; a plan that owns none shows no count. | vitest browser (component) |
| A23 | A malformed registry renders an error block on the Promises page naming the file and the entry, never an empty table; a project with no registry says so and how to create one. | vitest browser (component) + http smoke (next-dev) |
| A24 | The page renders the registry as it is at request time: an entry added to the file appears on the next load with no restart. | http smoke (next-dev) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The registration rule ("register it if its breakage would need a plan to reopen") keeps looper's eleven in and keeps one-shots and process facts out. | A judgment about which facts are promises, not a behaviour of the code. | Re-applied to looper's eleven and to dusk's exclusion candidates in Build Phase 1, recorded in the ADR's Decision section; A13 is the executed half. |
| U2 | Dusk's `behaviour` promise (the gates ran at every checkoff) is observed. | Its observer is the gate ledger Day step 5 builds; nothing records a hook run today. | Its chip is hollow by A19, which is the honest reading; step 5 wires the source. |

## Notes

- A1, A10 and A23 all follow the standing rule that "could not check" is never
  reported as clean: a missing or malformed registry is a refusal at the
  check and an error block on the page.
- A12 follows `resolveExecutionRoots`: the registry is plan-root state, the
  links are code-repo facts. The four-layout helper
  (`src/__tests__/helpers/versioned-workbench.ts`) is the fixture.
- A13 and A14 are manual smokes in other repos and are recorded with their
  output in the impl's Verification items; the trajectory reports them
  `unverified` until run, never passed.
- A4's per-kind link rule (a structure promise needs a check, not a code
  site) and A8's treatment of `declared` are the two rows the ADR could
  change; if it does, the rows change with it before the impl is written.
- Mechanism note: CLI rows run through `runCli` against the built binary, so
  the impl's Test Phase 1 needs a build; component rows run in the admin's
  vitest browser project, which mocks every export a component imports.
