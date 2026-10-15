---
title: "cockpit-audit-fixes — Retrospective"
date: 2026-10-15
---

# cockpit-audit-fixes — Retrospective

## What We Set Out to Do

Make true, as worded, four claims that plan-cockpit's cold audit found too narrow, and add the rows that audit found missing. The brief made four promises: `the-thirty-days-say-only-what-was-seen` (a held day is a day seen upheld and not broken, and the dashboard and the promise page show the same thirty days), `a-question-is-answered-in-full` (a several-question ask is shown whole and every question gets an answer), `approval-waits-for-a-finished-plan` (a plan waits for approval only once its impl is written and nobody is still writing it), and `a-promise-sits-in-its-innermost-path` (the dashboard and the nav put a plan under the innermost Path that declares it).

## What Actually Happened

Against today's main the branch changes 29 files (+1158/−174), 26 under `apps/` (+1014/−135), over Test Phase 1 and four build phases.

- **Build Phases 1–3 went as planned.** One counting function (`standing.ts`'s `dayCounts` over thirty UTC days) now serves the dashboard and the page; the decision card shows a several-question ask whole and answers each under its question's text; approval is not offered while a session writes the impl; `path-nesting.ts` decides the innermost Path for the nav and the dashboard.
- **Falsification (Build Phase 4) found three gaps.** A planning session that had finished its turn but stayed alive waiting for the person still held approval back (now a session is "writing" only while its turn is open, `SessionManager.isWriting`); two Paths that declare each other split the nav from the dashboard (nesting is now strict, so a cycle nests neither way); and a several-question card offered no words of the person's own (each question now takes them).
- **Cleanup was skipped after review**: every changed file under 340 lines, the plan's own work being the consolidation.
- **The plan sat built for four days while main moved on.** A merge of main was left half-done in the worktree; finishing it meant carrying this plan's fixes into main's new structure: the innermost-Path rule into `lib/plan-groups.ts` (main had moved the nav's grouping there), the several-question form into main's `UiDecisionCard`, and the turn-open tracking into the session manager's new `record()` from decided-prompts-stay-closed.

## Getting to Done

- The half-finished merge had ten unmerged files, six of them already resolved but not staged. Each was checked against both sides before it was kept.
- The merge broke two nav tests whose data predated main's required `declaredTitles`; they were brought up to the new shape.
- The cleanup skip reason was a paragraph; the retrospective refuses one over 120 characters, so it became one sentence with the detail in the impl body.

## What We Learned

- **A plan left built while the trunk is redrawn pays for it at landing.** The fixes were right; the files they lived in had moved. Porting a fix into a refactored file is the expensive part of a late merge, not the conflict markers.
- **"Writing" is a turn, not a process.** A live session waiting for the person is idle; reading liveness as activity held approval back.
- **Nesting from declarations needs a strict rule for cycles**, or two readers (nav and dashboard) each break the tie their own way.

## What We'd Do Differently

- Merge main into a built plan's branch when main lands a redraw of the files it touches, not at its own landing.
- Write a comparison row (three surfaces, two pages) with inputs that make the two sides differ; a comparison over identical inputs passes whatever each side does.

## Insights Worth Carrying Forward

- Falsification found three defects the rows had passed, and the cold audit found rows that prove less than their promises. Shape: 4 reviews, 0 findings, 0 judged wrong.

## Audits

- **Docs:** `reference/admin-ui/overview.md` (Needs you with amendments; Paths listed once under the innermost, under both only when neither contains the other), `promise-page.md` (three Stats with the strict held/broken days) and `sessions.md` describe what was built.
- **Tests:** after both merges, the affected admin tests 119/119 and the package's waiting and session-manager tests 39/39; tsc clean in both apps. The root run is at landing.
- **Trajectory audit:** A1–A14 all `passing`; no deferred, blocked or non-terminal rows.
- **Quality:** a biome error in the plan's own A7 test (unsafe optional chaining) was fixed in the merge; no new rule warranted. Shape: 4 reviews, 0 findings, 0 judged wrong by a person.
- **The audit's findings carried, not fixed here** (`audit.md`): A5 (dashboard and page give the same days) uses one source, so a disagreement across several sources is unseen; A10 (status, dashboard and page agree) feeds both sources identical data and calls a package function rather than the command; A13 (two Paths that declare each other) accepts either Path on the dashboard and two listings in the nav; the admin's fixture still encodes held = 30 − broke; `buildGroups`'s innermost rule has no test of its own. Build Phase 3's skipped context item: the rule (one place decides which Path holds a plan; nesting is strict) is in `path-nesting.ts`'s header with its promise token, where the work is written; `apps/indusk-admin/CLAUDE.md` is past its 16 KB budget (21.6 KB) and the hook refuses growth, so nothing was added there. Compacting it is outstanding.
- **Landing (2026-10-15):** main merged in cleanly. Root run: the admin's one failure was `NewProjectProposal` A3 (a click timing out, the browser flake main-suite-green recorded), 7/7 alone; turbo then stopped indusk-mcp, run on its own: 3 failures, none this plan's — `plan-parser` and `hooks-record-parity` looked for the Dawn master at its pre-archive path (main's 5c04a75c8; fixed on main by Sandy in 076159901, 9/9 after), and `plans-next` A11 passed alone. Context-tiers probe 4/4; the rest of the e2e run fails only `day-monitor` (Claude Code's model-error wording, template-reload-on-cold-cache's fix). Installed with `pnpm install:local` (`indusk --version` 1.70.0); nothing published.

Landed on main at 717698fc2, 2026-10-15.
