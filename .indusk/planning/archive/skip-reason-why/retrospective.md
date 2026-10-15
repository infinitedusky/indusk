---
title: "skip-reason-why"
date: 2026-10-14
---

# skip-reason-why — Retrospective

## What We Set Out to Do

component-content's plan page printed its 950-character `cleanup_reason` across the Cleanup step of its release rail. Sandy asked for two things (brief): a skipped step reads "skipped" with a small "why?" that opens the reason (`a-skipped-step-shows-why-on-request`), and a skip's reason is a one-sentence summary, refused at the retrospective otherwise (`a-skip-reason-is-one-sentence`). Bugfix workflow: brief, test plan, impl; two new step looks, `step.skipped` and `step.skipped-open`, approved in the cockpit before approval.

## What Actually Happened

Five build phases where the approved impl had two. 50 files, +1052/−97, 53 commits.

- **Build Phase 1** — `checkRetrospectiveReadiness` refuses a falsification, cleanup or audit skipped with a reason over 120 characters (`longSkipReasons`), the plan's status says so, the three skills state the limit.
- **Build Phase 2** — `Step` takes a `reason`; the rail passes it instead of joining it into the status. Two stories; Sandy approved all six step stories, because the new classes changed the component's stylesheet hash and reopened the four existing ones (their snapshots were unchanged).
- **Build Phase 3 (falsification)** — an audit skipped with a reason never read "skipped" (`steps.ts` and the admin reader knew only falsification and cleanup); the check measured length, not sentences ("Done. Nothing here. Fine." passed). Both fixed.
- **Build Phase 4 (cleanup)** — one `skippedRitualsOf` reader for `build/review.ts` and the admin, the reason rule moved to a dependency-free `rituals/reason.ts`, and `flushSync` taken back out of `Step` (the tests now wait).
- **Build Phase 5 (audit findings)** — the cold reader found the installed `.claude/skills/` copies never synced, and that an unattended build would answer a long reason by re-running the whole ritual. Resynced; `nextBuildStep` now returns a `shorten-reason` step whose session rewrites the one line.

## Getting to Done

- The landing install for component-content had "failed"; a `pnpm install` before `pnpm install:local` was enough. Its retrospective read the unchanged `1.70.0` as proof nothing installed, but the version only moves at a release.
- `declare_promise` (the MCP tool) refused: the server reads the main checkout, where the plan folder does not exist until approval. `indusk promises declare` from the worktree worked.
- Build Phase 1 imported the limit into `lifecycle.ts` from `cleanup/gate.ts`, which pulls `node:fs` into the admin's browser bundle; Build Phase 2 found it when the browser test failed to load.
- Build Phase 1's subagent ran `indusk update` to sync skills; the installed binary copied its own package's skills, edited unrelated files, and registered the worktree as a 27th project in `~/.indusk/projects.json`. The files were reverted and the registry entry removed (backup kept); the sync itself never happened until Build Phase 5.
- Build Phase 2 put `flushSync` in the component so tests reading the DOM straight after `click()` saw the reason — the component changed to suit a test's timing; cleanup reversed it.
- A Build Phase 4 checkbox was lost when the commit hook refused `--amend`; the code was in, the box was checked by hand.
- At this close, `pnpm test` failed `cockpit-nav.test.tsx` A13: Build Phase 3's `skipped-audit` fixture sat at review, and Needs you listed it. Moved to `executing`. Two more failures (`promises-contract` "does not hold a draft brief", `new-project-accept` A30) pass alone on the branch and on main — timing under parallel load, not this plan.

## What We Learned

- A parity test that already exists protects nothing if the phase never runs it: `skill-sync-parity.test.ts` would have caught the stale skills at Build Phase 1, but each phase ran only `vitest related`, which does not reach it.
- A rule that must reach the admin's browser bundle lives in a module with no imports; anything beside `node:fs` cannot be imported by `lifecycle.ts` or the admin.
- A component's new state is not free: adding a state's classes to its generated stylesheet changes its hash, and every approved story of that component reopens for a person.
- The audit was the most valuable ritual here: falsification and cleanup were run by the agent that built the plan and missed both the stale skills and the build runner's response; the cold reader found them.
- A gate that turns a ritual "not done" also changes what an unattended build does next; a refusal needs its own next step, or the build answers it with the nearest one it knows.

## What We'd Do Differently

- Run `skill-sync-parity.test.ts` in any phase that edits `apps/indusk-mcp/skills/` (now in `apps/indusk-mcp/CLAUDE.md`).
- Draw new step states in a mockup that names the stylesheet change, so the person knows six approvals are coming, not two.
- Tell subagents up front not to run `indusk update` from a worktree.
- Ask before taking "one sentence" literally: the sentence rule is a heuristic (a full stop, a space and a capital letter); the audit notes it lets "done. nothing. fine." through and would refuse "…, e.g. React components…". Sandy has not ruled on it.

## Insights Worth Carrying Forward

- The plan page's rail draws a refused long skip as "skipped" while the status says "too long" (`steps.ts` reads the skip before the position) — an audit finding left as a follow-on.
- No fixture draws a skipped Cleanup step on the page; the status wording is tested for cleanup and the over-length case only.

## Quality Ratchet

No Biome rule would have caught this plan's mistakes: each was a missed test run, a module boundary, or a test-timing workaround.

Shape findings: **2** raised (Build Phase 1, hoisting the skip-length closures to named functions; Build Phase 5, a fourth consumer of the step union in `models/next-session.ts`), **judged wrong by a human: not recorded** — no person reviewed them, so the count is unknown, not zero. component-content also recorded "not recorded"; neither plan reports a human-judged-wrong finding, so the streak trigger does not apply.

Periodic pass (move one root `CLAUDE.md` entry down a tier): not done at this close — the remaining root Conventions entries are repo-wide and no enforcer yet names one; recorded rather than forced.

## Metrics

- Sessions: one conversation and seven subagents (Test Phase 1, Build Phases 1–5, the audit reader).
- Files touched: 50; lines +1052 / −97.
- Trajectory: 16 rows, all `passing`; 2 promises.
- Release: dusk installs its own build at landing (`pnpm install:local`); nothing is published at this close.
