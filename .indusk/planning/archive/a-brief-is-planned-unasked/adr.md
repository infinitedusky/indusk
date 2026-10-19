---
title: "A brief is planned unasked"
date: 2026-10-18
status: accepted
---

# A brief is planned unasked

## Goal

**Accepting a brief whose looks are approved writes the rest of the plan unattended, and approving it starts the build.**

Today a person drives a planning session from the accepted brief to the impl, approves,
then presses Build. Accepting a brief is a hand edit with no moment to start anything
from. After this, the person accepts the brief, approves the plan once, and reviews the
build at the end.

## Y-Statement

**In the context of:**
plans whose brief a person has accepted, with an unattended build loop (`runBuild`, `nextBuildStep`, `runStepSession`) that already runs work, falsify, cleanup and audit steps from an approved impl, and planning sessions that are always conversations.

**Facing:**
no command for accepting a brief, no step that writes plan documents unattended, and an approval that starts nothing.

**We decided for:**
a brief acceptance command (`indusk plans accept-brief`, and the admin's action calling it) that runs the contract check and sets the brief accepted; a planning loop beside the build loop — a pure `nextPlanningStep` naming the first missing document (test plan, ADR when the workflow has one, impl), each run as a fresh unattended `kind: "build"` session with its own step name and a prompt to write only that document to the planner's rules — started by the admin's host when a brief is accepted with every look approved, or when its last look is approved; the approve, look-approval and build commands refusing inside a planning step; and the admin's approve route starting the build after a successful approval.

**And against:**
one session writing all three documents (one long unattended context, no check between documents, no clean resume), putting the loop in the planning conversation (a conversation waits on a person by design), and starting the build inside `approvePlan` (the library has no session host; the admin route does).

**To achieve:**
brief in, approve once, review at the end, with each document checked before the next is written.

**Accepting:**
that the documents are as good as an unattended session's judgement, recorded in them for the person's one approval; that a choice it cannot make stops the run with a blocker rather than a question until `decisions-as-questions`; and that a CLI start of the loop is not in scope (the admin's host runs it, as it runs builds).

**Because:**
the build loop's shape — a pure next step, a fresh session per step, decisions in code, progress by fingerprint — already works for unattended steps, and the checks that make a document acceptable (the contract check, the impl's structure check) already exist.

## Context

[research.md](research.md) has where acceptance, sessions, builds, approval and looks
live today; [brief.md](brief.md) the promise; [test-plan.md](test-plan.md) the assertions.

## Decision

1. **`acceptBrief(root, plan)`** (`lib/plans/accept-brief.ts`): reads the brief, refuses a
   brief that is not a draft, runs the plan's contract check and refuses with its
   message, then sets `status: accepted` and commits it on the plan's branch. CLI
   `indusk plans accept-brief <plan>`; the admin's brief page action calls it. Refused
   inside any build or planning step (`refuseInsideBuildStep`).
2. **`nextPlanningStep(state)`** (`lib/build/next-planning-step.ts`), pure over what was
   read: the workflow's required documents (`workflow-types`), which exist and pass
   their check, the impl's status, whether every look is approved
   (`unapprovedMockups`), and the last two steps' progress. Answers `write-test-plan`,
   `write-adr`, `write-impl`, `wait-for-looks`, `ready-for-approval`, or
   `cannot-continue` with the reason (a blocker, two steps without progress, an
   approved or built plan).
3. **A planning step is a build session with its own step name**
   (`INDUSK_BUILD_STEP=plan-test-plan | plan-adr | plan-impl`), run by
   `runStepSession` with a prompt naming the one document to write, the plan's brief and
   research as its inputs, the planner skill's rules for that document, and the
   instruction to record each open decision with its reason and to write a `blocker:`
   when it cannot decide. Under `INDUSK_GATE_POLICY=auto` the impl hook accepts
   pre-filled gates with reasons.
4. **The loop** `runPlanning` (`lib/build/planning-runner.ts`) mirrors `runBuild`:
   read, ask `nextPlanningStep`, run the step, repeat; it stops at
   `ready-for-approval`, `wait-for-looks` or `cannot-continue`.
5. **The admin's host starts it** (`build-host.ts` `startPlanning`, the same slot rules as
   `startBuild`, behind `POST /api/plans/plan`): `indusk plans accept-brief` asks the
   running admin to start it (the address `indusk ui` serves on), saying so when no admin
   is running; the admin's look-approval route asks after approving a look, so the last
   look approved starts it. `startPlanning` runs `nextPlanningStep` first and starts
   nothing while it answers `wait-for-looks` or `ready-for-approval`.
8. **The admin's interface is what draws**: `screens.json` `sources` for the admin become
   `src/app` and `src/components` with an `exclude` of `src/app/api`, honoured by
   `interfaceFilesAmong`; the look check's app-router lookup accepts a source that is the
   `app` folder itself, so narrowing touches no look.
6. **Approval starts the build**: the admin's approve route calls `startBuild` after
   `approvePlan` returns; a refused approval starts nothing.
7. **Never approves**: `approvePlan`, the look approval and `startBuild` refuse when
   `currentBuildStep()` names a planning step.

## Alternatives Considered

### One session writes the test plan, ADR and impl
Rejected: no check between documents, and a long unattended context; a fresh session per
document resumes cleanly where the last stopped.

### The planning conversation runs unattended
Rejected: a planning session waits on a person by design; mixing the two makes neither
reliable.

### `approvePlan` starts the build
Rejected: the library has no session host; the admin route that owns the host does.

## Consequences

### Positive
- No one's time between accepting a brief and approving its plan.
- Each document is checked before the next is written.

### Negative
- An unattended document is only as good as the session's judgement; the person's one
  approval is the check.
- The loop runs from the admin only; no CLI equivalent yet.

### Risks
- **A step loops without writing.** Mitigation: two steps without progress end the run
  (as the build loop does).
- **A planning step approves something.** Mitigation: decision 7, tested.

## Documentation Plan

### Pages
- Update `reference/cli/plans.md` (`accept-brief`), `guide/` planning page on what happens
  after accepting a brief, `reference/admin-ui/` where the brief page's action is described.

### Changelog
- Accepting a brief whose looks are approved writes the plan unattended; approving it
  starts the build.

### ADR in Docs
- Yes: `decisions/a-brief-is-planned-unasked.md`.
