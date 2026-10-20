---
plan: run-the-graph
reviewed: 2026-10-20
model: claude-opus-5-5
read: 775723ad273f3a3d4296ed7020d5fd3a91ce50751f2e89f1058f675f1b0aeaf0
---

# Plan review — run-the-graph (third recheck of the 2026-10-20 fixes)

## Do the planned tests prove each promise's sentence, or something narrower?

- nothing

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/impl.md:54 — T7 is the trajectory row for the scheduler's wait reasons, a Build Phase 1 unit test in `schedule-wait.test.ts` for the `no-needless-wait` clause ("no phase is held back by a phase it does not depend on"). It still lists "a session with no phase in the plan's worktree" as a reason a phase waits. The fix for the earlier hold finding removed that reason everywhere else. ADR D7 (adr.md:104) says "The scheduler has no reason for it". The scheduler task (impl.md:300) lists no such reason, and the `no-needless-wait` signal does not accept one (impl.md:348, test-plan.md:73). As written, T7 asks Build Phase 1 to test a scheduler reason that the design rejects.
  - breaks when: Build Phase 1 writes T7 as its row reads. The builder either adds a `plan-session` wait reason to `pickPhasesToStart`, which brings back the unbounded hold that D7 rejected, and every such wait then reads broken on the `no-needless-wait` span. Or the builder cannot make the row pass against the scheduler that the task specifies.
  - answer: fix — impl.md T7: "a session with no phase in the plan's worktree" removed from the wait reasons, matching D7, the scheduler task and the `no-needless-wait` signal (that case is Build refused, T45).

## Which skip reason would you not accept?

- nothing

## What else would have to change for each promise to hold?

- nothing

## Which way could a clause fail that no signal would see?

- nothing

## What let these through?

- no process gap — a leftover from the previous round's fix, which a recheck read exists to catch.
