---
title: "plan-stories — Retrospective"
date: 2026-10-15
status: accepted
---

# plan-stories — Retrospective

## What We Set Out to Do

Name every plan by a short title a person would say, with its description as a separate field, in the admin and the editor; make a master plan's page tell its story (what it is for, then each plan in order with its title, description and stage) from a new `subplan-row` component; have Needs you list a plan waiting only on an amendment, by the same rule as its page; and write a title into every live plan where the admin reads it.

## What Actually Happened

The plan touched 107 files (+4133 / −773), 80 of them under `apps/` (+2877 / −618), over 126 commits on `plan/plan-stories`.

- **Build Phases 1–4** went as planned: one title rule in the package (`planTitle`, `readPlanName`), `subplans:` entries that carry a title and description, `planWaiting` knowing amendments, titles across the nav, Needs you, Paths and the plan page heading, and the master page built from `SubplanRow`. The retitled nav story reopened 26 looks; Sandy approved them in one pass, then the three `subplan-row` stories and the recomposed `plan.master`.
- **Build Phase 5** wrote titles into the live plans: ten on this branch, seven in their own worktrees (one frontmatter-only commit each). `demo-scenarios` was skipped (uncommitted live work in its worktree); `story-first-phases` kept the title someone had already written. A7, a live check, was Sandy reading Day's and Dawn's master pages on a clone of the branch: "this looks good".
- **Falsification** (Build Phase 6) found the nav and the Promises page giving one plan two names: the nav read the worktree copy, `readHealthNames` read the trunk's. `readHealthNames` became async over the package's copy resolver.
- **Cleanup** (Build Phase 7) moved the stage rule held in two files into one `planStage`, and put a queued plan's title on its placeholder entry. The second copy of the title lookup had already drifted: it ignored the project's product words.
- **The audit** (a cold reader on claude-opus-5-5) found that the master branch of the plan page returned before the trust notice, the decision and amendment cards, the history and *Ask about this plan*, all of which the master page had on `main`. It also found five admin surfaces still showing a bare handle, a declared title skipping the title rule, and the real amendment lookup run by no test. Sandy chose to fix all of it; **Build Phase 8** did.

## Getting to Done

- `vitest related` in Build Phase 4 found six tests left red by Build Phase 3. The nav's `planTitle` import reached `node:fs` in the browser test project, and fixture plans had no `title`.
- `readActivePlans` resolves every root to the trunk checkout, so it could not see this branch's unmerged retitles. The second expectation's count had to read each plan's own copy by hand, and A7 had to run on an admin serving a clone of the branch.
- The worktree admin reads a plan's own fields from the trunk until the branch lands, so Day's page there read "Day" with no purpose. The page was right; the checkout was wrong.

## What We Learned

- **One plan read from two copies gets two names.** Every reader that names a plan has to resolve the same copy (worktree first) through one resolver. A second walk of the assignments is a second rule.
- **A rule copied into a second file drifts before anyone notices.** Cleanup found the queued-title lookup already disagreeing (no product words) within the plan that wrote both copies.
- **Replacing a page body with an early return drops everything the old body drew.** The master branch returned before the plan page's controls, and no row asserted those controls were there. The cold audit caught it; nothing the building agent ran did. That is two plans running (cockpit-redraw, this one) where the audit's heaviest finding was invisible from inside the build.
- **A promise's sentence ("wherever InDusk names a plan") is wider than the screens a plan names in its rows.** The rows covered the nav and the plan page; the audit found the Promises page, the promise page, incidents and the Looks picker still showing handles.

## What We'd Do Differently

- When a promise says "wherever", grep every place the old thing is rendered (`entry.owner`, `plan.name` in JSX) at Test Phase 1 and give each a row, rather than listing the screens from the brief.
- When a page gains an early-return branch, write a row asserting the branch still draws what the shared frame drew.
- Test a lookup against real data (a real worktree, a real hash) from the start, not only through a fixture stand-in. `amendmentsWaiting` shipped through four phases untested.

## Insights Worth Carrying Forward

- The cold audit belongs before the retrospective on every UI-touching plan; twice now it has found the defect that mattered most.
- Retitling other plans on their own branches worked: frontmatter-only commits, skipping any worktree with uncommitted work, and no amendment raised (amendments compare expectations, promises and looks, not frontmatter).

## Quality

- No recurring lint or type errors; no Biome rule added. The format errors biome reported were in files this plan did not touch.
- **Shape:** 4 findings raised across the phases (Test Phase 1: 1, Build Phase 1: 1, Build Phase 2: 1, Build Phase 3: 1, reviewed and left as is; Build Phases 4–8: none); 0 judged wrong by a person.

## Tests at close

- Deferred verification: U1 (the retitled names say what each plan is), a scheduled review: Sandy reads the retitle commits; the second expectation's count lists every live plan still read by its handle.
- `pnpm test` on the branch: 3 admin and 10 indusk-mcp files failed under the parallel run, nearly all 5 s timeouts. Rerun alone, every file passes except `plan-worktrees-cli.test.ts` A13 (`.mcp.json` left in a created worktree), which also fails on `main` and is not this plan's (cockpit-redraw recorded it too).
- Nested-context probe (`vitest.e2e.config.ts context-tiers`): 4 of 4 pass. `pnpm e2e -- context-tiers` does not filter and ran the whole e2e set: one failure, the promise-loop test's Jaeger check, not this plan's.

Landed on main at 469723d1, 2026-10-15.

Release: none. dusk installs its build at landing (`pnpm install:local`, `indusk --version` 1.70.0); nothing published, since publishing is deliberate and this close is not one of those.
