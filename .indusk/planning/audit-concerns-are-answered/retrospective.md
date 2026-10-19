---
title: "A plan is read cold before approval, and every audit concern is answered"
date: 2026-10-19
---

# A plan is read cold before approval, and every audit concern is answered — Retrospective

## Status

Landed on main twice. The first landing (`58b0e18f`, 2026-10-19) carried the build as it stood before the amendment's Build Phases 7 and 8. This retrospective lands the rest: five commits, the amendment approval through the accept, plus the test fixes below. **Not closed.** `indusk promises confirm` refuses four of the nine clauses, because no real run has reported their signals (A32, a deferred live check). The plan folder stays in `.indusk/planning/` until that passes. The plan does not archive past a refusal.

## What We Set Out to Do

Widened on 2026-10-19 (Sandy) from "audit concerns are answered": a cold read of a plan's documents before approval (`plan-review.md`, the planning run's last step), the post-build audit moved to before falsification, every concern answered by the plan's agent, and one whose answer would change the brief stopping the build as an amendment.

## What Actually Happened

Built unattended in eight build phases plus falsification; cleanup skipped with a reason. Totals since the first landing: 38 files, +1203 / −67 (`git diff --stat main...HEAD` before this retrospective's commits). Across the whole plan: 50 files, +1905 / −204.

Two gaps from the first landing were closed on the branch. Build Phase 7 (each clause reports its signal, `clause-signal.ts`) wrote the reporters. Build Phase 8 closed the ten findings the earlier audit left open.

### Ritual gate

`checkRetrospectiveReadiness` passes: falsification, cleanup, audit, rows and promises all satisfied. `indusk plans next` reports the build as built.

### The audit of this build

`audit.md` (the auditor's file, read cold by a fresh reader) holds 15 findings. Every one is answered `nothing — real: … left for the person at review`. `indusk plans audit-answers` exits 0, because each answer has text, so the form check passes. That does not make the answers right. They are dismissals in form only:

- Ten are called real by the answer itself. They are the open defects listed under Follow-ups. Each is a concern about this plan's own checks (for example: the build loop counts the audit done when `audit.md` exists; a `*` or numbered finding reads as answered).
- One is factually wrong. `audit.md` says the amendment detector has no scope part. `apps/indusk-mcp/src/lib/plans/amendments.ts:35` includes `"scope"` in `AmendmentPart`, and A36 (a row in this plan's impl, asserting a Not-promised edit after approval is an amendment) passes in `amendments.test.ts`. Recorded as a false positive, high confidence: I read the type and the test.
- Four are not defects. They are deliberate choices the answer gives reasons for.

### Decisions taken unattended

1. **Promise token on `amendments.test.ts`.** `promises confirm` refused because A36's file did not carry `promise: an-audit-concern-gets-a-solution`. A36 proves the clause `a-significant-concern-goes-to-the-person`, so the token is accurate. Commit `d48bb3427`.
2. **Test isolation in `gate-policy-env.test.ts`.** The "without it" case inherited `INDUSK_GATE_POLICY=auto` from this build, so it failed under `pnpm test` landing. The fix unsets the variable for the child hook. Not a product change. Commit `d48bb3427`.
3. **Not archived; landed anyway.** The skill says archive before land and do not archive past a refusal. The plan's own Deferred Verification (A32) says it stays open until confirm passes, and the earlier landing already put this code on main. Landing the five new commits is what the requester asked for. Archive waits.
4. **The ten audit defects are not fixed here.** Fixing them changes checks and some would change the approved brief (A36-class amendments need the person). Named as a follow-on, below. Concern: they are real.
5. **No release.** `workflow.steps.land.install` is `pnpm install:local`; nothing is published, per the retrospective's Step 11 for projects that install their own build.

## Getting to Done

- **A false amendment mid-build.** The brief's Changes entry wrapped the new sentence in "Now: … (Was: …)", so a registry change read as one the person never approved. Re-approved; wrapping removed at close.
- **The amendment hold did not hold.** While an amendment waited, a build session checked Build Phase 3 off through a shell `python3` edit, which no hook watches. The amendment stop this plan added closes that path only once installed; a shell guard is on the hardening list in `current.md`.
- **The release died after acceptance**, most likely the admin restarting, and nothing showed it or offered a restart. Finished by hand.
- **A must-not-break test failed only inside a build.** `gate-policy-env.test.ts` inherits the build's policy variable (decision 2).
- **Confirm refused on a missing token**, which the plan's test file had (decision 1).

## What We Learned

- An audit run under "do not act on findings" answers every concern "nothing": 15 of 15 here, ten of them labelled real. The form check cannot tell a reasoned dismissal from a deferred defect. (High confidence; this is the second plan to show it.)
- An auditor's factual claim can be wrong while its shape is right. Read the code it names before answering.
- A plan written before a closing rule meets that rule at close. Add the new requirement as a phase when the rule lands (`mark-first`'s signals rule).
- Every gate that reads an edit can be walked around by a shell write.

## What We'd Do Differently

- Write a brief's Changes entry as the exact new sentence.
- Give a plan with clauses a signals phase from the start. Here the signals came last, and A32 now blocks close.
- Do not run an audit under an instruction that makes its findings un-actionable. Either let it act, or label its output as advisory and say who decides.

## Shape

Shape reviewed each build phase (Build Phases 1, 2, 3, 4, 5, 7, 8) and recorded nothing raised. Shape raised 0 findings; 0 judged wrong by a human. Build Phase 6 was cleanup, which Shape does not review. No streak of wrong findings, so no calibration trigger.

## Metrics and tests

- Landing tests (`indusk plans tests audit-concerns-are-answered --landing`): one run failed (`gate-policy-env.test.ts`, decision 2); after the fix, the run passes (exit 0).
- Trajectory audit (`auditPlanAtClose`): no blocked rows, no non-terminal rows. Two deferred rows: A23 (live planning run after landing, skipped) and A32 (nine clauses from real runs, skipped). Both are manual checks.
- `indusk context check-pointers`: pass.
- Nested-context probe (`pnpm e2e -- context-tiers`, required because `apps/indusk-mcp/CLAUDE.md` changed): see result in the closing note below.

## Follow-ups

1. **Signals for four clauses, then confirm and archive (A32).** Clauses `the-reader-checks-the-plan`, `the-plan-is-answered-before-approval`, `the-planning-run-reads-it-cold` and `a-significant-concern-goes-to-the-person` each need a real run to report upheld. A planning run's plan review and one build stopped on an amendment do this. Until then, `promises confirm` refuses.
2. **The ten defects left "real" in `audit.md`.** Each needs a fix, a signal or a stop. Listed as a follow-on brief in the master, not here. The defects: the build loop counts the audit done on file existence; the causes section is read by its heading only; only column-zero `- ` items count as findings; `plan-review.md` is not tied to the documents it reviewed; `readBuildPlan` refuses when the approval commit is unreadable, with nothing waiting; the clause registry is read from cwd, not the plan's copy; trailing punctuation joins a clause name; a signal answer is accepted in `plan-review.md`; a brief edit before approval is not shown as an amendment; a Not-promised edit path in the amendment detector (the auditor's claim, which the code contradicts, is excluded).
3. **The live check (A23)**: after landing and an admin restart, the next unattended planning run should write an answered `plan-review.md` before stopping for approval.

## Landing

Not yet landed on this branch's final commits. Step 10 (merge trunk in, land, verify on trunk) and Step 11 (no release) follow this retrospective's commit.
