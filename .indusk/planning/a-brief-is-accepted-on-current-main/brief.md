---
title: "A brief is accepted on current main"
date: 2026-10-19
status: draft
workflow: bugfix
clauses: required
description: "Accepting a brief first brings main into its plan's branch, so the plan is written and reviewed against current code; a conflict refuses the acceptance and names the files. Merging is never the person's step."
---

# A brief is accepted on current main — Brief

Sandy, 2026-10-19 (recorded by session `31df1058`): a plan's branch must be up
to date with main for its brief to be accepted. The brief is when the plan is
still malleable, so it should be planned with everything main holds; after
acceptance the branch may fall behind, since landing merges main anyway
(`lib/plans/land.ts`). Merging main is never a step for the person: the system
does it, and the person only accepts.

Seen the same day: `decisions-as-questions`' branch was cut before
`audit-concerns-are-answered` landed, so its planning run used the old audit
skill and wrote a plan review the checker could not read; ten drafted
`fix-http-*` briefs sit 1,203 commits behind main.

## Expectations

None — a bugfix; every brief accepted from now on is accepted on a branch holding main.

## Promises

### This plan makes

1. **`a-brief-is-accepted-on-current-main`** (state). Accepting a brief first brings main into its plan's branch, so the plan is written against current code; when that merge conflicts, the acceptance is refused, naming the conflicting files, and nothing is changed.
   - **`main-is-merged-first`** (split). Accepting a brief merges main into the plan's branch before the brief is marked accepted, in the admin and from the command line alike.
   - **`a-conflict-refuses`** (split). A merge that conflicts is undone and the acceptance refused, naming each conflicting file, with the brief still a draft.
   - **`the-person-never-merges`** (limit). Accepting never asks the person to merge main by hand; only a conflict asks anything of them.

### Existing promises

**Must not break**

- **`an-accepted-brief-is-planned-unasked`**. The planning run still starts on acceptance, now on a branch holding main.
- **`a-plan-is-written-on-its-own-branch`**. Main is merged into the plan's branch; nothing is written on main.

**Changes**

None.

**Replaces**

None.

### Not promised

- Keeping a branch current after acceptance: landing merges main.
- Re-reading a brief whose code moved under it: the plan review, run as the planning run's last step on the now-current branch, reads the plan against main's code.
- Merging main into the ten old `fix-http-*` drafts now: each is merged when it is accepted.

## Looks

None — the merge and the refusal are in the package's `plans/accept-brief`, outside the admin's interface files; the admin shows the refusal's message as it shows any.

## Depends On

- None.

## Blocks

- None.
