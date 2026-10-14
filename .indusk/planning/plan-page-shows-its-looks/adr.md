---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: accepted
---

# A plan's page shows all its looks

## Goal

**A plan's page shows the mockups it proposes and the stories it built, apart, every one viewable in place, and nothing an earlier plan built posing as this plan's.**

Today a story opened on a plan's page says "open it on the Looks page", and a
plan that changes an existing component finds the earlier plan's story under
its redrawn mockup's name: story-first-phases' page read "2 of 2 approved"
while its redrawn phase row was waiting for Sandy. After this, the Looks part
has a Mockups section and a Stories section; the earlier build appears only
inside the changing mockup, labelled for comparison; and a mockup added after
approval says so.

## Y-Statement

**In the context of:**
the plan page's Looks part, built from the list of looks `readPlanParts` returns, where a component's story carries the same name as the mockup it was built from, so a plan that changes a component meets the earlier plan's story under its own mockup's name.

**Facing:**
a list keyed by name in which the story, added second, overwrites the mockup; stories given no page to draw; and nothing that tells this plan's stories from an earlier plan's.

**We decided for:**
a list of mockups and a separate list of this plan's stories; a story is this plan's when it reads proposed on the plan's branch or its approval records `plan` as this plan; any other story under a name the brief lists is attached to that mockup as `today`, a comparison carrying its page and the plan its mockup's earlier approval records, with no approval state; each mockup carrying `added` (the impl phase whose tasks name it, or none yet) when the brief's amendments since approval show it added; and the plan page drawing the two sections, the comparison fold and the mark.

**And against:**
showing a mockup and its same-named story as two rows in one list (the earlier build reads as this plan's story, which Sandy rejected); hiding the earlier build altogether (the person loses the one view of what the change replaces); a separate list of add-ons (a look added later is still one of the plan's mockups, and two lists for one kind drift).

**To achieve:**
a person sees every look of a plan from its page, a waiting mockup reads waiting, and only this plan's work asks for this plan's approval.

**Accepting:**
"this plan's story" is read from approval records and the branch, so a story changed on the branch by something outside the plan would list as the plan's; and a mockup approved before ownership was recorded labels its comparison without a plan name.

**Because:**
the mockup is the proposal and the story is the build, approved separately and at different moments; the plan's page should show what this plan asks of the person, and the earlier build only as context.

## Context

See `research.md`: the overwrite is in `readPlanParts`' loop over each app's
mockups and stories (`apps/indusk-mcp/src/lib/plans/parts.ts`); stories get
`document: null` there; story approvals already accept `plan`
(`looks/approvals.ts`); the brief's amendments since approval are already read
(`plans/amendments.ts`). `plans approve` and `plans accept` read mockups
through `approved-brief.ts` and were never fooled.

## Decision

1. `PlanParts.looks` holds the brief's mockups (and undrawn names), each
   `{ name, relation, approval, document, devices, app, plan, added: { phase: string | null } | null, today: { document, plan: string | null } | null }`.
2. `PlanParts.stories` holds this plan's stories under names the brief lists:
   each `{ name, approval, document, devices, app }`, where the story reads
   proposed on the plan's checkout or its approval's `plan` is this plan.
3. A story under a listed name that is not this plan's becomes that mockup's
   `today`, with its page; `today.plan` is the plan the mockup's previous
   approval records, or null.
4. `added` is set when an amendment with `part: "look"` and `was: null` names
   the mockup: `{ phase: string | null }`, the heading name of the first impl
   phase whose task line or folded detail names the mockup, or null while no
   phase does.
5. Story approvals made in the cockpit record `plan` as mockup approvals do,
   so a story approved during this plan's build stays listed as this plan's.
   Check the approve route passes the checkout's plan for stories; add it if
   not.
6. The plan page draws a `plan-looks` component: a Mockups section (count of
   approved mockups), each row opening in place, a changed one carrying the
   closed "Compare with today's build" fold, an added one its mark ("Added during build · for {phase}"); a Stories
   section (count, or "none built yet"), each row opening in place.

## Alternatives Considered

### Two rows under one name in one list
The earlier build reads as this plan's story.

### Hide the earlier build
The person loses the one view of what the change replaces.

### A separate add-ons list
A later mockup is still one of the plan's mockups.

## Consequences

### Positive
- Every look of a plan can be looked at from its page.
- A waiting mockup reads waiting; only this plan's work asks for approval.
- What a change replaces is one click away, plainly labelled.

### Negative
- Reading "this plan's story" depends on approval records carrying `plan`.

### Risks
- A story approved before this plan's change to the approve route carries no `plan` and, once approved, would drop from the Stories section into the comparison fold. Mitigation: decision 5 lands before any story is approved in a plan that relies on it; the plan's own stories are approved after this lands.

## Documentation Plan

### Pages
- Update: the plan page section under `apps/docs/src/reference/admin-ui/` — the two sections, the comparison fold, the "added during build" mark.

### Diagrams
- None.

### Changelog
- "A plan's page shows its mockups and the stories it built in two sections, each opening in place; a changed component's current build shows only inside its mockup, for comparison; a mockup added after approval says so."

### ADR in Docs
- No; recorded in the plan.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder
- `.indusk/planning/story-first-phases/` — where the fault was seen
