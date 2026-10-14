---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: accepted
---

# A plan's page shows all its looks

## Goal

**Every look a plan names can be looked at on the plan's own page, and each shows its true state.**

Today a story opened on a plan's page says "open it on the Looks page", and a
mockup that shares its name with a story disappears behind the story:
story-first-phases' page read "2 of 2 approved" while its redrawn phase row
was waiting for Sandy. After this, a story draws in place like a mockup, and a
mockup and its story show as two rows, each with its own state.

## Y-Statement

**In the context of:**
the plan page's Looks part, built from the list of looks `readPlanParts` returns for a plan, where a component's mockup and its story carry the same name.

**Facing:**
a list keyed by look name, so the story, added second, overwrites the mockup; and a story given no page to draw, though the Looks page already builds one.

**We decided for:**
a list with one entry per drawn look and kind, each `PartLook` carrying `kind: "mockup" | "story"`, so a name drawn as both yields two entries; a story's entry carrying the page `looks/overview.ts` already builds for it (`StoryView.document`); `PlanLook` drawing either kind in its `LookFrame`, keyed by kind and name; and `plan-look` made a catalog component with a story per state.

**And against:**
merging the two into one row with the worse of the two states (it hides which one waits, and a person still could not see both); preferring the mockup over the story in the map (the story's state would vanish instead, the same fault reversed); sending stories to the Looks page as today (what Sandy asked to stop).

**To achieve:**
a person looks at every look a plan names from its page, and a mockup waiting for approval reads proposed.

**Accepting:**
a name drawn as both kinds appears twice in the Looks part and in its count, and approval stays one click away on the Looks page.

**Because:**
the two are separate things a person approves separately, the mockup as the proposal and the story as the build, so showing them apart is the honest reading; and the story's page already exists, so drawing it in place costs one field.

## Context

See `research.md`: the overwrite is in `readPlanParts`' loop over each app's
mockups and stories (`apps/indusk-mcp/src/lib/plans/parts.ts`), and
`document: null` is set there for every story. `plans approve` and
`plans accept` read mockups through their own path (`approved-brief.ts`), so
they were never fooled; only the plan page and the brief page were.

## Decision

1. `PartLook` gains `kind: "mockup" | "story" | null` (null when undrawn).
   `readPlanParts` builds, per name the brief lists, one entry per kind drawn
   under that name, mockup first, or one undrawn entry when neither is.
2. A story's entry carries `document` from `StoryView.document`.
3. `PlanLook` draws `look.document` in `LookFrame` for either kind, and
   chooses `LookRow`'s kind from `look.kind`. The plan page and the brief page
   key each look by `${kind}-${relation}-${name}`.
4. `looksSummary` counts entries, so a pair reads "1 of 2 approved" while the
   mockup waits.
5. `plan-look` joins the admin's component catalog with stories `pair` and
   `story-open`, matching the two mockups the brief names.

## Alternatives Considered

### One row with the worse state
Hides which of the two waits, and still shows only one of them.

### Mockup wins the name
The story's state disappears instead.

## Consequences

### Positive
- Every look of a plan can be looked at from its page.
- A waiting mockup can no longer read approved on the plan page.

### Negative
- A component under change shows twice in its plan's Looks part.

### Risks
- Another reader of `PartLook` could assume one entry per name. Mitigation: both readers, the plan page and the brief page, draw the list through the one `PlanParts` component changed here.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/admin-ui/` plan page section — the Looks part opens stories in place and shows a mockup and its story apart.

### Diagrams
- None.

### Changelog
- "A plan's page opens every look in place, stories included, and shows a mockup and its story as two rows with their own states."

### ADR in Docs
- No; a small decision, recorded in the plan.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder
- `.indusk/planning/story-first-phases/` — where the fault was seen
