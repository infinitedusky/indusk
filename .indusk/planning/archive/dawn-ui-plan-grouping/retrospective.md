---
title: "Dawn UI — Plan Grouping — Retrospective"
date: 2026-08-03
status: completed
---

# Dawn UI — Plan Grouping — Retrospective

## What We Set Out to Do

Make the plan hierarchy visible in the admin UI. Parents declare their children top-down (`parents:` + `roadmap:` in the root master, `subplans:` in each parent's own master); the shared parser exposes those declarations; the sidebar renders parent groups with ordered children and greyed placeholders for declared-but-uncreated subplans. One invariant outranking the feature: **grouping never hides a plan** — any broken declaration degrades to the flat list. Component 0 of the Dawn master plan, deliberately first so the sequence of everything after it is visible.

## What Actually Happened

Five phases instead of the planned two, and the plan is better for it. 29 files changed, +2115/−513, across 34 commits on `plan/dawn-ui-plan-grouping`.

- **Phases 1–2 landed as planned**: `readPlanDeclarations` in the shared parser (subpath-exported; the admin never re-reads frontmatter), grouping in `PlanList.buildGroups` (a deliberate deviation — the reader stays a pure data layer; grouping is display), T1–T9 authored red first.
- **Phase 3 was discovered work**: the Phase 2 visual check revealed that making parents first-class in the sidebar left them unrenderable in the detail view — a parent carries `master.md`, which is outside `DOC_FILES`, so every section resolved to undefined and `PlanDetail` rendered a blank page with a stray "Falsification" heading. Phase 3 added the parent detail view (master prose + subplan cards + placeholders) and the doc-less guard.
- **Phase 4 (falsification) confirmed five hypotheses — all real**: archived subplans rendered as "queued" placeholders (and the two surfaces disagreed about them); a parent's own documents were suppressed by the exclusive parent branch; multi-parent group order followed parser iteration, not the roadmap; declaration names reached a filesystem path join unsanitized (`parents: ["../../../x"]` read a `master.md` outside the planning dir); duplicate declared names double-rendered. All fixed under red-first tests (T11–T15).
- **Phase 5 (cleanup) decomposed what the plan grew**: `ParentPlanView.tsx`, `FalsificationSection.tsx` (tests following the unit), shared `ui/badge-variant.ts`, and `lib/research-reader.ts` split out; `PlanDetail.tsx` went 704→345 and `planning-reader.ts` 465→378, with T16 pinning behavior parity (zero assertion/testid changes; suites 145/145).
- **Mid-flight user feedback** renamed the placeholder badge `planned` → `queued` — "planned" collided with the plan-lifecycle vocabulary and implied a stage the declared-but-uncreated names never reached.

## Getting to Done

- **The worktree test-environment trap cost a debug cycle.** The mcp suite showed 12 failures that looked like regressions; the real cause was the fresh worktree lacking the gitignored admin production bundle (`apps/indusk-mcp/admin/.next`). Baseline-comparing on unmodified `main` + rebuilding the bundle (`pnpm build` + `bundle-admin.js`) reproduced trunk's environment; only 3 pre-existing failures remained (`agent-roles-phase4`, which fails identically on main — makeover CLAUDE.md compaction fallout, flagged cross-plan — and the known `daemon-identity` PID-reuse pair).
- **A leftover dev server masqueraded as 15 http-test failures** — the previous session's `next dev` held port 3000 and the `http-*` tests spawn their own server from the same directory. Killing it took the suite to 141/141.
- **The trajectory validator caught prose, correctly**: a Phase 3 verification note mentioning the unrelated `daemon-identity` tests by their T-IDs tripped cross-reference-integrity (those IDs don't exist in this plan's table). Reworded to "the PID-reuse pair" — impl prose must not name foreign test IDs.
- **An old test pinned a bug**: `PlanDetail.test.tsx`'s T14 (from the archived admin-ui plan) asserted the stray falsification empty-state renders on doc-less plans — exactly the behavior Phase 3 declared a bug. Rewritten deliberately, with a comment recording why.

## What We Learned

- **Happy-path fixtures never exercise lifecycle transitions.** T1–T10 covered create-time shapes; every falsification hypothesis came from lifecycle edges — a subplan *archived*, a parent *growing* documents, a *second* parent arriving, names *going bad*. When testing a feature over long-lived entities, walk each entity through its whole lifecycle in the fixtures.
- **Declaration names are boundary values.** Anything read from frontmatter and joined into a path or rendered verbatim needs the same sanitize-at-the-boundary treatment as session IDs and research slugs. The repo had the convention; the new parser initially didn't apply it.
- **Fresh worktrees are not trunk-equivalent test environments.** Gitignored build artifacts (the bundled admin) exist on trunk by accident of history; a worktree starts without them. Baseline-compare on unmodified main before diagnosing worktree test failures as regressions.
- **UI labels for meta-states must not reuse lifecycle vocabulary** — "planned" read as a stage; "queued" says what it is (declared, nothing more).
- **Two surfaces resolving the same data independently will disagree.** The sidebar resolved children from active plans; the detail page from active+archived (with inverted precedence). The fix converged both on one resolution rule — active+archived, active wins.

## What We'd Do Differently

- **Author lifecycle-edge rows in the original trajectory.** T11 (archived child) and T13 (second parent) were knowable at planning time — the brief literally promises "done, in flight, and queued ahead," and "done" means archived. The falsification ritual worked as designed, but a cheaper version of this plan writes those rows on day one.
- **Run the visual check against a worktree registry entry from the start** (the `dawn-wt` trick) rather than deferring it — the Phase 2 check found the Phase 3 bug; doing it earlier would have folded that work into Phase 2's design.
- **Predict the mock blast radius when adding imports to a shared component.** Adding `next/link` to `PlanDetail` broke its whole legacy test file until the stub was added — the known gotcha, still paid once.

## Insights Worth Carrying Forward

- The **degrade-to-flat-list invariant** (structure can be lost, a plan never) made every falsification fix easy to shape: each bad input drops structure silently rather than erroring. Invariants phrased as "what may be lost vs what may never" give fixes their form.
- The **oversized-changed-files check as attention-focus, not a cap** worked: two files came in under their caps after principled extraction, one (the 731-line test file) stayed over with a recorded reason — and that's a legitimate terminal state.
- **Dogfooding paid immediately**: the archived-subplan fix (T11) is exactly what this plan's own archival exercises — `dawn-ui-plan-grouping` will render as a navigable archived child in the Dawn group the moment it moves to `archive/`.
