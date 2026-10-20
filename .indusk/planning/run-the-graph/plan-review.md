---
plan: run-the-graph
reviewed: 2026-10-20
model: claude-opus-5-5
read: 4856e6d7d80bc45b5d12eec35eb75628b4d61db92afd03ff28af35fe03eb606a
---

# Plan review — run-the-graph (second recheck of the 2026-10-20 fixes)

## Do the planned tests prove each promise's sentence, or something narrower?

- nothing

## Does the impl build what each promise claims, and nothing it does not?

- nothing

## Which skip reason would you not accept?

- nothing

## What else would have to change for each promise to hold?

- .indusk/planning/run-the-graph/impl.md:576 — the selector fix added a part to the `green-before-merging` signal's recomputed list: "the `Test` file of every trajectory row whose `For` names such a promise or one of its clauses". The same gap is in test-plan.md:175. Like the older part beside it ("the test files of every row whose `For` names a clause those rows name"), the new part has no Passes-at filter. Only the first part of the list carries one ("whose Passes-at phase is closed there"). The selector it claims to match "part for part" (impl.md:546, adr.md:95) leaves out every row whose Passes-at phase has not joined, across all parts. Read as written, the signal expects test files that the check correctly never ran.
  - breaks when: a phase joins and its clause, or a marker-touched promise, also has rows that pass at a later phase. In this plan, Build Phase 1 joins T6, which is for `ready-phases-start`, while that clause's T28, T29 and T45 pass only at Build Phase 5. The signal finds those files absent from the report and reads `broken` on a correct join, so the clause cannot read upheld in a real run.
  - answer: fix — impl.md's `green-before-merging` signal task and test-plan.md's `green-before-merging` signal now apply one Passes-at filter to every part of the recomputed set (each row whose Passes-at phase has not joined is dropped, with any listed file that is such a row's test file); adr.md D6 states the selector applies that filter to every part and the signal the same, so the two agree part for part.

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/test-plan.md:48 — the fix for the hold on a phase-less session in the plan's worktree counts that session as "no room" (also at test-plan.md:73, adr.md:66 and 104, impl.md:300, 630 and 684). This makes `ready-phases-start` and `no-needless-wait` read upheld for as long as such a session lives. Nothing bounds that time or reports it. Planning sessions run in the plan's own worktree (`planLocation` → `live.copy.root`, apps/indusk-admin/src/lib/session-host.ts:114), and a brief is accepted from inside the planning conversation. So the usual case is a planning session still open when the person presses approve. The brief's changed sentence (brief.md:82) only refuses a new phase-less session while phases build. It does not hold phases back behind one that is already running. The test plan's re-reading of "up to the session cap" to cover this is not in the brief.
  - breaks when: a plan is approved in the admin while its planning conversation is still open. Today its build starts at once. Here no phase launches until that conversation ends, which can be hours or never. The ready-phases signal logs no room, the waiting signal accepts `plan-session` as a reason, and story 1's "both start the moment you approve" is false with every signal reading upheld.
  - answer: fix — the graph never holds a launched plan behind such a session: adr.md D7 now refuses Build while a session with no phase runs in the plan's own worktree, naming that session, with the refusal recorded as the run's stop reason so the admin shows it (the hold is listed as rejected); impl.md Build Phase 5's work-step task makes that check before any launch, the scheduler loses its `plan-session` reason, and the ready-phases signal never counts such a session as no room; test-plan.md A48 and impl.md T45 now assert Build is refused naming the open session and nothing launches, and the "no room" wording is gone from the ready-phases and no-needless-wait signals and the Notes.

## What let these through?

- no process gap — both are second-order effects of the previous round's fixes (the selector fix added a part without carrying the filter; the hold was a new remedy for the earlier worktree finding), and this recheck read is the step that exists to catch exactly that.
