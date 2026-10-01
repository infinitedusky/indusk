---
title: "The admin says what kind of plan it is — Test Plan"
date: 2026-10-01
status: accepted
accepted: 2026-10-01
---

# The admin says what kind of plan it is — Test Plan

## Purpose

The assertions below, taken together, mean the bug is fixed: a person opening a
plan in the admin can tell what kind of plan it is, and can tell a document the
plan was never going to have from one it should have had. Each names how it will
be tested. They become the rows of the impl's Test Trajectory.

There is no ADR — this is a bugfix-type plan — so the few design choices the
assertions depend on are stated in the Notes, where they can be disagreed with
before code exists.

## Behavioral Assertions

| ID | Assertion (what a person sees) | Mechanism |
|----|--------------------------------|-----------|
| A1 | Opening a plan whose brief declares a type shows that type — `bugfix`, `feature`, `refactor` or `spike` — as a chip in the plan header. | admin browser test (the plan page rendered with a declared type) |
| A2 | Opening a plan that declares no type shows **type not declared** in the header. It is never guessed from which documents exist. | admin browser test |
| A3 | Opening a plan that declares a word that is not one of the four types shows that word and says it is not a recognised type. It is not treated as a known type and not folded into "not declared". | admin browser test |
| A4 | Clicking the type chip opens an explanation in plain language: what the type is for, which documents it requires, which it skips, and why. It closes with Escape or its close button. | admin browser test (click, read, close) |
| A5 | On a bugfix plan, the absent research and the absent ADR read **skipped** — both when the plan has already moved past them and when they are still ahead. | package unit test on the lifecycle's plan-bar derivation |
| A6 | On a bugfix plan that has an impl and no test plan, the test plan reads **missing**. | package unit test |
| A7 | On a bugfix plan whose brief exists and whose test plan has not been written yet, the test plan reads **pending**, not missing. | package unit test |
| A8 | On a plan that declares no type, an absent earlier document reads **unknown**, never skipped; documents the plan has not reached yet still read pending. | package unit test |
| A9 | A feature plan with every document present reads exactly as it does today. | package unit test (regression guard) |
| A10 | When a document is missing or unknown, the page says so **in words** beside the bar — which document, and why (the type requires it; or no type is declared, so it cannot be judged). Not by colour or hover alone. | admin browser test |
| A11 | Every state a bar segment can be in has its own drawing and its own label in the admin; a state added to the lifecycle without one fails by name. | admin node test (the existing render-parity pin, extended) |
| A12 | What the admin says a type requires and skips is what the planner's workflow table says, and what each workflow template says it creates. One set of facts, three statements, pinned equal. | package test reading the module, the skill table and the four templates |
| A13 | The bugfix workflow template lists the test plan among the documents it creates. Today it lists only the brief and the impl, which contradicts the planner's own table and is how a bugfix closed without one. | package test on the template text |
| A14 | Every brief template the planner uses — the one in the skill and the one in each workflow template — carries a `workflow:` line, so a brief created by `/planner` declares its type. | package test on the skill and template text |
| A15 | The archived `release-ritual` plan — the bugfix that prompted this — reads `bugfix`, with research and ADR skipped and the test plan missing. | admin node test that reads this repository's real plan through the admin's reader |
| A16 | In this repository, every active plan declares a type: in its brief, or in its research document when the plan is research only. | package test over `.indusk/planning/` |
| A17 | The installed copy of the planner skill is byte-identical to the package's. | package test (regression guard; the existing skill parity) |
| A18 | The workflow-type definitions are reachable by their documented package subpath, from outside the package. | admin node test importing the subpath |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A brief written by an agent following `/planner` in a real session carries `workflow:`. | The planner is prose an agent follows; no test executes a skill. | A14 pins that every template the agent copies from carries the line, and A16 fails this repository's test run the first time an active plan lacks one. |

## Notes

Design choices these assertions rest on. Disagree here, before the impl is approved.

- **Where the type is read from.** The brief's `workflow:`. A research-only plan
  has no brief, so its research document's `workflow:` is read instead. An impl's
  `workflow:` is not read: one home per fact, and ten existing impls that declare
  it are on archived plans, which the brief leaves reading "type not declared".
- **"Skipped" also applies ahead.** A bugfix sitting at its brief shows the ADR
  as skipped already, not pending — the bar says up front what this type will not
  need. Without a declared type, a document ahead stays pending, as today.
- **Unknown only replaces today's skipped.** A plan with no type reads an absent
  *earlier* document as unknown. Nothing else changes for it.
- **The retrospective counts as required** for every type that ships an impl
  (bugfix, refactor, feature), although the planner's table lists it only for
  feature. The table describes what `/planner` creates; the retrospective is
  written by `/retrospective`, and every one of those plans gets one. A spike
  requires only its research document.
- **A16 is a standing check on this repository.** After this ships, `pnpm test`
  goes red if an active plan here lacks a type. That is deliberate: forgetting
  the field is exactly the kind of small skip a check should catch, and it is
  what makes U1 safe to leave untested.
- **A15 reads a real archived plan**, so it holds only while that plan's brief
  keeps its `workflow:` line and its documents stay as they are. Archived plans
  do not change, which is why it is a stable fixture.
