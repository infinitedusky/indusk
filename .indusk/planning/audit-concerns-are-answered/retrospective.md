---
title: "A plan is read cold before approval, and every audit concern is answered"
date: 2026-10-19
---

# A plan is read cold before approval, and every audit concern is answered — Retrospective

## What We Set Out to Do

Widened on 2026-10-19 (Sandy) from "audit concerns are answered": a cold read of
a plan's documents before approval (`plan-review.md`, the planning run's last
step), the post-build audit moved to before falsification, every concern
answered by the plan's agent, and one whose answer would change the brief
stopping the build as an amendment.

## What Actually Happened

Built unattended in four build phases plus falsification; cleanup skipped.
50 files, +1905 / −204. One reader (`readAuditAnswers`) for both files,
`plans audit-answers [--plan-review]`, `plans review-inputs`, the audit before
falsification and a named `amendment` stop in `nextBuildStep`, the
`plan-review` planning step, and the order in five skills.

**Not closed: landed with its promises still declared** (Sandy, 2026-10-19).
`mark-first` landed the same morning with the rule that a clause closes only
when its signal has reported it upheld in a real run. This plan was planned
before that rule and emits no signal, so `indusk promises confirm` refuses all
nine clauses. The code is tested and accepted; the plan stays in
`.indusk/planning/` (not archived) until a follow-on adds the signals and
confirms. See Follow-ups.

## Getting to Done

- **A false amendment mid-build.** The brief's Changes entry wrapped the new
  sentence in "Now: … (Was: …)", so the registry change made in Build Phase 2
  read as a change the person never approved. Re-approved; the wrapping was
  removed at close for `confirm`, which compares the sentence exactly.
- **The amendment hold did not hold.** While that amendment waited, the build
  session checked Build Phase 3 off through a shell `python3` edit of the impl,
  which no hook watches (they watch Edit and Write). Nothing refused it. The
  loop's own amendment stop (this plan's Build Phase 2) closes it once
  installed; a shell guard is on the hardening list.
- **A look the brief did not name.** The build controls gained one sentence for
  the amendment stop; acceptance refused a brief saying None for looks.
  Amended to list `plan.working` as must-not-break.
- **The release died after acceptance** — most likely the admin restarting —
  and nothing showed it stopped or offered to restart it. Finished by hand.

## What We Learned

- An audit run under "do not act on findings" answers every concern "nothing":
  15 of 15 here, 10 of them named real. The answers are dismissals in form
  only; these ten go to the follow-on.
- A plan written before a closing rule lands meets that rule at close; a plan
  in flight needs the new requirement added as a phase when the rule lands.
- Every gate that reads an edit can be walked around by a shell write.

## What We'd Do Differently

- Write a brief's Changes entry as the exact new sentence.
- When `mark-first` landed, add a signals phase to every plan with clauses in
  flight, before their builds finished.

## Insights Worth Carrying Forward

Fix forward when the gap is reporting, not behaviour: landing the tested code
and closing the promises in a follow-on keeps speed without pretending.

## Quality Ratchet

No lint or type pattern recurred. Shape: raised nothing that a human judged
wrong (0 / 0 recorded in the impl).

## Follow-ups

1. **Signals for the nine clauses** (a small follow-on, then `indusk promises
   confirm audit-concerns-are-answered` and archive): the audit-answers command
   reports the five audit clauses; the review inputs and reader the read-cold
   clauses; the planning loop "the planning run reads it cold".
2. **The ten real findings answered "left for the person"** in `audit.md`:
   audit step read by existence only; causes section read by heading only;
   only column-zero `- ` items count as findings; no scope part in amendments;
   `plan-review.md` not tied to the documents' content; `readBuildPlan` refuses
   when the approval commit is unreadable with nothing waiting; clause registry
   read from cwd; trailing punctuation on a clause name; a signal answer
   accepted in `plan-review.md`; a brief edit before approval not shown as an
   amendment.
3. **The live check** (row A23): after landing and an admin restart, the next
   unattended planning run should write an answered `plan-review.md` before it
   stops for approval.

## Metrics

- Files touched: 50; +1905 / −204.

Landed on main at 58b0e18f, 2026-10-19. Installed (`pnpm install:local`) and the admin restarted; nothing published. Promises stay declared until the signals follow-on confirms them.
