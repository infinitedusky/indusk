# Before choosing a new key or name for something the parser already numbers (phases, rows), read how the parser numbers and spells it, and check that two kinds do not share a number

Why: run-the-graph named a phase's branch `phase/<plan>/<n>` with `n` from the heading. The parser (`impl-parser-core.ts`) gives Test Phase N and Build Phase N the same number, so Build Phase 1 would find Test Phase 1's branch already present and "resume" on it, and Test Phase 2 and Build Phase 2 running together would share one branch and worktree. The dependency lines also named `Build Phase 6` while the falsify skill writes `### Phase N: Falsification` and `phaseLabel` writes `Build Phase 2: <name>`. The own-worktree signal listed each path and branch once in `git worktree list`, so it read upheld during the collision.

What to do: before inventing a key, run the existing parser over a real impl and look at what it returns for every phase kind (test, build, ritual, maintenance); use the parser's own identity function, not the heading text. Put the kind in the key (`build-1`, `test-1`). Make the signal for a key check uniqueness of the identity it was built from, not only the appearance of each derived name.

Pointer: .indusk/planning/run-the-graph/plan-review.md (findings on branch naming and the phase key); highlight h-20261020-010.
