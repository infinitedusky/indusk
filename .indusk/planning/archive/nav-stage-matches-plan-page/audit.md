---
plan: nav-stage-matches-plan-page
audited: 2026-10-16
model: claude-sonnet-5-5
---

# Audit — nav-stage-matches-plan-page

## Does each row prove its promise's sentence, or something narrower?

- apps/indusk-admin/src/lib/plan-stage.test.ts:1 — `the-nav-says-where-a-plan-is` ("the row names the step the page shows; Released only once a release shipped it; Closed once archived without one") is covered by rows A1, A2, A3, A4 and A6 (moderate confidence that all hold as worded). A1, the row asserting nav stage equals the first current/needs-you/not-yet step of `planSteps(snapshotOf(plan))`, derives its expectation from the same function `navMarkOf` calls, so it proves agreement with `planSteps`, not that the page shows that step; `PlanWorkflows` is not rendered in any row. Narrower than "the page shows".
- apps/indusk-admin/src/components/PlanList.test.tsx:1 — A2, the row asserting a built plan reads Falsify with the in-progress mark and an archived plan with no release reads Closed with the finished mark, covers one built plan and one archived plan. "Closed" for an archived plan with an unplaceable release is asserted only for a plan whose position is archived; nothing proves a plan whose release the date reader cannot place (the Out of Scope case) reads Closed rather than Released.
- apps/indusk-admin/src/lib/plan-stage.ts:34 — the brief says a plan whose position could not be read falls to its status word. No row asserts it, and it looks unreachable: with `position` null every segment reads `pending`, every step is `not-yet`, and `stepAt` returns the first step (apps/indusk-mcp/src/lib/plans/steps.ts:213-217), so `plan.status` is never reached. An archived plan with a null position would read "Research"/"Brief", not Closed. Moderate confidence; not tested either way.
- apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts:1 — A3, the row asserting `stepAt` is exported from the package's steps module and not defined in the admin, proves where the function lives. It does not prove the nav's mark rule (needs-you / working on a release step / idle on planning steps) is defined once; that rule sits in the admin's `navMarkOf` (plan-stage.ts:27-31).
- apps/indusk-admin/src/lib/master-story.test.ts:1 — A5, the row asserting a master page reads Falsify for a built plan and Released for a released one, proves `a-master-plan-tells-its-story` for those two; it passes by construction since `masterStory` calls `planStage`, which calls `navMarkOf`. Adequate for "same stage"; it says nothing about the master's own progress figures.
- apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx:1 — A6, the row asserting a released plan reads Released and each Path's released count is unchanged, proves `paths-keep-their-order` only for count; the Path count uses the `released` flag, which this plan did not touch, so the proof is real but unchanged-behaviour only.
- apps/indusk-mcp/src/lib/plans/waiting.ts:124 — `decisions-wait-in-one-place` is claimed by A4 (nav shows the waiting step first), but the diff also changed what Needs you shows (see heading 2). No row covers that change.

## What does the diff change that no row touches?

- apps/indusk-mcp/src/lib/plans/waiting.ts:124 — `askedOf` previously took the first `current`/`needs-you` step else "Planning"; it now calls `stepAt`, which falls back to the first `not-yet` step. A question asked while no step is current now names e.g. "Build" or "Falsify" instead of "Planning". No trajectory row asserts the Needs you step label before or after.
- apps/indusk-admin/src/components/PlanList.tsx:328 — the row's mark for a plan in a Planning step (Research, Brief, Test plan, Decision, Impl) is now `idle`; before, an `in-progress` impl read `working` ("Building") and an approved one `working` ("Approved"). A plan with an approved impl, not yet built, now reads Build with the `working` mark only if Build is current; at "not-yet" Build it reads `idle` is not reached (Build is a Release step, so it is `working`). Net: a plan between approval and first checkbox changes mark from working to working, but a plan in an in-progress state during Planning steps loses the working mark. No row covers the Planning-step mark.
- apps/indusk-admin/src/app/page.tsx:36 — `hasInProgress: active.some((p) => p.status === "in-progress")` still reads the impl status word on the project card. Not in the diff, not in scope text, and it has the same staleness the brief diagnoses (a built plan keeps `in-progress`/`completed` depending on `/work`); no row touches it.
- apps/indusk-admin/src/components/PlanList.falsify.test.tsx — T11 was edited from "completed" to "Closed" (a pin on the old bug, named in the impl); `master.test.tsx` and `page.test.tsx` under `app/p/[project]/plan/[name]/` also changed by one line each with no row naming them.
- .indusk/phase-boundary.jsonl — two ledger lines appended; machine state, no row.

