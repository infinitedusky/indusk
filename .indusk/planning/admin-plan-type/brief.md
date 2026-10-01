---
title: "The admin says what kind of plan it is"
date: 2026-10-01
status: draft
workflow: bugfix
---

# The admin says what kind of plan it is — Brief

## Problem

The admin's stage bar draws every absent planning document the same way —
dashed and struck through, the bar's `skipped` state. A bugfix that
legitimately has no research or ADR looks identical to a feature that skipped
them, and a plan that skipped a document its type *requires* looks no worse.
Reading release-ritual on 2026-10-01, the operator could not tell which of its
three dashed segments were by design and which were gaps (answer: research and
ADR are fine for a bugfix; the missing test plan is a real gap).

The planner already has the vocabulary — `workflow:` in a brief's frontmatter,
one of `feature`, `bugfix`, `refactor`, `spike`, each requiring a defined set
of documents (`apps/indusk-mcp/skills/planner.md`, Workflow Types). But only 19
of ~94 plans declare it, the planner does not always write it, and the admin
reads the field (`planning-reader.ts`) without rendering it.

## Proposed Direction

1. **Show the type.** The plan header carries a type chip — `bugfix`,
   `feature`, … — read from the brief's `workflow:`. Absent reads **type not
   declared**, never a guess from which documents exist.
2. **Explain it on click.** The chip opens a modal: what the type is for, which
   documents it requires, which it skips, and why. The text comes from **one
   definition** of the workflow types, shared with the planner skill's table,
   so the page and the planner cannot drift.
3. **Three segment states, not two.** An absent document the plan's type does
   not require reads *not required for this type* (quiet, no strike-through).
   An absent document the type *does* require reads *missing* — visibly a gap.
   With no declared type, absent documents keep today's rendering, plus the
   "type not declared" chip saying why the bar cannot judge.
4. **The planner always declares it.** Creating a brief writes `workflow:`,
   defaulting to `feature` exactly as the command already does.
5. **Declare it on the active plans**, starting with release-ritual
   (`bugfix`) — so the plan that prompted this reads correctly the day it
   ships. Archived plans are left alone; "type not declared" is the honest
   reading for them.

## Scope

### In Scope
- Workflow-type definitions as one exported module (requires / skips / purpose
  per type), read by the admin; the planner skill's table states the same facts
  and a parity test pins them
- Type chip + explanatory modal in the plan header
- Stage-bar segment state for "not required for this type", distinct from
  "missing", registered in the bar's label maps under the render-parity pin
- Planner writes `workflow:` on every new brief
- `workflow:` added to active plans' briefs

### Out of Scope
- Back-filling types on archived plans
- Inferring a type from the documents present
- Changing which documents each type requires
- A new modal/dialog library — the admin uses custom Tailwind primitives, no
  Radix (`CLAUDE.md`, indusk-admin); a native `<dialog>` is enough

## Success Criteria
- Opening release-ritual shows `bugfix`; research and ADR read *not required
  for this type*; the absent test plan reads *missing*
- Clicking the chip explains the type in plain language
- A plan with no `workflow:` says "type not declared" and draws absent
  documents as today
- A brief created by `/planner` carries `workflow:`

## Depends On
- `.indusk/planning/release-ritual/` — lands first (ordering, not code)

## Blocks
- Nothing
