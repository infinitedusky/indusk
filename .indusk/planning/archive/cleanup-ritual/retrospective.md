---
title: "Cleanup Ritual"
date: 2026-07-13
---

# Cleanup Ritual — Retrospective

## What We Set Out to Do

Give InDusk a system-level answer to code accretion — numero's `page.tsx` at 1,439 LOC with zero decomposed components, in a project that *had* a documented ≤200-LOC convention. The brief's arc: every existing quality layer inspects behavior, process, or the delta; nothing inspects the accumulated shape of the tree. Build a plan-close decomposition ritual (`/cleanup`) twinning `/falsify` — investigate changed files, apply the enabled domain extensions' best practices, author a reviewable Cleanup Phase — with retrospective Step 0 enforcement and **no mechanical LOC gate** (the threshold is attention-focus only). A bolted-on Phase 0 also taught the trajectory validator to accept `A`-prefixed test IDs.

## What Actually Happened

The design walked through three framings before code was written, each killing a class of problem: (1) a fifth per-phase mechanical gate with a LOC ratchet — killed by research (~15 edit sites across 5 files + TS↔JS parity risk) and by the user's over-extraction concern; (2) an artifact-producing gate — killed by "advisory artifacts are the numero failure restated"; (3) the accepted shape — the user's insight *"we already have a comp for this: falsification."* The ritual model cost one skill + one gate helper + one config block, zero hook changes — proven empirically by T5 (a hand-authored Cleanup phase passes the existing hooks unchanged) *before any code landed*.

Build: 6 phases, then two falsification rounds and a self-applied `/cleanup`. 21 commits, 36 files, +2,530/−178 lines. 25 trajectory rows: 22 passing, 3 skipped-with-reason (T1 subsumed by dogfood, T10/T11 deferred to the numero "first customer" plan). Full indusk-mcp suite green at close.

**Nine real defects were found and fixed by the plan's own rituals:**