## What does the code do that the brief never promised?

- apps/indusk-admin/src/lib/plan-stage.ts:27-31 — marks: Planning-workflow steps get `idle` and Release-workflow steps (Build, Falsify, Cleanup, Audit, Review, Release) get `working`. The brief's Goal says "in-progress on a Release-workflow step, plain otherwise"; no promise sentence says it. A plan at Review (waiting on the person, but with no `waiting` entry) shows `working`.
- apps/indusk-admin/src/lib/plan-stage.ts:19 — new exported `navMarkOf` and `NavMark` type moved out of `ui/badge-variant.ts` into `lib/plan-stage.ts`; the brief says `planStage` and the row's mark read `stepAt`, and the boundary map names `navMarkOf`, so this is planned. The deletion of `NavMark` from the shared UI module is a public-surface removal the brief only implies.
- apps/indusk-mcp/src/lib/plans/steps.ts:213 — `stepAt` returns a step with a `workflow` tag; the tag is only used by the admin. A new exported shape in the package for one consumer.
- apps/indusk-admin/src/lib/plan-stage.ts:33 — an archived plan with `stepAt` null reads Closed with the finished mark even when the plan was archived without a retrospective or a release; the brief promises Closed only "once archived without [a release]" — equivalent, but the code does not check `released` against anything other than the caller's flag.

## Which rejected ADR alternative does the code quietly take?

- nothing — there is no ADR for this plan, so there is no rejected alternative to check against.

## Which skip reason would you not accept?

- .indusk/planning/nav-stage-matches-plan-page/impl.md:1 — `falsification_reason: "All 140 archived plans read Closed; waiting, released and reopened paths traced; no failing input found."` is a claim about one run, not a hypothesis tested; the commit message says "no concrete hypothesis survived". The unreadable-position case (heading 1) and the Needs-you label change (heading 2) are two concrete hypotheses it did not try. I would not accept it.
- .indusk/planning/nav-stage-matches-plan-page/impl.md:1 — `cleanup_reason: "small and cohesive, one rule now lives once in plans/steps; nothing to extract."` Acceptable for inter-file duplication on this diff, though `apps/indusk-admin/src/app/page.tsx:36` still carries the status-word reading that the plan removed from the nav.

## What else would have to change for each promise to hold?

- apps/indusk-admin/src/app/page.tsx:36 — `the-nav-says-where-a-plan-is`: the project card's `hasInProgress` reads `p.status === "in-progress"`, the impl status word. A built plan can leave it true or false regardless of the step its page shows. Not in `stat`.
- apps/indusk-admin/src/lib/markdown-export.ts:138 — the markdown export prints `Status: ${plan.status}` for a plan; the impl status word again, shown to readers as the plan's state. Not in `stat`.
- apps/indusk-admin/src/lib/plan-stage.ts:34 — `the-nav-says-where-a-plan-is` for a plan whose position cannot be read: `stepAt` needs a "no position" answer (null) for this fallback to be reachable, or the fallback is dead code.
- apps/indusk-admin/src/components/cockpit/NavItems.tsx — other nav consumers (the Needs you list, the plan page header, the vscode extension's plan labels) show plan state from their own readers; grep found `stepAt` used only in `plan-stage.ts` and `waiting.ts`, so the vscode extension and any CLI listing that print `plan.status` are not covered by "the nav says where a plan is". Moderate confidence on the extension; I did not read it.
- apps/indusk-admin/src/lib/master-story.ts:93 — `a-master-plan-tells-its-story` holds through `planStage`; nothing else needed.
- apps/indusk-admin/src/app/p/[project]/cockpit-nav.test.tsx — `paths-keep-their-order`: holds; the released count never reads the stage words.
