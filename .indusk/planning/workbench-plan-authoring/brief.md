---
title: "Workbench plan authoring"
date: 2026-10-06
status: accepted
workflow: feature
---

# Workbench plan authoring — Brief

*Opened in the 1.63.0 smoke check (Sandy, 2026-10-06). New plan in a
workbench refused at once, and admin-plan-authoring never considered
workbenches, though eight of Sandy's sixteen projects are workbenches: "we
have to make this work for workbenches." What the code does today, and the
questions this brief answers, are in [research](research.md). It runs in
parallel with the clickable mockup of the plan page
(https://claude.ai/artifact/JMNVThNXUtaxfpezMPunjN), which shapes the UI
plan after this one.*

## Expectations

1. **The admin plans and builds in the projects Sandy works in.**
   - Measure: of the next five plans in workbench projects, how many use the
     admin at some step.
   - Look: when the fifth one starts.
2. **A workbench plan goes the whole way without the terminal.**
   - Measure: one plan in a real workbench (concierge or numero) is started,
     approved, built, accepted and landed from the admin.
   - Look: at this plan's live check.

## Decisions taken in the conversation

- **A workbench plan's documents live at the workbench root, on its main
  branch**, where sync already commits them. The plan's branch exists only
  in the code repo. Approve checks the brief and marks the plan approved,
  with nothing to merge (Sandy, 2026-10-06).
- **New plan asks which repo** when the workbench wraps more than one, and
  the plan records the choice. With one repo it asks nothing (Sandy,
  2026-10-06).
- **Promises belong with the code; the work belongs in the workbench.** A
  repo has one contract (`.indusk/promises/`), however many workbenches work
  on it. Until a repo accepts the folder, its contract lives in the
  workbench as a versioned shadow contract (Sandy, 2026-10-06; the design
  note in [research](research.md)).
- **A plan can be renamed, by one command that moves everything.** A name
  gets better once the idea is clear, so the planner may rename a plan, but
  only through `indusk plans rename`, never by hand with git. The command
  asks the admin to move a running session's record, since that lives in
  the admin's memory. The worktree's directory keeps its name: a session
  may be running in it, and the records hold its path (Sandy, 2026-10-06, in the live check: the planner
  renamed `new-game-type` to `blind-mans-curse` by hand, and the running
  session was left filed under a page that no longer existed).

## Promises

### This plan makes

1. **`a-plan-knows-its-code`** (state). A plan in a workbench records which
   repo holds its code and which worktree it is built in. Every step reads
   them from that record: build, review, accept and land.
2. **`a-project-has-one-contract`** (state). A repo's promises are read and
   written in one place: the repo's own `.indusk/promises/` once it holds
   one, otherwise the workbench's shadow contract. Every reader goes through
   the same resolver: the plan commands, the registry check, the watcher and
   the admin. A promise is never read from both.
3. **`a-renamed-plan-is-found-by-its-new-name`** (state). A plan renamed
   while it is open is renamed everywhere InDusk looks it up: its documents,
   its branch, its code record, its promises, its phase records and its
   running session, whose panel moves to the plan's new page. Nothing looks
   the plan up by its old name.

### Existing promises

**Must not break**

- **`nothing-ships-until-accepted`**. In a workbench too, landing refuses a
  plan that was not accepted, and the code reaches its repo's trunk only by
  landing.
- **`a-review-shows-its-evidence`**. A workbench plan's review lists the
  files its code branch changed in its repo.
- **`gates-ran-at-every-checkoff`**. A build session in a workbench is judged
  by the workbench's gates.
- **`one-definition-per-shared-rule`**. The plan commands find a workbench's
  roots through `resolveExecutionRoots` and the record, never a second
  resolver.

**Changes**

- **`a-plan-can-start-from-the-admin`**. Today it holds only in a
  normal-mode project. It becomes: a plan can be started from the admin in
  any project, normal or workbench.
- **`a-plan-is-written-on-its-own-branch`**. Today it holds only in a
  normal-mode project. It becomes: a plan's code is written on its own
  branch. In a normal-mode project its documents are written there too; in a
  workbench they are written at the root, where the workbench is versioned.
- **`a-build-runs-to-review-unasked`**. A build in a workbench writes in two
  places, the code worktree and the plan at the root, and asks about
  neither.

**Replaces**

None.

### Not promised

- **The new plan page** (the stage track, promises first, decision cards):
  the mockup shapes it, and its own plan builds it.
- **A plan that changes two repos at once.** One plan changes one repo; a
  change across repos is two plans.
- **Moving a shadow contract into its repo**: the command that writes the
  folder and opens the pull request. That is its own plan, after this one.
- **Creating a project or a workbench from the admin**, and an **Update
  button**: follow-ons named in the smoke check.
- **Where InDusk's bookkeeping is written**:
  `bookkeeping-lives-where-it-is-read`.

## Depends On

- admin-plan-authoring (1.63.0): the plan commands, sessions and the admin's
  routes this plan extends.
- publish-hygiene (1.63.0): the contract tests that drive a real `claude`.

## Blocks

- The plan-page UI plan that follows the mockup: the mockup's first screen
  is a workbench plan.
