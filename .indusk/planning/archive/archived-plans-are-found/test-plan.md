---
title: "Archived plans are found — Test Plan"
date: 2026-10-18
status: accepted
---

# Archived plans are found — Test Plan

## `a-plan-is-found-in-the-archive`

Every command that acts on a plan finds it in .indusk/planning/<plan> or, when not there, in .indusk/planning/archive/<plan>.

### `one-lookup` — One function says where a plan's folder is, and the impl, the brief and the worktree record all ask it.

- Signal: the commands' own refusals; upheld when an archived plan is accepted, tested at landing and landed without being moved; broken reports "no impl.md" or "not accepted" for an archived plan.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan's folder is found in the planning folder, or in the archive when it is only there, and is reported missing when it is in neither. | unit |
| A2 | The impl of a plan that has been archived is found by name. | unit |
| A3 | A plan archived on its own branch can be accepted, and the acceptance is recorded on its impl. | unit |
| A4 | An accepted plan that has been archived lands. | unit |
| A5 | The tests a plan runs at landing are listed for a plan that has been archived. | unit |

### `active-first` — A plan in both places is read from .indusk/planning/<plan>, never the archived copy.

- Signal: the same lookup; upheld when the active folder wins; broken names the archived path it read.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | A plan whose folder is in both the planning folder and the archive is read from the planning folder. | unit |

### `the-brief-at-approval` — Re-approval reads the brief at the approval commit from the path it had then, archived or not.

- Signal: `indusk plans reapprove` and `plans amendments`; upheld when an archived plan's amendments are listed and approved; broken reports the brief "cannot be read" at the approval commit.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | The amendments of a plan archived after its approval are listed against the brief it was approved with, and can be re-approved. | unit |
