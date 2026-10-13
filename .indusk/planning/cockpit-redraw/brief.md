---
title: "cockpit-redraw"
description: "The cockpit's nav, plan page and brief page are redrawn to look as Sandy meant them — the nav from the original cockpit mockup, with every plan, Scorecards and a width you can drag — and each look is approved once. Re-approving a changed brief becomes something only a person can do."
date: 2026-10-13
status: accepted
workflow: feature
---

# cockpit-redraw — Brief

## Expectations

1. **Each cockpit look is approved about once per plan, not redrawn and re-approved in rounds.**
   - Measure: approval entries per look name per plan, from `.indusk/mockups/admin/approved.json`, against brief-as-the-contract's three rounds for the plan page
   - Look: after the next three plans that change the admin's looks

2. **Plan names in the nav are read whole.**
   - Measure: whether Sandy widens the nav and keeps it wider, read from the remembered width; and whether a plan name still truncates at the remembered width
   - Look: two weeks after landing

## Promises

### This plan makes

1. **`the-nav-widens-by-dragging`** (state). Above phone width a person can drag the nav's edge to make it wider or narrower within limits, and the admin remembers that width.
2. **`only-a-person-reapproves`** (state). Re-approving a changed brief is done only by a person: `indusk plans reapprove` run from an agent's tool call is refused, as approving a look already is.

### Existing promises

**Must not break**

- **`every-plan-is-one-click-away`**. The nav is redrawn; every active plan stays one click away.
- **`paths-keep-their-order`**. The plan tree is drawn as a mockup now; its order and nesting stay the project's.
- **`decisions-wait-in-one-place`**. Needs you moves into the redrawn nav.
- **`broken-promises-come-first`**. The broken count stays in the nav.
- **`a-promise-sits-in-its-innermost-path`**. Paths are redrawn.
- **`the-nav-fits-a-phone`**. Dragging the width applies above 760 px only; below it the nav stays a drawer.
- **`a-plan-builds-only-after-approval`**. Its clause "or that has an amendment waiting" gets the test row it lacks.
- **`a-mockup-is-approved-by-a-person`**. Every look here is drawn by the agent and approved by Sandy.

**Changes**

- **`a-plan-page-shows-the-parts-of-its-brief`**. A plan's brief page shows its description, promises, expectations and looks beside the agent writing them, each updated as it writes; the plan page opens with the description and whether the brief is finished, one click from the brief.

**Replaces**

None.

### Not promised

- A draft's agent drawing looks before the plan exists — a later plan; it changes where a draft keeps its files.
- The plan-page sections dropped in brief-as-the-contract (Papers, the type chip, falsification hypotheses, skipped-ritual reasons) — gone unless the redrawn plan page draws them.

## Looks

### This plan makes

1. **`brief.writing`**. The brief page while the plan is written: description, promises, expectations and looks on the left, the brief below them, the agent's column on the right, window-tall.
2. **`brief.approved`**. The brief page once the plan is approved: the same parts, the agent's column offering to amend.
3. **`nav.wide`**. The nav dragged wider, every plan name whole.
4. **`nav-handle.default`**. A new component, the nav's drag edge, drawn on its own.
5. **`nav-handle.dragging`**. The same edge while it is dragged.

### Existing looks

**Must not break**

- **`nav.collapsed`**. Collapsing to the strip stays as approved, unless redrawn below.

**Changes**

- **`nav.expanded`**. Redrawn from the original cockpit mockup on the current foundation: project, Needs you, Scorecards, Promises, Looks, then every plan in the project under its Paths with its stage.
- **`plan.parts`**. The plan page opening with the description and "The brief is incomplete" as the current step, the rail's steps as links.
- **`plan.working`**. The plan page while built, with the description at the top.
- **`plan.needs-you`**. The plan page waiting on the person, with the description at the top.
- **`plan.released`**. The plan page once released, with the description at the top.

**Replaces**

None.

## Depends On
- `.indusk/planning/archive/brief-as-the-contract/` — closed 2026-10-13; the brief page and description this redraws.

## Blocks
- None.
