# Approval Waits for the Planning Run — a plan is offered for approval only once its plan review is answered

**Decided 2026-10-19.** Full decisions: `.indusk/planning/archive/approval-waits-for-the-planning-run/impl.md` (its "Decisions made while writing this plan"). The rule it holds is the promise [`approval-waits-for-a-finished-plan`](/reference/admin-ui/sessions#decisions).

## Goal

**A plan is offered for approval only when its impl is a draft, its documents before it are accepted, no session is still writing it, and its `plan-review.md` has every finding answered. Every Approve button the admin draws asks that one answer.**

Before this, the admin offered Approve as soon as the impl was written and no session was open. The planning run's cold review (`plan-review.md`) could still be unwritten, so a person could approve a plan the review had not read.

## Decision

**D1. One reader of the plan review.** `plans/plan-review` (`readPlanReview`, `planReviewState`) reduces `plan-review.md` to missing, unanswered or answered. The planning run and the admin's offer both ask it, so the run cannot stop "ready for approval" on a review the offer reads as unanswered.

**D2. A new waiting kind, `plan-review`.** A plan whose review is not answered is listed under Needs you at the Impl step. Its accept asks the plan's agent, in words, to write the review; it never approves or releases. When the planning run stopped short, the decision says why.

**D3. One list of waiting kinds.** `WAITING_KINDS` in `plans/waiting` is the only list. The decision route reads it, so a sixth kind cannot be refused by a stale copy in the admin.

**D4. An answer names the decision it answers.** The card posts the kind it showed (`on`). If the plan waits on something else by the time the answer arrives, the route refuses before anything is approved or sent, and the page reloads. A plan-review card that has become an approval therefore cannot approve the plan without the person.

**D5. Approve is drawn from one answer.** `canApprove` is true only when the package lists the plan as waiting on approval, on the plan page and the brief page alike. On the plan page Approve sits on the decision card alone.

## Tradeoffs accepted

- **The live check is owed.** Driving a real planning run through the installed admin needs a real `claude`, so the end-to-end check (row A16) is deferred until after landing. Until it runs, the rule is held by unit rows and the reader rows on real plan folders.
- **A stale stop reason can outlive a hand rewrite** until the admin restarts or the next run replaces it.
- **"Not yet" on a plan-review card with no session open starts a planning session** told to carry on, the same path approval's "Not yet" takes. Changing what an alternative starts for every kind is wider than this plan.