- **Round 1 (`/falsify` #1, H1/H2/H4/H8):** substring phase detection misidentified "The /cleanup skill" as the ritual phase (the gate would have passed without the ritual running — on this very plan); `checkRetrospectiveReadiness` didn't honor the default phase-authored falsification flow (would have falsely *blocked* this very plan); `ensureCleanupConfig` clobbered user scopes; the default `origin/main` base silently returned empty diffs on local repos.
- **Phase 5 dogfood:** the oversized lib flagged `pnpm-lock.yaml` (7.7k LOC) and the semantic-graph log (25k) as decomposition targets → `isGeneratedOrVendored` filter (T17).
- **Round 2 (`/falsify` #2, holistic, F1–F4/F6):** silent-empty on non-git roots — the workbench shape, the exact statePath/gitPath lineage as the 1.31.7/1.31.12 eval-rail bugs — plus git stderr spam; a bare `### Phase N: Cleanup` heading was vacuously terminal; nested unchecked items were invisible to terminality; **4 of 5 installed ritual skills were stale** (the stale retrospective copy still carried the falsification-only Step 0 — this retrospective would have run under the wrong gate); the guide documented the pre-H1 substring detection.
- **Publish-prep:** the `/cleanup` skill referenced monorepo-internal paths and the lib had no package subpath export — `/cleanup` would have installed fine and broken immediately on any consumer project. Fixed with `./cleanup/oversized` + `./cleanup/gate` exports.

The self-applied `/cleanup` concluded `cleanup: skipped` with a reasoned confession — the plan's own new modules (127/120/112 LOC) are under cap and cohesive; the honest outcome for a plan that added well-shaped files, and a live dogfood of the skip path.

## Getting to Done

- **The A-prefix bootstrap irony:** Phase 0 (accept `A`-IDs) had to be validated by an impl that itself still used `T`-IDs — the allowance isn't live until the phase that adds it lands. The write-time validator rejected the first impl draft for exactly the friction being fixed.
- **Parallel-committer git state:** the session spanned days on a branch carrying unrelated WIP; the user committed backlog work (and some of this plan's in-flight files, under their own messages) between agent turns. Resolved by strict per-path staging and stash-testing HEAD compiles without foreign WIP. A separate half-landed plan (worktree-visibility) broke `pnpm build` mid-publish-prep — held the publish (user chose "clean up first") until its owner finished it.
- **The T25 bonus catch:** the structural skill-sync test written for F4 immediately caught a *sixth* stale skill (`catchup`, drifted by worktree-visibility) that the manual probe missed — the ratchet out-performed the audit that motivated it on its first run.
- **Skill availability confusion:** `/cleanup` "Unknown command" led to a publish instinct; the actual gap was local install (`.claude/skills/cleanup/SKILL.md`) — publish is for *other* projects. The harness registered the skill the moment it was installed.

## What We Learned

- **Ritual-shaped enforcement is cheap; gate-shaped enforcement is expensive.** The falsification-twin model delivered the same teeth (retrospective hard-block) for ~1/10 the machinery of a fifth gate type, because a ritual-authored phase reuses every existing gate. T5-style "prove the zero-cost claim empirically at Phase 0" de-risked the whole plan in 20 minutes.
- **Detection by substring is a recurring defect class** — the eval-trigger `\b` bug (H5, git-only-substrate), now ritual-phase detection (H1). Anchor at the boundary that carries meaning (title start, command start), never `includes`-style matching.
- **Every mirrored artifact needs a structural parity test.** Three of five round-2 findings were "the fix didn't reach every replica" (source skills vs installed, code vs guide, hooks' workbench-awareness vs new lib). Byte-equality tests (T25) convert silent drift into test failures; manual audits under-count (T25 found a 6th stale file immediately).
- **Consumer-reachability is a falsification surface for anything published.** A skill/lib pair can be fully green in the monorepo and broken everywhere else — check subpath exports + package-relative paths before publish, not after.
- **The workbench root is a standing trap for new git-using code.** Third independent recurrence of the statePath/gitPath split (eval-rail 1.31.7, 1.31.12, now the cleanup lib). Any new code that shells to git must decide explicitly which root it needs — and fail loudly on the wrong one.
- **LOC thresholds work as attention-focus.** The dogfood flagged 12 genuinely-oversized files with zero false pressure — because nothing blocks on the number, false positives cost a glance, not a skip-reason.

## What We'd Do Differently

- **Sync installed skills in the same commit as source edits** (now enforced by T25 — but the discipline should have been obvious; the "edit in apps/, run update to sync" convention assumed a global `indusk` that dusk doesn't have).
- **Write docs after falsification, not before.** The guide was authored in Phase 5 and went stale against the Phase 6 H1 fix within hours. For plans with a falsification phase pending, the doc gate should trail the fix phase or explicitly re-audit (round 2's F6 was this failure surfacing).
- **Run the holistic falsification round by default.** Round 1 hunted the code just written; round 2 hunted the seams (workbench, sync, docs, publish) and found the higher-severity issues. The seams are where the "fix didn't reach every surface" class lives.
- **Check consumer-reachability at skill-authoring time** — the monorepo-internal path in `cleanup.md` was writable-day-one detectable.

## Insights Worth Carrying Forward

- The three-reframe design arc (mechanical → artifact → ritual) was driven by the user twice rejecting mechanical strictness — each rejection removed a failure mode research alone hadn't priced. Present the counterargument early; the user's domain instinct ("extraction isn't universally good") reshaped the ADR more than the six-reader research did.
- Bounty-hunt falsification compounding: 2 rounds × specific-hypothesis hunting = 9 confirmed defects on a plan whose full suite was green after every phase. Green tests measure what the author thought to test.
- The ritual held itself to its own rules end-to-end: its falsification used the phase-authored flow its gate had to honor (H4), its self-cleanup exercised the skip path, and this retrospective ran under the gate it built. Self-application is the cheapest integration test a dev-system feature has.

## Quality Ratchet

Reviewed for Biome-expressible mistakes: the defect classes (substring detection, mirrored-artifact drift, non-git-root behavior, missing exports) are semantic/structural, not lintable — no new Biome rule. The ratchet took a different form this plan: the **T25 structural parity test** (installed skills ≡ sources) is a permanent tightening of the same kind — a class of mistake that can now never silently recur.

## Metrics

- Sessions spent: 1 multi-day session (2026-07-06 → 2026-07-13)
- Commits: 21 (plan-scoped, on `plan/cleanup-ritual-phase-0`)
- Files touched: 36 · Lines: +2,530 / −178
- Trajectory: 25 rows — 22 passing, 3 skipped-with-reason, 0 blocked
- Defects found by own rituals: 9 (4 round-1, 1 dogfood, 4+1 round-2 incl. T25's bonus catch) — all fixed in scope
- Tests at close: full indusk-mcp suite green (exit 0); 40+ plan-scoped tests
- New surface: 1 skill, 2 lib modules, 1 config block, 2 subpath exports, 2 docs pages, 1 structural parity test
