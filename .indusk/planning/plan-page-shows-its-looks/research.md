---
title: "A plan's page shows all its looks"
date: 2026-10-14
status: complete
---

# A plan's page shows all its looks — Research

## Question

Why can a person not look at a story from a plan's page, and why did
story-first-phases' page say its looks were all approved while its redrawn
mockup was waiting for approval?

## Background

Sandy, approving story-first-phases' look (2026-10-14): "when it's a story
instead of a mockup, you can't look at it in the plan page, and I want to be
able to look at everything within the plan page."

story-first-phases redrew the mockup `phase-row.open`. Its plan page read
"Looks · 2 of 2 approved", while the Looks page, read from that plan's
branch, said "1 proposed".

## Findings

### A mockup and a story share one name, and the story wins

`readPlanParts` (`apps/indusk-mcp/src/lib/plans/parts.ts`, the loop over
each app's mockups and stories) builds one map from look name to what is
drawn. It adds every mockup, then every story, under the same key. A
component's story is named exactly as its mockup (`phase-row.open` is both),
so the story overwrites the mockup. The plan page then shows the story's
approval, which is unchanged and approved, and never the mockup's, which is
proposed. The plan page does read the plan's own branch (`plan.worktree?.path`
in `app/p/[project]/plan/[name]/page.tsx`); the branch was never the problem.

### A story is given nothing to draw

The same loop sets `document: null` for every story, although
`looks/overview.ts` already builds a story's page (`storyDocument`) for the
Looks page. `PlanLook.tsx` then says "This look is a story; open it on the
Looks page." when a story is opened.

### What the plan page offers per look today

`PlanLook.tsx`: a `LookRow` (kind, name, approval, Open); opened, a mockup
draws in a `LookFrame` at the app's devices with a link "Approve it on the
Looks page" or "Open on the Looks page".

## Decisions

- **Every look opens on the plan page, story or mockup** (Sandy, 2026-10-14).
- **A mockup and its same-named story show as two rows**, each with its own
  approval (agreed with Sandy, 2026-10-14).
- Its own plan, not part of story-first-phases, which is about how phases
  read (Sandy, 2026-10-14: "we could just do it now").

## Open Questions

- Whether approving moves onto the plan page too. Today approval is on the
  Looks page; this plan keeps it there unless Sandy says otherwise.
