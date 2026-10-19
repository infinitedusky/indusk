---
title: "A plan is read cold before approval, and every audit concern is answered"
date: 2026-10-17
status: accepted
workflow: feature
clauses: required
description: "A cold reader checks a plan's documents against each other before the person approves it, and the audit reads the code when the build phases close, before falsification. The plan's agent answers every concern itself and stops for the person only when the answer would change what they approved; every \"nothing needed\" is put in front of the person, and the process gaps that let the findings through become lessons."
---

# A plan is read cold before approval, and every audit concern is answered — Brief

Split out of [mark-first](../mark-first/) (Tests and telemetry linked to
clauses) on 2026-10-17 (Sandy), where it was the promise
`an-audit-concern-gets-a-solution`, withdrawn there and to be declared here.
Sandy, 2026-10-17, after an audit found seven gaps caused by one way of working (scoping from memory instead of grepping): audits should result in learning — ask what we did wrong that led to the findings, and learn from it. Sandy's earlier point: an audit, a fresh reader, is good at finding what is wrong; the
plan's agent, with the build's context, is better at deciding what to do about
it. The guard against the builder waving away a concern about its own work is
that a person sees each "nothing needed".

**The shape, agreed 2026-10-17 (Sandy):** the auditor finds each concern and
says what would show it breaking, and suggests no remedy; the plan's agent
chooses the answer; the person sees every "nothing needed". Considered and
not chosen: the auditor also suggesting a solution for the agent to accept or
replace.

**Widened 2026-10-19 (Sandy):** the last two audits raised 24 and 25 concerns,
most of them about the plan (a test narrower than its promise, a skip reason
written in advance) and visible before any code was written, and the
unattended build wrote its audit only after acceptance, so nothing answered
it. Two moves: a cold read of the plan before the person approves it, and the
audit on the code when the build phases close, before falsification and
cleanup, so their work and the answers are built before review. The brief is
the contract, so the plan's agent decides every answer itself unless the
answer would change the brief; that one goes back to the person as an
amendment. One plan, because all three change the audit step, its skill and
the build and planning loops.

## Expectations

1. **Audit concerns stop being left unanswered.**
   - Measure: in `audit.md` files after this lands, the share of concerns with an answer (fix, signal or reason); expect all.
   - Look: at the next three plans that run the audit.

2. **Audits teach.**
   - Measure: lessons the evaluator writes from audit-cause highlights, per audit run; expect most audits with findings to name a gap, and fewer repeat findings of the same kind over time.
   - Look: after the next five audits.

3. **Most concerns are found before the build.**
   - Measure: per plan, concerns raised by the cold read against concerns in `audit.md`; expect more from the cold read.
   - Look: at the next three plans.

4. **The post-build audit is short.**
   - Measure: concerns per `audit.md`; the last two had 24 and 25; expect under ten.
   - Look: at the next three plans.

## Promises

### This plan makes

1. **`an-audit-concern-gets-a-solution`** (state). Each concern an audit raises is answered by the plan's agent with a fix, a signal that would show it breaking, or the reason nothing is needed.
   - **`the-audit-finds`** (split). The auditor raises each concern and says what would show it breaking, and suggests no remedy.
   - **`the-plan-answers`** (split). The plan's agent answers each concern with a fix, a signal (the invariant checked, where it is emitted, how often it would fire, which clause it upholds) or nothing with the reason.
   - **`a-dismissal-reaches-the-person`** (split). Every concern answered "nothing needed" is shown to the person with its reason.
   - **`an-audit-teaches`** (split). Each process gap behind an audit's findings — a way of planning or building that could let the same kind of finding through again — is named and flagged for a lesson; an audit with none says so.
   - **`a-significant-concern-goes-to-the-person`** (split). A concern whose answer would change what the person approved — a promise, an expectation, a look or the plan's scope — is written as an amendment to the brief, which stops the build until the person re-approves; the plan's agent answers every other concern without asking.

2. **`a-plan-is-read-cold-before-approval`** (state). Before a plan is put to the person for approval, a reader that has not seen the planning conversation reads its brief, test plan, ADR and impl against each other, and the planning agent answers each concern it raises.
   - **`the-reader-checks-the-plan`** (split). The reader asks whether each planned test proves its promise's sentence or something narrower, whether the impl builds what each promise claims, which skip reason it would not accept, and which files a promise depends on that the plan does not touch.
   - **`the-reader-sees-documents-only`** (limit). The reader is never handed the planning conversation or the planning agent's notes.
   - **`the-plan-is-answered-before-approval`** (split). Each concern is answered, by changing a plan document or with the reason nothing is needed, before the plan is presented; the answers are shown with it.
   - **`the-planning-run-reads-it-cold`** (split). The unattended planning run reads the plan cold as its last step, before it stops for approval.

### Existing promises

**Must not break**

- **`an-audit-blocks-nothing`**. The answers change no gate: the retrospective still reads that `audit.md` exists, never what it says.
- **`the-auditor-sees-the-plan-not-the-session`**. The post-build audit is still handed only the documents, the approved impl and the diff.
- **`an-accepted-brief-is-planned-unasked`**. The planning run still writes the test plan, ADR and impl unasked and stops for approval; the cold read comes before that stop.
- **`a-build-runs-to-review-unasked`**. The build still stops only for review, a declared judgement or when it cannot continue; a significant concern stops it through the amendment it writes, which already stops a build.

**Changes**

- **`a-plan-is-audited-by-a-fresh-reader-before-it-closes`**. When a plan's build phases close, before falsification, a reader that has not seen the building session reads the plan and writes what it finds to `audit.md` in the plan folder, and the retrospective refuses to start until that document exists or the impl says why the audit was skipped.

**Replaces**

None.

### Not promised

- A gate on unanswered concerns. The audit stays advisory.
- The cold read checking the code. Before the build there is none; the post-build audit asks the code's questions (what the diff changes that no test touches, what it does that nothing promised, which rejected alternative it took).

## Looks

A dismissal reaches the person in `audit.md`, in the cold read's notes beside the plan and in the step's report in the session. The one interface change is a sentence: the build controls say why a build stopped, and gain one for a build waiting on re-approval. No mockup draws a stop's sentence.

### This plan makes

None.

### Existing looks

**Must not break**

- **`plan.working`**. The plan page while it builds, whose build controls gain the sentence for a build stopped on an amendment.

**Changes**

None.

**Replaces**

None.

## Depends On

- `.indusk/planning/mark-first/` — a signal answer names the clause it upholds, which needs clauses linked to their telemetry. Its promise `a-clause-is-proved-twice` is not yet in the trunk's registry, so this plan does not rest a clause on it; it builds after `mark-first` lands.

## Blocks

- None.
