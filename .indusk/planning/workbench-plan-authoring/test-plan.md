---
title: "Workbench plan authoring — Test Plan"
date: 2026-10-06
status: accepted
---

# Workbench plan authoring — Test Plan

## Purpose

How each promise in the [brief](brief.md) is proven. Every assertion sits
under what it is for. Workbench assertions run over every workbench layout
the fixtures know (nested, sibling, flat, and nested at a declared path), so
a rule that holds in one layout and breaks in another is caught.

Levels: `unit` runs in the phase that writes it and in `pnpm test`;
`contract` asks something we do not own (Claude Code, git) and runs in the
system tier; `live check` runs once against the real system and is recorded
in the plan.

## Proves `a-plan-knows-its-code`

| ID | Assertion | Level |
|----|-----------|-------|
| A1 | Starting a plan in a workbench with one repo writes its documents at the workbench root, makes a code worktree in that repo on `plan/<name>`, and records both against the plan. | unit |
| A2 | Starting a plan in a workbench with two repos needs the repo named; the plan records it; started without one, it is refused, naming the repos to choose from. | unit |
| A3 | Every later step of a workbench plan (what to do next, the build, the review, acceptance, landing) finds its code worktree from the plan's record. A record naming a worktree that no longer exists is reported as such, never guessed. | unit |

## Proves `a-project-has-one-contract`

| ID | Assertion | Level |
|----|-----------|-------|
| A4 | In a workbench whose repo holds `.indusk/promises/`, promises are read from the repo; the workbench's own promises folder is not read at all. | unit |
| A5 | In a workbench whose repo holds no promises folder, promises are read and written in the workbench, its shadow contract. | unit |
| A6 | Declaring a promise in a plan whose repo holds a contract writes it into the repo, on the plan's code branch, so it lands with the code. | unit |
| A7 | The registry check, `promises status`, the plan commands and the admin's Promises page give the same promises for the same project, with or without a contract in the repo. | unit |
| A8 | Two workbenches on one repo that holds a contract read the same promises. | unit |

## Changes `a-plan-can-start-from-the-admin`

| ID | Assertion | Level |
|----|-----------|-------|
| A9 | New plan in a workbench project, in the admin, starts the plan and its planning session; with more than one repo, the form asks which. | unit |
| A10 | A workbench plan's page in the admin offers Continue planning, Approve, Build and Review at the same moments a normal-mode plan's does. | unit |

## Changes `a-plan-is-written-on-its-own-branch`

| ID | Assertion | Level |
|----|-----------|-------|
| A11 | Approving a workbench plan runs the brief check and marks it approved, with nothing merged; a brief the check refuses is refused with the check's message. | unit |
| A12 | A workbench plan's code stays on its branch in the repo until it lands; the repo's trunk does not change before then. | unit |

## Changes `a-build-runs-to-review-unasked`

| ID | Assertion | Level |
|----|-----------|-------|
| A13 | A workbench plan's build writes code in its code worktree and checks items off at the workbench root without asking, and a write outside both is refused. | unit |

## Must not break `gates-ran-at-every-checkoff`

| ID | Assertion | Level |
|----|-----------|-------|
| A14 | In a workbench, a real build session's checkoff is refused by the workbench's gates when an earlier phase skipped a gate without its reason. | contract |

## Must not break `a-review-shows-its-evidence`

| ID | Assertion | Level |
|----|-----------|-------|
| A15 | A workbench plan's review lists the files its code branch changed in its repo, and uncommitted work on that repo's trunk on those paths. | unit |

## Must not break `nothing-ships-until-accepted`

| ID | Assertion | Level |
|----|-----------|-------|
| A16 | Landing an unaccepted workbench plan is refused. Once accepted, its code branch merges into the repo's trunk, its code worktree and branch are removed, and the plan is archived at the workbench root. | unit |

## Must not break `one-definition-per-shared-rule`

| ID | Assertion | Level |
|----|-----------|-------|
| A17 | The plan commands find a workbench's roots through `resolveExecutionRoots` and the plan's record, and promises through the one contract resolver; no other module resolves either. | unit |

## Proves `a-renamed-plan-is-found-by-its-new-name`

Added in the live check (2026-10-06), when a hand rename stranded a running
session.

| ID | Assertion | Level |
|----|-----------|-------|
| A20 | Renaming an open plan, in a workbench or in normal mode, moves its documents, renames its branch, and rewrites its code record, its promises' owner and its phase records; every plan command then finds it by the new name, and none by the old. | unit |
| A21 | A rename is refused, with nothing changed, when the new name is taken or not a valid plan name, when the plan is not open, or when a build is running for it. | unit |
| A22 | A running planning session moved by a rename is found under the plan's new name, and its panel is told the new name and moves to the new page. | unit |
| A23 | A rename asks the running admin to move the plan's session; with no admin running it renames everything else and says there was no session to move. | unit |

## For no promise: a new plan's agent prepares, then asks

Added in the live check (2026-10-06).

| ID | Assertion | Level |
|----|-----------|-------|
| A24 | A plan started from New plan opens a session told to read the project's state first, then say it is ready and ask for a description, and not to infer the plan from its name. | unit |

## For no promise: the admin offers trust

Added in the live check (2026-10-06).

| ID | Assertion | Level |
|----|-----------|-------|
| A25 | A project Claude Code does not trust shows "Trust in Claude Code" on its admin pages; one click trusts it, writing only that flag and keeping everything else in the config, and the button is gone. | unit |

## For no promise: normal mode unchanged, and the whole flow

| ID | Assertion | Level |
|----|-----------|-------|
| A18 | In a normal-mode project every plan command, the build and the admin behave as in 1.63.0: the existing `plans-*`, build and session tests pass unchanged. | unit |
| A19 | In a scratch copy of a real workbench, one plan goes from New plan to landed in the admin, without a terminal. | live check |
