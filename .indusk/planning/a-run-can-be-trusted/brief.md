---
title: "A run can be trusted"
date: 2026-10-19
status: accepted
workflow: bugfix
clauses: required
description: "What an unattended run says is true: its state is kept on disk and shown as it is, a dead run reads stopped and restarts from Build, a release reads released only once landed, plan documents are written only through their checks, a plan with clauses carries its signals, and approval waits for a review of the plan as it stands."
accepted_at: "2026-10-19T18:01:54.034Z"
---

# A run can be trusted — Brief

Item 4 of [Stabilize](../stabilize/master.md) (Sandy, 2026-10-19). Each part
broke a run on 2026-10-19:

- a build session ticked Build Phase 3 off through a shell edit while an
  amendment waited, and no gate saw it;
- `audit-concerns-are-answered`' release died (most likely an admin restart)
  and nothing showed it or offered to rerun it; `approval-waits-for-the-planning-run`'s
  release reported "released" although `plans land` refused it;
- the admin showed "Test Phase 1" while the build was three phases on;
- `audit-concerns-are-answered` could not close: a plan written with clauses
  had no phase reporting their signals;
- `admin-recorder.test.ts` failed `mark-first`'s landing three times under load
  and passed alone;
- approval reads a plan review as answered without checking it was written for
  the documents as they stand (the planning run's stop does check).

## Expectations

None — a bugfix; the measure is Stabilize's bar, three plans in a row from accepted brief to landed and closed unattended with no hand fixes.

## Promises

### This plan makes

1. **`a-run-is-read-from-its-record`** (state). Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again.
   - **`kept-on-disk`** (split). A run's step, phase, process and stop are written to disk as they change, and read back after the admin restarts.
   - **`dead-reads-stopped`** (split). A run whose process is gone without a stop reads as stopped, saying so, and Build starts it again from where the plan stands.
   - **`shows-where-it-is`** (split). The build controls name the phase the plan is on, read from the plan, not the step the session started with.
   - **`released-only-when-landed`** (split). A release reads released only when the plan has landed on main; otherwise it reads stopped with the reason.
   - **`says-what-is-true`** (split). The plan page and its nav row state the plan's situation in words, read from its record and its files: planning and the step, building and the phase, waiting on the person and for what, merged to main and so complete (green, nothing pulsing) with a confirmation step listing what is still to be confirmed (each clause signal and live check by name), each ticked as it is confirmed, or stopped and why.
   - **`the-planning-audit-is-a-step`** (split). The plan page's planning steps include the planning audit after the impl, in progress while the plan is read cold and done only when its plan review is answered.
   - **`always-a-next-step`** (split). Every plan that is not closed shows its next step and who takes it: what the system is doing now, or what it waits on and whether the person or an event completes it, so no open plan reads as stuck.
   - **`never-in-progress-when-idle`** (limit). Nothing reads as in progress while no process is running for it.

2. **`a-plan-document-is-written-through-its-checks`** (state). A shell command that writes a plan document is refused, so every change to a plan document passes the checks that guard it.
   - **`shell-write-refused`** (split). A shell command that writes, moves or deletes a file under a plan's folder is refused, naming the file and the tool to use instead.
   - **`reads-pass`** (limit). A shell command that only reads a plan document is never refused.

3. **`a-plan-with-clauses-carries-its-signals`** (state). An impl for a brief that states clauses is refused unless a phase reports each split and limit clause's signal, and no live check that can only run after landing is a clause's proof.
   - **`refused-without-signals`** (split). Saving such an impl with no task naming a clause's signal is refused, naming each clause without one.
   - **`a-live-check-proves-no-clause`** (split). Saving an impl whose row runs only after landing and names a clause is refused, since a skipped row blocks the clause at close.
   - **`the-two-landed-plans-report`** (split). The three clauses of a-brief-is-accepted-on-current-main report their signals from the code that keeps them, so that plan can close.

4. **`landing-tests-hold-under-load`** (state). The tests landing runs pass or fail for what they test, not for how busy the machine is.
   - **`recorder-waits-for-its-break`** (split). The admin-recorder landing test waits for the incident it expects rather than a fixed minute, and passes with other builds running.

### Existing promises

**Must not break**

- **`a-build-runs-to-review-unasked`**. A build still runs unasked to review; a dead one now says so instead of disappearing.
- **`nothing-ships-until-accepted`**. Restart starts the step the plan is at, never the release before acceptance.
- **`an-accepted-brief-is-planned-unasked`**. The planning run still starts on acceptance.
- **`a-production-break-is-recorded-unasked`**. Its landing test is made patient, not weaker.

**Changes**

- **`approval-waits-for-a-finished-plan`**. A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written for the documents as they stand with every finding answered; a plan whose impl is written without such a plan review, and that no run is still writing, is listed as needing its plan review.

**Replaces**

None.

### Not promised

- Telling the person outside the admin that a run stopped: notifications come with `activity-and-graph`.
- Running phases in parallel: `run-the-graph`.
- Guarding writes outside plan folders.

## Looks

The build controls' existing stop sentence carries a dead run's reason, and the existing Build button restarts it. Two looks change: the planning steps gain the planning audit, and a plan merged to main reads complete with its confirmation list.

### This plan makes

None.

### Existing looks

**Must not break**

- **`nav.expanded`**. The nav, whose plan rows state each plan's real situation in the words they already use.

**Changes**

- **`plan.working`**. The plan page's planning steps gain a **Planning audit** step after the impl (the cold read and its answers), shown in progress while it runs and done only when the plan review is answered; the build controls name the plan's real phase and a dead run's reason.
- **`plan.released`**. A plan merged to main reads complete, green and not pulsing, with a confirmation step listing each clause signal and live check still to confirm, ticked as each is confirmed.

**Replaces**

None.

## Depends On

- `a-brief-is-accepted-on-current-main` lands first (Stabilize order); this plan touches the admin's build host too.

## Blocks

- `decisions-as-questions` builds after the Stabilize items before it.
