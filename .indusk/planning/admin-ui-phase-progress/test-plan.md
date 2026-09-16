---
title: "Admin UI Phase Progress — Test Plan"
date: 2026-09-16
status: accepted
---

# Admin UI Phase Progress — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
feature is working. Each assertion names the mechanism by which it will be
tested — not the test code, but the test approach. When all assertions can be
made true by an architecture, we have a feature; when all are passing in code,
the feature is shipped.

The assertions become the source rows for the impl's `## Test Trajectory`.
The ADR that follows is constrained by "what makes all these assertions true?"

Mechanisms used here:

- **browser** — vitest browser project (Playwright chromium,
  `vitest-browser-react`), rendering a component with every import mocked from
  its actual module, per the admin's convention.
- **node** — vitest node project: readers, the lifecycle definition, pins, CLI
  spawns with `INDUSK_HOME` pointed at a temp dir.
- **e2e** — Playwright against a real `next dev` of the admin over a fixture
  project (the existing `http-*.test.ts` harness spawns `next dev`; the live
  assertions need a browser on top of it — a new harness, or these two rows
  become manual smokes if it proves too heavy; decided in the ADR).
- **corpus** — node test that runs the new reader over every impl in
  `.indusk/planning/` and `.indusk/planning/archive/` (83 plan folders today,
  5 active and 78 archived; those without an impl are exercised by the
  plan-bar rows only).

## Behavioral Assertions

### Rendering the impl as it is

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A plan whose impl has `### Test Phase 1` and `### Build Phase 1…N` shows each as its own phase on the plan page, in document order, each with only its own checklist under it — today they all read as one long Phase 1. | browser (fixture: a real archived impl) |
| A2 | A trajectory row that passes at Test Phase 1 is listed under Test Phase 1, not under Build Phase 1. | browser |
| A3 | Every impl in the planning folder and its archive renders the same phases, in the same order, with the same item counts, as the package's own parser reports for it. | corpus |
| A4 | Each phase shows its stages — implementation items as n of m, then Verification, Context, Document, and OTel when the project emits it — each marked done, pending, or opted-out with the recorded proof text. | browser |
| A5 | An OTel gate's items appear under an OTel stage, not folded into the stage before it. | browser (consumer-shaped fixture) |
| A6 | The phase that is currently being worked is visibly marked active: it is the phase whose boundary record is the most recent among phases with unchecked gates. A phase with a boundary record and every gate checked shows as closed. A plan with no boundary records still marks the first phase with unchecked items. | node (reader) + browser (render) |
| A7 | A malformed line in the phase-boundary record produces a visible error on the plan page, never a silently un-marked phase. | node + browser |

### The bars

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A8 | Every segment of every bar is one of done, active, or pending; skipped positions are drawn as skipped, so two plans at different stages have bars of the same shape. | browser |
| A9 | The active phase stage is partially filled by its own n of m and labelled with a verb ("verifying: 2 of 5"); done stages are full, later stages empty. | browser |
| A10 | The plan bar shows every lifecycle position from research to archived with the current one marked and labelled with what it awaits ("brief drafted, awaiting acceptance"); a plan with no research document shows research as skipped, not missing. | browser + node |
| A11 | A plan in execution shows its plan-bar label as the current activity taken from the phase bar ("executing: verifying Build Phase 2"); an archived plan shows no activity at all. | browser |
| A12 | A parent plan shows a master bar derived from its declared subplans: closed ones full, executing ones partial, pending empty, labelled with the count ("3 of 10 closed, 2 executing"). Declaring a new subplan lengthens the bar; archiving one fills a segment. | browser + node |
| A13 | The positions the plan bar shows are the same ones `list_plans` reports and the retrospective readiness gate checks; those two behave exactly as before for every plan in the corpus. | corpus (parity before/after) |

### Live

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A14 | With a plan page open, checking off an item in the impl on disk changes the phase bar within one polling interval, with no reload, and any collapsible the viewer had open stays open. | e2e |
| A15 | The page shows a "last updated" time that advances on each refresh, and stops advancing (with a visible notice) if a refresh fails. | e2e |

### One definition

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A16 | The admin contains no phase-heading regex of its own, and exactly one phase-heading parser and one lifecycle definition exist across the package and the admin. | node (single-definition pin) |
| A17 | Adding a stage to the lifecycle definition without adding its rendering fails a test that names the missing stage. | node (the "a plan that adds a stage renders it" pin) |
| A18 | A Test Phase can be Shape-reviewed: asking for the review of Test Phase 1 returns the phase's files rather than skipping, and recording "nothing to change" lands under Test Phase 1's heading, not Build Phase 1's. | node |
| A19 | Progress and boundary records for Test Phase 1 and Build Phase 1 of the same plan are kept apart: each reports its own counts and its own opening commit. | node |

### Sidebar, registry, scorecards, hygiene

| ID | Assertion | Mechanism |
|----|-----------|-----------|
| A20 | The sidebar shows one root node for the master plan, with the parent plans and the unclaimed plans under it; a Dawn sub-plan declared under two parents appears under both. | browser |
| A21 | `indusk ui prune --dry-run` lists every registry entry whose path no longer exists and writes nothing; `indusk ui prune` removes exactly those, leaves a backup file beside the registry, and keeps every live entry. | node (CLI, temp `INDUSK_HOME`) |
| A22 | Running the repository's test suite leaves the developer's real `~/.indusk/projects.json` byte-identical. | node (a scan asserting every test that spawns `init`/`update`/`ui` sets `INDUSK_HOME`) |
| A23 | The project list shows every registered project whose path exists, each labelled workbench or normal-mode; an entry whose path is gone is not shown as a project. | browser + node |
| A24 | A project with no evaluations yet shows "no evaluations recorded yet" on its scorecards page, not an empty list. | browser |
| A25 | `pnpm exec tsc --noEmit` in the admin exits 0, and the suite fails when it does not. | node |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The plan bar's segment sizes do not mislead about how much work remains (research-through-ADR is conversation; `/work` is most of the calendar time). | UX judgement | Sandy reviews the first rendering against three real plans at different positions before the phase closes; the ADR records the weighting choice and the bar carries a "checklist, not a time estimate" note if unweighted |
| U2 | The polling interval is short enough to feel live and long enough not to load the daemon. | Depends on machine and habit | Interval is a config value with a documented default; revisit after two weeks of use |

## Notes

- A14/A15 are the only rows that need a browser against a running server. If
  the existing `next dev` harness cannot host Playwright cheaply, they become
  manual smokes with a written procedure, and the ADR says so.
- A3 and A13 are parity rows over the corpus: they exist so that swapping the
  admin onto the package parser and the package onto the lifecycle definition
  changes nothing for the 83 plan folders that exist today.
- A6's rule for "active" is deliberately stated in the assertion so the ADR
  cannot leave it implicit — the research found every silent fallback in this
  area over-reports, and the UI must not invent an active phase.
- A22 is the fix for the 1,577 dead entries: not a one-time purge but a
  guarantee the leak is closed.
