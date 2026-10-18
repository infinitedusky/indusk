---
title: "Archived plans are found"
date: 2026-10-18
status: draft
workflow: bugfix
clauses: required
description: "Every command that acts on a plan finds it whether its folder is in planning/ or planning/archive/, so a plan the retrospective has archived can still be accepted, re-approved, tested at landing and landed."
---

# Archived plans are found — Brief

Found closing `a-new-project-starts-instrumented` and `tests-never-make-us-wait`
(2026-10-17/18). The retrospective archives a plan before it lands, and three
commands then could not find it: `indusk plans reapprove` read the brief at the
approval commit under its archive path, `indusk plans accept` recorded nothing, and
`indusk plans tests --landing` refused. Each close was worked around by moving the
plan out of the archive and back. The cause is two lookups that both build
`.indusk/planning/<plan>`: `resolveImplPath` (`lib/impl-parser.ts`) and the plan
copy's `dir` in `lib/worktree/plan-worktrees.ts`; ten commands go through them.

## Expectations

1. **Closing a plan needs no moving it out of the archive.**
   - Measure: plans closed after this lands whose history shows an un-archive commit before acceptance or landing; expect none.
   - Look: the next five plan closes.

## Promises

### This plan makes

1. **`a-plan-is-found-in-the-archive`** (state). Every command that acts on a plan finds it in `.indusk/planning/<plan>` or, when not there, in `.indusk/planning/archive/<plan>`.
   - **`one-lookup`** (split). One function says where a plan's folder is, and the impl, the brief and the worktree record all ask it.
   - **`active-first`** (limit). A plan in both places is read from `.indusk/planning/<plan>`, never the archived copy.
   - **`the-brief-at-approval`** (split). Re-approval reads the brief at the approval commit from the path it had then, archived or not.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. Landing still refuses a plan with no acceptance; it now finds the acceptance on an archived plan.
- **`only-a-person-reapproves`**. Re-approval stays a person's command; it only reads the right file.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Changing when the retrospective archives.** Archiving before landing stays; the commands follow the plan where it is.

## Looks

None — command behaviour only.

## Depends On

- None.

## Blocks

- Brief to build unattended — an unattended close cannot move a plan out of the archive by hand.
