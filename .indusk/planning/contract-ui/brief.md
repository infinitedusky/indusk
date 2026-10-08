---
title: "Contract UI — the admin organised around premises, promises and phases"
date: 2026-10-05
status: draft
workflow: feature
---

# Contract UI — Brief

## Problem

The admin is organised around the process: plans, their documents, their
phases and gates. That is how the work is produced, not what it is for, and it
shows the machinery — gates, trajectory rows, registers — to anyone who opens
it. Next to Linear it reads as more ritual, not less, even though every status
in it is derived rather than reported.

The [manifesto](manifesto.md) states the direction: the contract is the
primitive, at three levels — premises judged on evidence, promises that hold or
fail, phases that complete when tests pass — and nothing in the interface is
self-reported.

**Stage 2 of two** (Sandy, 2026-10-08). Stage 1 is
[plan-cockpit](../plan-cockpit/brief.md): the promise dashboard with broken
promises first, the promise page with its proof, and the plan page as its two
workflows with the decision it is waiting on. Those are the pages; this plan
is the home view and the premise level above them, and it changes nothing
inside them. The two do not overlap: a page belongs to stage 1, the hierarchy
that arranges the pages belongs here. Stage 1 is on the demo's path to the
recording; this plan is a child of the [demo](../indusk-demo/master.md) after
the launch, once plan-premises exists to give it a top level. The mockups both
stages were drawn from are in
[`.indusk/research/promise-ui/`](../../research/promise-ui/README.md).

## Proposed Direction

- **The home view is the hierarchy.** Premises at the top, the promises each
  rests on beneath them, the phases building each promise beneath those. Every
  item carries its derived state: a premise's latest scored reading and its
  evidence report; a promise's health per source and its timeline; a phase's
  tests. Plans and their documents are drill-down detail, reached from a phase.
- **Production first.** The landing screen leads with what the running system
  is doing to its promises — stage 1's dashboard, broken first, over the
  timeline built by [promise-timeline](../archive/promise-timeline/brief.md) —
  and what is being built toward them.
- **Groups follow the hierarchy.** Collapsible groups with a summary of their
  worst state, at each level: a premise's promises, a promise's phases. This
  replaces the grouping-by-plan-or-domain that promise-timeline's Build Phase 5
  was going to add to today's table, which would have been built on the
  structure this plan replaces.
- **No status a person types.** Where today's admin shows a status set by hand,
  this plan finds the evidence it should come from, or removes it.

## Context

- Linear is the comparison (Sandy, 2026-10-05): it took the best of agile
  without the accumulated ritual, and its newer direction is moving toward
  where InDusk is, but every status in it is still self-reported.
- Premises are defined by [plan-premises](../plan-premises/brief.md): never a
  gate, read by an advocate and a critic, scored by the person with a date and a
  reason. This plan draws them; plan-premises produces them.
- The demo ([indusk-demo](../indusk-demo/master.md)) runs through the admin; its
  story is this manifesto's.

## Scope

### In Scope
- The home view's hierarchy, each level's derived state, groups and their
  summaries
- Moving plan documents to drill-down detail
- Removing or deriving every hand-set status in the admin

### Out of Scope
- The promise dashboard, the promise page and the plan page — stage 1,
  [plan-cockpit](../plan-cockpit/brief.md); this plan opens onto them as the
  hierarchy's leaves and does not change them
- Producing premises and evidence reports (plan-premises)
- Writing plans from the UI (admin-plan-authoring)

## Success Criteria

- Opening the admin, a person sees what the system promises, whether each
  promise holds in production, and what is being built — without reading a
  gate, a trajectory row or a status anyone typed.
- Every state shown traces, in one click, to the evidence that produced it.

## Depends On

- [plan-cockpit](../plan-cockpit/brief.md) — stage 1: the pages the hierarchy
  opens onto.
- [promise-timeline](../archive/promise-timeline/brief.md) — the timeline and the
  per-source chips.
- [plan-premises](../plan-premises/brief.md) — for the top level. Without it the
  hierarchy starts at promises.

## Open Questions

- Does the manifesto ship with the demo, as its opening, or after?
- Where does the plan sequence (the master plans) appear, if anywhere, once the
  home view is the hierarchy?
