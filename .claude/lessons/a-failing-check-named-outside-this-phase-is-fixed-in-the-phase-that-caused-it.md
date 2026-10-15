# A failing check a phase causes is fixed in that phase — 'outside this phase' in Forward Intelligence is how it ends up unfixed at landing

**The rule.** When a phase's own change makes an existing check go red (a budget test, a register, a parity pin), repair it in that phase, in the same commit or the next, before the phase's Verification is ticked. Writing it under 'Outside this phase' in Forward Intelligence is not a repair and carries no owner.

**Why.** ui-promises Build Phase 1 added one root Key Decision line and pushed `context-tiers-register.test.ts` A13 (root CLAUDE.md ≤ 80 % of its budget) over its line; the Build Phase 1 Context item had even said 'compact first if over budget'. The failure was recorded as 'outside this phase' in the Forward Intelligence of Build Phases 2, 3, 4, 5 and 6 and fixed by none until the retrospective, 7 phases later, by moving one entry down a tier. The same plan carried an hour-dependent inbox test and a verify rejection the same way. A check every phase defers becomes the landing's problem, and a green-at-close `pnpm test` is what the landing gates on.

**How to apply.** Before ticking a phase's Verification, run the checks the phase's files can affect (budgets, registers, single-definition pins, hook parity) and fix any the phase broke. A failure that is truly pre-existing goes to `.indusk/planning/known-issues.md` or its own plan with a named owner the first time it is seen, not into a note that repeats. If a note says 'outside this phase' twice, stop and fix it.

See `.indusk/planning/archive/ui-promises/retrospective.md` ('Getting to Done', 'What We'd Do Differently').
