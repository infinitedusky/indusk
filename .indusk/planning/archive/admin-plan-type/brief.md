---
title: "The admin says what kind of plan it is"
date: 2026-10-01
status: accepted
accepted: 2026-10-01
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
3. **"Skipped" is decided by the type, never by an absent file.** Today the
   bar calls every absent document `skipped`, which asserts a judgment it never
   made. An absent document gets one of four readings:
   - **skipped** — the plan's type does not require it. By design; quiet.
   - **missing** — the type requires it and a later document already exists,
     so the plan moved past it. An error; visibly a gap.
   - **pending** — the type requires it and the plan has not reached it yet.
     Not an error; drawn as an ordinary empty step.
   - **unknown** — the plan declares no type, so whether the absence matters
     cannot be judged. Said as such, beside the "type not declared" chip —
     never drawn as skipped.
4. **The planner always declares it.** Creating a brief writes `workflow:`,
   defaulting to `feature` exactly as the command already does.
5. **Declare it on the active plans, and on release-ritual.** release-ritual
   (`bugfix`) is the plan that prompted this and the acceptance example, and it
   was archived on 2026-10-01, hours after this brief was drafted — so it is the
   **one archived plan** that gets `workflow:` written, so that it reads
   correctly the day this ships. Every other archived plan is left alone; "type
   not declared" is the honest reading for them.

## Scope

### In Scope
- Workflow-type definitions as one exported module (requires / skips / purpose
  per type), read by the admin; the planner skill's table states the same facts
  and a parity test pins them
- Type chip + explanatory modal in the plan header
- Stage-bar document states `skipped` (type-decided), `missing`, `pending`
  and `unknown`, registered in the bar's label maps under the render-parity pin;
  the bar no longer calls an absent document skipped on its own
- Planner writes `workflow:` on every new brief
- `workflow:` added to active plans' briefs, and to release-ritual's archived
  brief as the single exception

### Out of Scope
- Back-filling types on archived plans
- Inferring a type from the documents present
- Changing which documents each type requires
- A new modal/dialog library — the admin uses custom Tailwind primitives, no
  Radix (`CLAUDE.md`, indusk-admin); a native `<dialog>` is enough

## Success Criteria
- Opening release-ritual (now under `archive/`) shows `bugfix`; research and ADR
  read *skipped*; the absent test plan reads *missing* — and stays missing,
  which is the honest record of a plan that closed without one
- A bugfix whose brief exists and whose test plan is not written yet reads the
  test plan as *pending*, not missing
- Clicking the chip explains the type in plain language
- A plan with no `workflow:` says "type not declared" and reads its absent
  documents as *unknown*, never skipped
- A brief created by `/planner` carries `workflow:`

## Depends On
- `.indusk/planning/archive/release-ritual/` — landed 2026-10-01

## Blocks
- [context-tiers](../context-tiers/brief.md) — the accepted plan that moves
  rules out of the root `CLAUDE.md` into enforcers and directory-scoped context
  files. Ordered after this one (Sandy, 2026-10-01) because both touch the
  planner skill and the admin.

## Ground-truth check (2026-10-01, before acceptance)

Each factual claim above was checked against the code.

- **The bar calls every absent earlier document skipped** — true.
  `lib/lifecycle.ts` sets a position before the current one to `skipped` when
  its document file is absent, with no reference to the plan's type; the state
  vocabulary there is `done | active | pending | skipped`.
- **The admin reads the field without rendering it** — true. `workflow` is a
  typed frontmatter field in `planning-reader.ts` and appears in no component.
- **"19 of ~94 plans declare it"** — holds as stated: 21 documents carry
  `workflow:` (11 briefs, 10 impls) across 95 plan folders.
- **The vocabulary exists in the planner** — true, and in **two** places, not
  one: the Workflow Types table in the planner skill and the four files under
  `templates/workflows/`. The new module makes three statements of the same
  facts, so the parity test should pin the skill table to the module and name
  the template files, or the third copy drifts.
- **This is a lifecycle vocabulary change.** Adding `missing` and `unknown`
  widens the segment-state union in `lib/lifecycle.ts`, which `parsePlan`, the
  retrospective gate and the admin all read; by this project's convention the
  admin rendering and the label maps under `lifecycle-render-parity.test.ts`
  change in the same plan. The Scope already says so; noted here because it is
  the part that makes this larger than its `bugfix` label suggests.
