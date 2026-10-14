---
title: "cockpit-redraw — Retrospective"
date: 2026-10-14
status: accepted
---

# cockpit-redraw — Retrospective

## What We Set Out to Do

Make the cockpit look as Sandy meant it, each look approved once: the nav redrawn from the original cockpit mockup with every plan, Scorecards and a width you can drag; the brief page drawn and the plan page redrawn; and re-approving a changed brief made a person's alone (the looks guard refusing an agent's `plans reapprove` and the re-approve route).

## What Actually Happened

The plan touched 113 files (+5035 / −885); 65 of them under `apps/` (+2433 / −348), over 213 commits on `plan/cockpit-redraw`.

- **Build Phase 1** (the guard) and **Build Phase 2** (the nav, `NavHandle`, the width) went as planned.
- **Build Phase 3** hit a blocker the plan had not seen: the look check counts a state only when the page reports it (`data-look-state`), and the nav, brief and plan pages reported none — every state was opened at one path with an ignored `?state=`. Sandy chose per-state paths: each page reports the state it really draws from its own data, `screens.json` lists one path per state, A10 serves fixture plans in each condition from a throwaway project, and `?nav=<px>` makes `nav.wide` reachable.
- The build also took on, at Sandy's word: `brief.empty` (a plan with no brief file shows its parts at 0, as plain rows), and three session-panel fixes (no Start until the running session is looked up; starting an already-running session attaches to it; "Turn done" no longer repeats the reply).
- Adding `--size-nav-max` changed the foundation's hash, which reopened every story and mockup: about 113 approval entries were recorded again, on looks this plan never named.
- **Falsification** (Build Phase 4) found four holes by reading the code: a reader (`echo`, `cat`) exempted a segment that runs `plans reapprove` inside a substitution; `reapprovePlan` through an interpreter was unseen; a cancelled drag never ended; and a plan waiting only on an amendment reported `plan.working` while drawing the amendment card. All fixed.
- **Cleanup** (Build Phase 5) moved the plan tree's derivation out of `PlanList.tsx` into `lib/plan-groups.ts` (491 → 357 lines) and gave the nav's width one clamp (`clampNavWidth`).
- **The audit** (a cold reader on claude-opus-5-5) found that `screens.json`'s fixture paths broke `indusk looks check admin` against the person's own project — a 404 ended the run. **Build Phase 6** made a 404 an unchecked look, named, with the run going on: against the real project, 550 held, 0 broken, 182 unchecked (42 the fixture 404s; 140 "the page did not report state", not investigated).

## Getting to Done

- The per-state-paths blocker and its four discovered items were most of Build Phase 3.
- A test's `next dev` could not start beside a person's running admin (Next's one lock per build directory); the helper now builds into `.next-tests`.
- A10's teardown failed once removing its build directory (`ENOTEMPTY`) in two separate phases, passing on the rerun both times — a flaky teardown, not diagnosed.
- An impl edit in `2ee381bb` repeated the document four times; repaired in `a13fe1a0`.
- A Build Phase 4 subagent ran `pkill -f "next dev"` and took down the person's worktree admin on :3940; the next subagent was told never to.

## What We Learned

- **A look check opens pages; a page the project does not have is a fact about the project, not a failure of the run.** Pointing `screens.json` at fixtures made the whole-app check unusable against a real project, and nothing in the trajectory ran it there. The cold audit caught it; no ritual run by the building agent did.
- **A foundation token is a global change.** One new size reopened every story and mockup in the app. A plan that adds a token should expect, and budget for, a full re-approval round.
- **A text guard's reader exemption must not cover what the shell runs first.** `$(…)`, backticks and `<(…)` execute before the reader sees its arguments.
- **A state one page counts should be counted wherever it is shown.** Teaching only the plan page's look state about amendments left the nav's *Needs you* disagreeing with it.

## What We'd Do Differently

- Run the app's whole look check against the real project at the phase that changes `screens.json`, not only the plan's own contract test against fixtures.
- Make "waiting on the person" one rule (`planWaiting`) that knows amendments, rather than adding amendments at one caller.
- Tell every subagent up front never to stop processes it did not start.

## Insights Worth Carrying Forward

- The cold audit earns its place: its heaviest finding was invisible from inside the build.
- Plans are listed by handle, and a Path tells no story of what its subplans do together. Sandy's follow-up: names instead of handles, a master plan's page telling the story of its subplans, and the nav's *Needs you* counting amendments — started with `/planner` after this lands.

## Quality

- No recurring lint or type errors; no Biome rule added.
- **Shape:** 7 findings raised across the phases (Test Phase 1: 1, Build Phase 1: 1, Build Phase 2: 2, Build Phase 3: 1, Build Phase 6: 1; Build Phases 4 and 5: none); 0 judged wrong by a person.

## Tests at close

- `pnpm test` on the branch: 2 admin and 5 indusk-mcp files failed under the parallel run. Rerun alone, every file passes except `plan-worktrees-cli.test.ts` A13 (`?? .mcp.json` left in a created worktree), which fails the same way on `main` — not this plan's.
- Open, recorded for later: 140 admin looks unchecked as "the page did not report state"; A10's flaky teardown; the audit's guard spellings this plan does not catch (`plans "reapprove"`, a line continuation, a shell `sed -i` on `approved_brief:`), accepted as the tripwire's limit.

Landed on main at 36d4c16e, 2026-10-14.
