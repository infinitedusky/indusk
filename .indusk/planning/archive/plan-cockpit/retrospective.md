---
title: "plan-cockpit"
date: 2026-10-10
---

# plan-cockpit — Retrospective

## What We Set Out to Do

Make the admin the mockup (`research/promise-ui/mockups/plan-cockpit.html`): a nav of every plan by Path, a promise dashboard with broken promises first, a page per promise with its proof and a fix, and a plan page as its two workflows with the one decision it waits on. The brief made eight promises and changed one (`the-admin-keeps-what-it-heard`); the ADR's rule was that every derived fact comes from a package module the admin reads, never computed in the admin.

## What Actually Happened

Shipped across Test Phase 1, Build Phases 1–6 as planned, a falsification phase (Build Phase 7) and a cleanup phase (Build Phase 8). 77 commits on the branch; 91 files changed (+8,819/−1,135); 43 trajectory rows passing (A1–A43, one of them the A32 live check).

- **Seven package modules**, each one definition: `promises/standing`, `proof`, `fix` (moved out of the editor), `rows` (exported); `plans/steps`, `waiting`, `history`. A34 pins by reading sources that the admin and the extension define none of them.
- **The admin**: the nav (Paths nested to any depth, released counts, Needs you, phone drawer, collapsible strip), the dashboard (group, sort, filter, broken first), the promise page with *Start a fix plan*, the plan page as Planning and Release with Details beneath, and the decision card, whose answers reach the agent and are committed on `main` as `chore(indusk):` lines.
- **A32, live**: run through Playwright against the demo, not by a person; the break showed and *Start a fix plan* started a session with no terminal. Caveat recorded in the impl: the promise was already broken from earlier demo runs, so time-to-broken from clean was not measured.

## Getting to Done

- **Falsification found six things in code the plan had just called done**, and all six were real: a review could be accepted twice (the card stayed while the release ran, and `startRelease` had no running guard); an answer delivered but not recorded read as failed, inviting a double send; a promise held broken only by an open incident — the normal state after a recorded violation — had no fix button; the dashboard's thirty days counted violations, not days; the promise page dropped violations heard under an earlier name; a history line quoting an old statement containing "confirmed" read as confirmed.
- **Cleanup found the old `PromisesTable`, about 400 lines, rendered by nothing** but three test files, and seven copies of one time format. The tests had to be retargeted rather than deleted because active promises and archived rows name those files.
- **The close had four refusals.** `promises confirm` read a comma list in a `promise:` token as one name, and two state promises had no code site carrying the token; the dead-pointer check refused a path to a directory that exists only after the first decision. The root `CLAUDE.md` had been over its lowered budget since Build Phase 1's Key Decisions line and nothing stopped the phases that followed.

## What We Learned

- A planned "being proven / known-violated" distinction was the plan's own blind spot: the standing treated an open incident as broken, the health reader treated it as amber, and the fix path only knew red. The falsification hypothesis came from reading two modules side by side, not from the trajectory.
- One token per comment line: a comma list is read as its first name only, and nothing says so until `promises confirm`.
- Moving a view's replacement in does not retire the old view; the retargeting cost was found only at cleanup.

## What We'd Do Differently

- Run `promises confirm` (it writes nothing while refusing) at the end of each build phase, not once at close.
- Pin the dashboard's definitions against the promise page's in one test (thirty days, window, held). The audit found the two still disagree on what "held" means and on the window edge; nothing here guards it.
- Put the root-budget test in a phase's verification when the phase adds a root line.

## Audit Findings Left Open

The cold audit (`audit.md`, advisory) names things this plan did not act on: the dashboard's `held` is `30 − brokenDays`, not observed; the dashboard window is rolling 30×24 h while the page uses 30 UTC days; A33 compares package functions and never runs the CLI or either page; `pathOf` returns the first declaring Path, not the innermost; only the first question of a multi-question ask is answered; "approval" fires for any draft impl; the docs sidebar had no entry for the decision page (fixed at close). These are for a follow-on.

## Shape

Shape raised **3 findings** across the phases (Build Phases 4, 5 and 6), all fixed in place; **0** were judged wrong by a human.

## Insights Worth Carrying Forward

- A fact computed in two places will disagree on its edge cases; the single-definition test caught names, not arithmetic.
- A close-out ritual that finds six real defects in a "done" plan is worth its phase.

## Release

Nothing published: `indusk checks show` declares no release command or version file for this project, and landing installs the build. No bump.
Landed on main at 141870f8, 2026-10-10.
