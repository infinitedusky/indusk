---
title: "Many plans at once — approve then improve"
date: 2026-10-13
status: draft
workflow: feature
closed_reason: "Closed 2026-10-15 by Sandy: served its purpose; the direction lives in promise-core."
---

# Many plans at once — approve then improve — Brief

*Opened 2026-10-13, during Build Phase 4 of brief-as-the-contract, while Sandy
was approving the plan page's mockups for the third time. A draft from that
conversation, to be reworked in the planner's conversation before it is
accepted; nothing is declared. Reframed 2026-10-14 around many plans at once
(Sandy: "focusing on parallel execution is the key"); approve-then-improve, small
plans and promise history are the means.*

## The vision (moves to research)

InDusk is for building prototypes and early software, not rocket ships. A first
version carries no danger and can always be improved, and the whole reason for a
loop driven by promises and telemetry is to avoid having to be perfect on day one.
The system builds on the decisions a person has made firm and does not force them
to make every decision. It expects things to change a lot over time, and is built
for that.

**Discipline exists for speed and reliability**, so that changing one thing does
not break another. It is not there to make moving fast harder, or to make anyone
build more than the moment needs.

**Enforcement is the strength, and it is not a verdict.** Everything a person
approves is held exactly: a mockup by its value, a promise by its statement. Being
held does not mean being final. Anything held can be changed or overridden. The
only requirement is that the intention is clear: what changed, and why.

**Approval is a baseline, not a claim of perfection.** "This is good enough to
build on", followed by improvements one at a time, is the ordinary way to work.
Each improvement is its own small, clear change that is approved again.

**Many plans at once is the multiplier.** Big arcs run plans one after another;
improvements, fixes and things that are not right run side by side. What limits
that is not how many agents can run — worktrees and unattended builds already
allow it — but the person's attention, plans colliding, landing order, and what a
plan costs to start. Everything below serves that.

**Smaller plans are better, and groups give the big picture.** The natural unit
is the smallest plan that ships one promise; plans are grouped under a parent
(`master.md`) so the arc stays visible while each piece moves on its own.

**The process scales with the change, and the rigor stays.** A change that
touches one promise and breaks nothing held is a brief, one phase and its test,
confirmed from a conversation in one step; a change that touches many gets the
full plan. The size is judged from the code — promises touched, files, public
surface — not from how small the request sounds. Promises, tests, regression
guards and looks held by value run either way; what shrinks is the paperwork.

Sandy's words: "the easier way to work than to fully approve something that has a
lot of different things is to approve and then improve… if I bring those issues
up right now, that becomes the focus of what we're doing. And I'm not concerned
about that right now."

## What acts against it today (moves to research)

Found during brief-as-the-contract's Build Phase 4. The test applied to each: does
it protect a decision already made, or demand one before it is needed?

1. **Approval means "exactly right".** A mockup is shown whole, so the person
   inspects all of it, and every flaw they see becomes a blocker on the current
   work.
2. **Approval churn.** One new row component took five rounds: drawn as a mockup,
   approved; story written, approved; screens recomposed, approved again. A
   changed component sends every screen that places it back to proposed, and the
   screen is reviewed as a whole again with nothing marking what changed.
3. **A person-only check holds the machine.** A17, a live check in
   brief-as-the-contract's Build Phase 4, held the phase open, and with it the
   Shape review and Build Phase 5, though nothing built later depended on it.
4. **Documents before code, every time.** Research, brief, test plan, ADR and impl
   before any code. Then implementation, verification, Shape, context and docs in
   every phase, including docs for features likely to change next week.
5. **A mockup before every UI change.** A person cannot try something on the page
   and react to it. A look is drawn and approved first.
6. **Every change to what was agreed is treated as a contract change.**
   brief-as-the-contract's amendment rule stops the build for any difference in
   promises, expectations or looks, whether a wording tweak or a reversal.
7. **The working agent treats every remark as "now".** Each issue the person
   mentions becomes an item in the current phase, so their attention follows the
   agent's queue instead of their own goal.

### Found while landing sessions-per-plan (2026-10-14)

The first plan built under the parallel-first direction
(`.indusk/planning/archive/sessions-per-plan/`) turned these up. Each is
observed, not hypothetical.

8. **Two plans in flight changed the same code and nothing said so.**
   cockpit-redraw landed "attach instead of refuse" on the same sessions route
   sessions-per-plan was rewriting; the collision surfaced only as merge
   conflicts at landing, and the two designs had to be reconciled by hand.
   Warning when parallel plans touch the same files or promises is what makes
   parallel safe.
9. **An unchanged mockup returned to proposed.** `agent-panel.already-running`
   was approved, then main's foundation changed, and the identical mockup had to
   be approved again — the churn in item 2, with nothing in it changed.
10. **`plans accept` passed a look nobody had approved.** After the brief gained
    a look at accept time, accept went through while the look was still proposed;
    it checks new components' stories, not the looks the brief names.
11. **The amendment reader cannot read an archived plan.** `plans amendments`
    looks for the brief at its archived path in the approval commit, where it was
    not yet archived, and refuses; accept then did not check for an amendment at
    all, so a changed brief was accepted unseen.
