---
title: "Plan authoring from the admin — Test Plan"
date: 2026-10-06
status: draft
---

# Admin plan authoring — Test Plan

## Purpose

How each promise in the [brief](brief.md) is proven. Every assertion sits
under what it is for: a promise this plan makes, a promise already in force,
or neither, with the reason.

Levels: `unit` runs in the phase that writes it and in `pnpm test`;
`contract` asks something we do not own (Claude Code, git, the OS) and runs in
the system tier, at landing and on release; `live check` runs once against
the real system and is recorded in the plan.

## Proves `a-plan-can-start-from-the-admin`

| ID | Assertion | Level |
|----|-----------|-------|
| A1 | Choosing New plan in the admin, with a type and a name, starts a planning session, and what the session says appears in the panel as it says it. | unit |
| A2 | A question the session asks appears in the panel with its choices; the person's answer reaches the session and it continues. | unit |
| A3 | A request to use a tool appears in the panel; allowing it lets the session go on, denying it tells the session no. | unit |
| A4 | A session started from the admin asks before every write, even when the developer's own Claude Code is set to allow writes without asking. | unit |
| A5 | Claude Code still speaks the three exchanges the admin relies on: a question, a permission request and an interrupt, each answered over the session's own stream. | contract |
| A6 | A plan started in the admin and one started in the editor produce the same kind of plan folder and the same registry entries; either can be continued from the other. | live check |

## Proves `a-plan-is-written-on-its-own-branch`

| ID | Assertion | Level |
|----|-----------|-------|
| A7 | Starting a plan with a type and a name creates its own branch and worktree, recorded so the admin and the plan tools read the plan from there. | unit |
| A8 | Until the plan is approved, its documents and declared promises exist on its branch and not on `main`. | unit |
| A9 | Approving the plan brings its documents and promises to `main`, and its build then runs on the same branch. | unit |
| A10 | Starting a plan whose name already has a folder, a branch or a worktree is refused, naming which. | unit |

## Proves `a-build-runs-to-review-unasked`

| ID | Assertion | Level |
|----|-----------|-------|
| A11 | An approved plan's build goes from its first phase through falsification and cleanup without asking the person anything, when the plan declares no judgement item. | unit |
| A12 | A build stops at a judgement item the plan declared (a deferred verification, a manual or visual check) and shows the item in the panel. | unit |
| A13 | A build that cannot continue stops and says why, instead of trying again without end. | unit |
| A14 | A build stops when the plan is ready for review (every phase, falsification and cleanup closed) and does not start the retrospective. | unit |

## Proves `a-review-shows-its-evidence`

| ID | Assertion | Level |
|----|-----------|-------|
| A15 | At review, the panel lists each promise the plan makes with the passing tests that name it; a promise with none is shown as unproven. | unit |
| A16 | At review, the panel shows what falsification looked for, what it found and what was fixed. | unit |
| A17 | At review, the panel shows the files the plan's branch changed against `main`. | unit |

## Proves `nothing-ships-until-accepted`

| ID | Assertion | Level |
|----|-----------|-------|
| A18 | A plan that has not been accepted cannot be merged to `main` by the release workflow; the refusal names the plan. | unit |
| A19 | Accepting a plan in the panel runs the release workflow: the retrospective, the merge to `main`, and the branch and worktree removed. | unit |
| A20 | In a project set to accept automatically, a build that reaches review goes on to the release workflow without the person. | unit |

## Proves `a-session-can-be-stopped`

| ID | Assertion | Level |
|----|-----------|-------|
| A21 | Stopping a session from the panel ends it, and what it already wrote stays written. | unit |
| A22 | When the admin stops, or starts again after a crash, no session it started is still running. | contract |

## Guards promises already in force

| ID | Assertion | For | Level |
|----|-----------|-----|-------|
| A23 | Approving a plan from the admin runs the same brief check as the command line and refuses with its message when a promise is missing from the registry. | `a-briefs-promises-are-in-the-registry` | unit |
| A24 | In a session the admin starts, a checkoff that skips a gate is refused. | `gates-ran-at-every-checkoff` | contract |
| A25 | The admin starts plans, creates worktrees, checks briefs and lands plans through the package's own code, with no second spelling. | `one-definition-per-shared-rule` | unit |
| A26 | With this plan's tests added, no everyday test starts Claude, a server or a detached process, or waits. | `everyday-tests-never-wait` | unit (the existing guard) |

## Live checks

| ID | Assertion | Level |
|----|-----------|-------|
| A27 | In a scratch project, one plan goes the whole way in the admin, with no terminal: started, planned, promises accepted, approved, built to review, evidence read, accepted, released. | live check, recorded at close |
| A28 | This plan's own six promises go from `declared` to `enforced` when it closes. | live check, recorded at close |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | An unattended build does good work without being asked. | It is an agent following prose. | Falsification and cleanup still run; the review shows the evidence (A15–A17); nothing ships until accepted (A18); the brief's second expectation counts the stops. |
| U2 | A plan started from the editor (`/planner`) is also written on its own branch. | The editor path is the planner skill, an agent following prose. | See the first note: the trunk guard can make it structural. The ADR decides. |

## Notes

- **Plan documents on `main`.** Today the trunk guard allows them, and today's
  brief was written there. If a plan is written on its own branch wherever it
  starts, the guard could refuse a new plan folder on `main` outside an
  approval merge. That makes U2 testable and breaks today's habit. A question
  for the ADR.
- **What "cannot continue" means** (A13) is an open question in research; the
  ADR names the conditions, and A13's cases follow them.
- **Unit tests drive the session through its stream, not a process.** The
  admin's session code takes the session's messages as input, so A1–A4,
  A11–A14 and A21 are `unit`. Real `claude` runs only in A5, A22, A24 and the
  live checks, in the system tier.
- The expectations in the brief are measured later, not here.
