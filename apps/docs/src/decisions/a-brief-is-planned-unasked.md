# A brief is planned unasked — accept the brief, approve the plan once, review the build

**Decided 2026-10-18.** Full ADR: `.indusk/planning/a-brief-is-planned-unasked/adr.md`.

## Goal

**Accepting a brief whose looks are approved writes the rest of the plan unattended, and approving it starts the build.**

Writing the test plan, ADR and impl from an accepted brief was a planning
session a person drove; approving the plan and pressing Build were two more
manual steps; and accepting a brief was a hand edit of its status with no moment
to start anything from.

## Decision

1. **Accepting is a command.** `indusk plans accept-brief <plan>` runs the
   plan's contract check, refuses with its messages, and otherwise sets the
   brief accepted and commits it on the plan's branch. It is refused inside any
   build or planning step.
2. **A pure decision names the next document.** `nextPlanningStep` answers
   `plan-test-plan`, `plan-adr` (when the workflow has one), `plan-impl`,
   `wait-for-looks`, `ready-for-approval` or `cannot-continue` with its reason
   (a blocker, two steps without progress, an impl already approved).
3. **Each document is a fresh unattended session** with its own step name,
   told to write only that document from the brief and research, to the
   planner's rules, recording each open decision with its reason and writing a
   `blocker:` line when it cannot decide. A document that fails its check is
   the same step again.
4. **The loop reads the plan from disk through the project's own checks**: the
   contract check, the shipped impl hook's structure check run on the impl's
   content, and the approval of every look the brief names.
5. **The admin's host starts it.** `startPlanning` takes a build's slot and
   starts nothing while a look is unapproved. `accept-brief` asks the running
   admin (at the address `indusk ui` recorded) and says plainly when none runs;
   a look approval asks for the plan whose worktree recorded it, so the last
   look approved starts the run.
6. **Approval starts the build.** The admin's approve route calls `startBuild`
   only after `approvePlan` returned; a refused approval starts nothing.
7. **A planning step never approves.** Approving a plan, approving a look and
   starting a build are refused inside a planning step.

## Consequences

- No one's time between accepting a brief and approving its plan; the person's
  one approval is the check on documents only as good as an unattended
  session's judgement.
- The loop runs from the admin only; there is no CLI start of the planning run.
- A choice a session cannot make ends the run with a blocker until
  `decisions-as-questions` sends it as a question.
