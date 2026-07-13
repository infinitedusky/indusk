# Cleanup Ritual — Lessons

The `cleanup-ritual` plan (archived 2026-07-13) shipped `/cleanup` — the plan-close decomposition ritual twinning `/falsify`. Beyond the feature, the plan's own process produced reusable lessons: two falsification rounds found **nine real defects** on a plan whose test suite was green after every phase.

## Ritual-shaped enforcement is ~10× cheaper than gate-shaped

The original design was a fifth per-phase gate type with a mechanical LOC ratchet. Research priced it at ~15 edit sites across 5 files plus TS↔JS hook parity risk — and the strictness question (no-growth vs strict-shrink vs require-extraction) had no good answer: every mechanical LOC lever either forces the wrong abstraction, penalizes genuine in-place refactor, or drives nothing. The falsification-twin ritual model delivered the same teeth (retrospective Step 0 hard-block) for one skill + one gate helper + one config block, because a ritual-authored phase reuses every existing gate. The claim was proven *empirically at Phase 0*: T5 showed a hand-authored `### Phase N: Cleanup` passes the existing hooks unchanged, before any code landed. **Prove the zero-cost claim first; it de-risks the whole plan in minutes.**

## Detection by substring is a recurring defect class

Round 1's H1: `isCleanupPhaseTerminal` matched `/cleanup/i` anywhere in a phase title — so the plan's own "The /cleanup skill" phase was misdetected as the ritual phase, and the gate would have passed without the ritual ever running. Same class as the eval-trigger's `\bgit commit\b` matching `git commit-tree` (git-only-substrate H5). **Anchor at the boundary that carries meaning** — title start, command start — never `includes`-style matching. Second recurrence makes this a pattern, not an incident.

## Every mirrored artifact needs a structural parity test

Three of five round-2 findings were "the fix didn't reach every replica": source skills vs installed `.claude/skills/` copies (4 of 5 stale — the stale retrospective skill would have enforced the *old* gate on this very plan), code behavior vs docs prose (the guide described pre-fix substring detection), and hook workbench-awareness vs the new lib. The fix: a structural byte-equality test (`skill-sync-parity.test.ts`), which on its first run caught a **sixth** stale file the manual audit had missed. Manual audits under-count; parity tests don't.

## The workbench root is a standing trap for git-shelling code

`listOversizedChangedFiles` silently returned `[]` on any non-git root — and a workbench root (where `.indusk/` lives) is deliberately not a git repo, so the ritual would have reported "nothing to clean" on every workbench project. This is the **third independent recurrence** of the statePath/gitPath split (eval-rail 1.31.7 and 1.31.12 before it). Any new code that shells to git must decide explicitly which root it needs, and fail loudly on the wrong one.

## Consumer-reachability is a falsification surface

The `/cleanup` skill referenced monorepo-internal source paths and the lib had no package subpath export — fully green in-repo, broken on every consumer project. Publish-prep caught it; nothing in the test suite could have, because in-repo the paths resolve. Before publishing anything pairing an agent instruction with library code, ask: *"would this work where the package is a tarball in node_modules?"*

## Two falsification rounds compound

Round 1 hunted the code just written (4 defects: detection, gate composition, config clobbering, base-ref resolution). Round 2 hunted the *integration seams* — workbench, skill sync, docs, publish — and found the higher-severity issues. The seams are where the "fix didn't reach every surface" class lives. For dev-system features, self-application closed the loop: the ritual's falsification used the phase-authored flow its own gate had to honor, its self-`/cleanup` exercised the skip path, and its retrospective ran under the gate it built.

See the full record: [decision](/decisions/cleanup-ritual) · [guide](/guide/cleanup-ritual) · archive at `.indusk/planning/archive/cleanup-ritual/`.
