---
plan: run-the-graph
reviewed: 2026-10-20
model: claude-opus-5-5
read: 3a5e7e1e7c7574104d570ac1b2bed6b3932112f734f0e10b921d0a7dc81190e5
---

# Plan review — run-the-graph (recheck of the 2026-10-20 fixes)

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/run-the-graph/test-plan.md:198 — the section heading for `every-phase-is-checked` still states the dropped rule: "a phase that touches a clause carries that clause's signal". The dated decision two lines below drops that rule, and so do the brief (brief.md:67, "the plan carries a signal for every clause it touches") and the registry. The fix also narrows the clause. The signal (test-plan.md:202, impl.md:575) and `missingSignalTasks` judge only the brief's own clauses, and explicitly skip "a clause of another plan's promise, touched through a marker in a changed file". The brief's sentence covers every clause the plan touches, and the plan touches those clauses too.
  - breaks when: a phase changes a file that carries another plan's `clause:` marker, and that clause has no signal anywhere. The brief says the plan carries a signal for it, the span reads upheld, and the heading tells a reader that each phase is judged one by one.
  - answer: fix — test-plan.md: the `every-phase-is-checked` heading now reads the brief's sentence; the decision, signal and Fails-when list judge every clause the plan touches (the brief's, plus each clause whose `clause:` marker is in a file the plan changed, carried by a signal task in the impl or a signal in a source file). The ADR's D6 and the impl's signal task say the same.

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/run-the-graph/impl.md:395 — this line says "The promise `a-session-belongs-to-its-plan` already reads the brief's changed sentence". The registry file `.indusk/promises/a-session-belongs-to-its-plan.md` still reads the old sentence: "only a second session of the same kind on the same plan is refused … so a plan can have a planning session and a build at the same time". No task changes it. The 2026-10-20 amendment reached the brief only.
  - breaks when: the plan closes and its changed promise is confirmed. The promise text then contradicts both the per-phase rule and the new refusal of a session with no phase in the plan's worktree, which this plan builds and tests (T11, T44).
  - answer: fix — impl.md: the claim in the session-identity task is corrected. A new last task of Build Phase 2 runs `indusk promises change a-session-belongs-to-its-plan` with the brief's Changes sentence word for word, only after T11 and T44 pass. The promise file is added to that phase's Files line and to Files Affected. The ADR's D7 says the registry changes after the code.

## Which skip reason would you not accept?

- nothing

## What else would have to change for each promise to hold?

- .indusk/planning/run-the-graph/test-plan.md:261 — the documents now stop a phase at once, without a retry, when an impl part that both sides changed will not merge. They justify this with "a session edits only its own phase's section (the gate hook holds it there)". The same claim appears at adr.md:94 and impl.md:563. The gate hook only refuses ticking another phase's checkbox (impl.md:311). It does not stop a session from editing the shared parts that `joinImplStructure` splits out: Notes, Files Affected, the trajectory table, or another phase's deferral body inside Test Phase 1's section. Two parallel phases that both append to `## Notes`, or both add a trajectory row with the same new ID, change one part on both sides. That part fails `git merge-file`, and the phase is stopped for a conflict that a retry after merging the plan's branch in could resolve.
  - breaks when: two phases running together both write a note, or both add a row with the next free ID. The second is stopped with `impl-conflict` and its dependents wait until Build is pressed again.
  - answer: fix — test-plan.md (the green-before-merging Fails-when line, A31, A32, the Notes decision), adr.md D6 and impl.md (the merge and retry tasks, T24, T25): the claim about the gate hook is removed. When both sides only appended to a part, both sets of lines are kept. A row ID added on both sides is kept once if the rows are equal; otherwise the joining phase's row is renumbered to the next free ID within its own section. Any part that still will not combine is a failed attempt with a retry that tells the session to merge the plan's branch in and resolve it. It is never an immediate stop.
- .indusk/planning/run-the-graph/impl.md:407 — the amendment is made (brief.md:82, 2026-10-20), but three passages still treat it as open:
  - impl.md:407: "Brief amendment pending".
  - adr.md:104: "an amendment the person decides".
  - test-plan.md:232: A37's Why column quotes the old brief sentence "a plan can have a planning session and several phases building at the same time" as the sentence being narrowed.
  - breaks when: someone reads the impl or the ADR to learn what was agreed. They find an open amendment and a brief sentence that no longer exists.
  - answer: fix — impl.md: the plan-worktree refusal task now cites the approved amendment. adr.md D7: says the change was amended and approved by Sandy on 2026-10-20. test-plan.md A37: the Why column quotes the brief's new sentence.
- .indusk/planning/run-the-graph/brief.md:56 — the amendment adds a new hold: the graph launches nothing while a session with no phase runs in the plan's worktree (`waitingOn: plan-session`, impl.md:299 and 623). The top promise sentence was not changed to allow it: "every phase whose dependencies are done is running, up to the session cap". Neither was `ready-phases-start`'s signal. That signal exempts only a phase waiting on a person's judgement or blocker (test-plan.md:48, impl.md:677), so it counts a phase held this way with cap room as launched late.
  - breaks when: a planning session that was open in the plan's worktree before Build was pressed is still running when phases become ready. Every ready phase reads late under `ready-phases-start`, and the promise sentence reads false while the documents call this hold correct.
  - answer: fix — test-plan.md (the ready-phases-start signal, a new Fails-when line, new row A48, Notes), adr.md (D3, D7) and impl.md (scheduler, graph step, signal tasks, new row T45 in Build Phase 5): a session with no phase in the plan's worktree counts as no room, the same as a full cap. A phase it holds is not ready to launch, so "up to the session cap" holds. The signal reads that session from the sessions file and logs no room, so the phase never reads late, and its minute starts when the session ends.

## Which way could a clause fail that no signal would see?

- .indusk/planning/run-the-graph/impl.md:569 — the fix says that the `green-before-merging` signal recomputes "the same set the selector resolves". The selector (impl.md:539) also includes "every row whose `For` names such a promise or clause", meaning rows of this trajectory whose `For` cell names a promise found only through a marker in a changed file. The signal's recomputation (here and at test-plan.md:173) lists the registered `tests:` of those promises but not those rows. So the signal and the selector still disagree.
  - breaks when: the selector leaves out a joined row whose `For` cell names a promise touched only through a marker in a changed source file. The join runs without it and the signal does not miss it.
  - answer: fix — test-plan.md (the green-before-merging signal and a new Fails-when line), adr.md D6 and impl.md (the selector and its signal task): the signal's recomputed set now includes the test file of every trajectory row whose `For` names a promise or clause that is touched through a marker. It now matches the selector part for part.

## What let these through?

- a brief amendment and a selector fix were each applied to one document only, without listing every place that restates the changed sentence or mirrors the changed rule: the registry, the ADR, impl and test-plan wording, the signal that mirrors the selector, and the other clauses' signals the new hold touches — findings: test-plan.md:198, impl.md:395, test-plan.md:261, impl.md:407, brief.md:56, impl.md:569 — highlight: h-20261020-015