12. **The interface check is the whole `src` folder.** Accept refused 19 files
    as "the admin's interface" — API routes, library code and tests among them —
    when one component had changed how anything looks.
13. **The gate hooks see only the editor's tools.** Subagents edited `impl.md`
    with scripts, so the hooks that order a phase's gates never ran on those
    edits. A rule enforced on one write path is advisory on the others.
14. **The audit found what the tests did not prove.** No row asserted the total
    stays at or under the cap; none covered the per-plan sessions read; the fix
    page and the draft conversation show "continue that session here?" with no
    button. A cold reader earns its place; its findings need a home that is not
    the plan being closed (the improve list).

## The arc (moves to a `master.md` when the plan starts)

A parent plan, each subplan small and its own branch. The order is by what stops
ten plans running at once.

1. **`sessions-per-plan`** — done, landed 2026-10-14: an agent per plan and kind,
   a machine cap. (`.indusk/planning/archive/sessions-per-plan/`)
2. **A `change` workflow** — a plan sized to its effect: one conversation, one
   confirmation, brief + one phase + its test. Every subplan after this goes
   through it.
3. **Parallel plans warn before they collide** — two plans in flight touching the
   same files or promises are named to the person before either lands (item 8).
4. **A person's check does not hold the build**, and **the person's queue** — one
   view across plans of what waits on them, each a quick decision.
5. **Landing in order** — plans that finish together land one after another, each
   on the last, without hand merges.
6. **Approve with notes, the improve list, what changed in a look** — and the
   holes items 9–12 name in accept, amendments and the interface check.
7. **A promise is found by what it used to say** — its history searchable, a
   retired promise pointing to what replaced it.
8. **The hooks hold on every write path** (item 13).

What already works for the vision: promises checked by telemetry; expectations
looked at after several plans; slow tests off the landing path; worktrees and
frequent commits as checkpoints; regression guards.

## Expectations

1. **Approving a look takes one look at what changed, not a review of the whole.**
   - Measure: approvals per look per plan, and the time from proposed to
     approved, over the next three UI plans against brief-as-the-contract.
   - Look: when the third UI plan closes.
2. **Issues a person notices stop interrupting what they came to do.**
   - Measure: improvements recorded with an approval, and how many of them
     became items in the phase then running (target: none unless the person
     said "now").
   - Look: after three plans.

3. **Several plans move at once, and stay small.**
   - Measure: plans in flight at once, and promises per plan, over the month after
     the `change` workflow lands against the month before.
   - Look: a month after the `change` workflow lands.

## Promises

### This plan makes

1. **`an-approval-shows-what-changed`** (behaviour). A look that returns to
   proposed is shown with what changed since its last approval: highlighted on
   request, and named (which component, which region).
2. **`a-change-carries-its-why`** (state). Every change to an approved look or
   promise records why it was made, and the reason is shown wherever the change
   is. The history of a look is a list of its changes and their reasons, which
   later mockups and agents read as context.
3. **`approve-with-notes`** (behaviour). A person can approve and leave notes
   in the same act. Each note becomes an improvement on a visible list, not an
   item in the work running now.
4. **`an-override-states-its-intention`** (behaviour). Any enforcement can be
   overridden. An override names its intention, and the override and its reason
   are recorded where the rule's next reader will see them.
5. **`a-person-check-does-not-hold-the-build`** (structure). A check only a
   person can make is recorded as waiting and shown to them. It does not stop
   phases that do not depend on it.
6. **`the-process-scales-with-the-change`** (state). A plan whose change touches
   one promise and breaks nothing held is offered as a brief, one phase and its
   test, confirmed in one step; the size is judged from the code (promises
   touched, files, public surface), never from the request's wording.
7. **`a-big-brief-is-offered-a-split`** (state). A brief whose promises fall in
   unrelated areas, or number more than three, is offered a split into smaller
   plans grouped under a parent.
8. **`parallel-plans-warn-before-they-collide`** (state). When two plans in
   flight change the same file or the same promise, both are named to the person
   before either lands.
9. **`a-promise-is-found-by-what-it-said`** (behaviour). A person searching for
   what a promise used to say finds it, retired or changed, with what it became.

### Existing promises

**Must not break**

- **`a-plan-builds-only-after-approval`**. Approve-then-improve changes what
  approval means, not whether it is required.
- **`a-look-reports-like-any-promise`**. Looks are still held by value: what was approved is exactly what is checked.

**Changes**

- **`a-change-to-what-was-agreed-needs-the-person`**. brief-as-the-contract's amendment rule: a change carrying a stated intention
  is an improvement and is approved in place; only a change to a promise's
  meaning stops the build. To be settled in the ADR.

**Replaces**

None.

### Not promised

- Going back to an earlier point in a plan's history (restoring a look, a
  brief or a worktree to a past commit). Sandy raised it alongside the history
  panel. It is its own plan.

## Looks

To be drawn in the planner's conversation: the Looks page's "what changed"
highlight and the change history of a look; approve with notes; the improve list.

## Depends On

- sessions-per-plan (landed: several plans' agents at once).
- brief-as-the-contract (approval of the brief, amendments, the plan page's
  History panel).

## Blocks

None.
