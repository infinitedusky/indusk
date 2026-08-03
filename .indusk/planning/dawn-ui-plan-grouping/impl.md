---
title: "Dawn UI — Plan Grouping — Implementation"
date: 2026-08-02
status: completed
trajectory: required
rationale: required
gate_policy: ask
---

# Dawn UI — Plan Grouping — Implementation

## Goal

Make the plan hierarchy visible. Parent plans declare their children top-down (`parents:` + `roadmap:` in the root master, `subplans:` in each parent's own master); the shared parser exposes those declarations; the admin sidebar renders parents as groups with ordered children, including greyed placeholders for subplans declared but not yet created. Builds the direction in [brief.md](brief.md) against the assertions in [test-plan.md](test-plan.md).

The invariant that outranks the feature: **grouping never hides a plan.** Any missing, corrupt, or contradictory declaration degrades to today's flat list.

## Scope

### In Scope
- Reading `parents:` / `roadmap:` / `subplans:` frontmatter through the shared parser.
- Admin reader consuming those declarations to build a grouped, ordered structure.
- Sidebar rendering: parent groups, ordered children, placeholders, unparented plans unchanged.
- Applying the frontmatter to the two real files (root master, Dawn master).

### Out of Scope
- Dates on roadmap entries; rebranding; nesting past one level; editing plans from the UI; rewriting the root master's stale prose; any database or Linear mapping. (Full rationale in the brief.)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `readPlanDeclarations()` in the shared parser (parents / roadmap / subplans, with safe fallbacks); subpath export; frontmatter applied to the two real master files | `plan-parser.ts`, `gray-matter`, the planning directory |
| Phase 2 | Grouped plan tree in the admin reader; sidebar rendering with groups, order, and placeholders | Phase 1's declarations + `readActivePlans` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a parent plan appears in the sidebar with its subplans shown beneath it, not in one flat list | Phase 1 | Phase 2 | passing |
| T2 | subplans appear in the order their parent declares — not alphabetical, not filesystem order | Phase 1 | Phase 2 | passing |
| T3 | a plan no parent claims appears at the top level, exactly as today | Phase 1 | Phase 2 | passing |
| T4 | a subplan a parent names but that does not exist yet appears as a greyed placeholder | Phase 1 | Phase 2 | passing |
| T5 | clicking a subplan opens that plan's page, the same as any other plan | Phase 1 | Phase 2 | passing |
| T6 | when a parent's declaration is missing, corrupt, or has no subplan list, every plan on disk still appears — the sidebar falls back to the flat list | Phase 1 | Phase 1 | passing |
| T7 | a plan that exists on disk but is named by no declaration is never hidden — every planning folder is accounted for | Phase 1 | Phase 1 | passing |
| T8 | declaring a plan as a parent when it owns no subplans leaves it displayed as an ordinary plan, not an empty group | Phase 1 | Phase 1 | passing |
| T9 | the plan list the CLI and MCP report is unchanged by this feature — grouping is display-only | Phase 1 | Phase 1 | passing |
| T10 | opening a parent plan shows its subplans as cards with their status, instead of an empty page | Phase 3 | Phase 3 | passing |
| T11 | a subplan whose folder lives in `archive/` renders as a navigable item with its real status — in both the sidebar group and the parent detail cards — never as a "queued" placeholder | Phase 0 | Phase 4 | passing |
| T12 | a parent plan that also carries standard documents (e.g. a brief) still renders those documents alongside its subplan cards — the parent branch adds, it never suppresses | Phase 0 | Phase 4 | passing |
| T13 | with two or more parents, sidebar groups follow the roadmap's declared order, not parser iteration order | Phase 0 | Phase 4 | passing |
| T14 | a declared name that is not a single clean path segment (`/`, `\`, or `..`) is ignored everywhere — it reaches neither a filesystem path join nor the rendered sidebar | Phase 0 | Phase 4 | passing |
| T15 | a name declared twice in one `subplans:` list renders once (first occurrence) — no duplicate sidebar items, no duplicate React keys | Phase 0 | Phase 4 | passing |
| T16 | the cleanup decomposition is behavior-parity — every existing suite passes with zero assertion or testid changes after the extractions | Phase 5 | Phase 5 | passing |

### Trajectory Rationale

Every row is authorable against the current stack — the sidebar and the reader both exist today — so all nine are authored red at Phase 1's start, before any implementation lands. T1–T5 stay red through Phase 1 as live tripwires: any of them turning green before the rendering work exists would signal that grouping leaked into the wrong layer.

- **T1** `Writable at: Phase 1` — Sidebar renders today; a nesting assertion fails red against the current flat list.
- **T2** `Writable at: Phase 1` — Order assertion is authorable against today's render, which has no declared order to honour.
- **T3** `Writable at: Phase 1` — Asserts current behaviour is preserved; green from birth and must stay green through both phases.
- **T4** `Writable at: Phase 1` — Placeholder assertion fails red today because a declared-but-uncreated plan renders nothing at all.
- **T5** `Writable at: Phase 1` — Navigation to a plan page works today; the assertion is that grouping does not break it.
- **T6** `Writable at: Phase 1` — A corrupt-declaration fixture is authorable now; today the declaration is simply ignored, which is the fallback being pinned.
- **T7** `Writable at: Phase 1` — Reader returns every folder today; the assertion pins that against the change about to be made.
- **T8** `Writable at: Phase 1` — An empty-parent fixture is authorable now.
- **T9** `Writable at: Phase 1` — Regression guard over the shared parser's existing output; green from birth, and its whole job is to stay green.
- **T10** `Writable at: Phase 3` — The card component does not exist until Phase 3; a test asserting on it cannot be authored against today's `PlanDetail`, which renders nothing for a doc-less plan.
- **T16** `Writable at: Phase 5` — A parity check over the decomposition can only run once the extractions exist; its whole claim is that Phase 5 is structure-preserving (suites green, no assertion or testid edits), which is unverifiable before the phase.

## Checklist

### Phase 1: Declarations in the shared parser

- [x] Worktree kickoff: created at `~/code/sandbox/dusk-worktrees/dawn-ui-plan-grouping` on branch `plan/dawn-ui-plan-grouping` (matching the existing worktree convention); `pnpm install` run, since a fresh worktree has no `node_modules`.
- [x] Author T1–T9 red (test-first). `apps/indusk-mcp/src/lib/__tests__/plan-declarations.test.ts` (T6–T9, temp-dir fixtures: corrupt master, no-subplans key, empty parent, undeclared plan) and `apps/indusk-admin/src/components/PlanList.grouping.test.tsx` (T1–T5). Red verified for the intended reason: mcp fails `readPlanDeclarations is not a function`; admin fails "expected a group element…: expected null not to be null". T3/T5 and the parseAllPlans-only cases are green from birth by design — they assert current behaviour is preserved. **Correction during authoring:** the first draft of the admin tests used `screen.getByTestId`, which this repo's browser setup doesn't expose — they failed on the wrong thing (`getByTestId is not a function`) rather than on missing grouping. Rewrote to the repo's `const { container } = await render(...)` + `querySelector` convention so the red is real.
- [x] Add `readPlanDeclarations(planningDir)` to `apps/indusk-mcp/src/lib/plan-parser.ts` (or a sibling module it re-exports): reads the root `master.md` frontmatter for `parents: string[]` and `roadmap: string[]`, and a named plan's own `master.md` for `subplans: string[]`.
  ```typescript
  export interface PlanDeclarations {
    /** Folder names declared as parent plans in the root master. */
    parents: string[];
    /** Top-level display order from the root master. Unlisted plans follow. */
    roadmap: string[];
    /** Parent folder name → its declared, ordered subplan names. */
    subplans: Record<string, string[]>;
  }
  ```
  Every field defaults to empty on a missing file, absent key, or malformed YAML — **never throws, never drops a plan** (T6). Follow the existing `parsePlan` precedent: malformed frontmatter is reported, not fatal. Implemented with `stringArray()` (non-array or non-string entries yield `[]`) and `readMasterFrontmatter()` (absent/unreadable → `null`); parent candidates are the union of `parents:` and any folder carrying a `master.md`, so a stale root entry can't suppress a real declaration.
- [x] Export it for the admin app through the package's subpath exports, alongside the existing parser exports — the admin must consume this, never re-read frontmatter itself. Added `"./planning/plan-parser"` → `dist/lib/plan-parser.{d.ts,js}`.
- [x] Apply the frontmatter to the real files: `parents:` + `roadmap:` on `.indusk/planning/master.md`, and `subplans:` on `.indusk/planning/indusk-v2-dawn/master.md`. Verified against the built lib — parents `[indusk-v2-dawn]`, 14-entry roadmap, 7 Dawn subplans. **The `roadmap:` list preserves the exact order the retired link-regex derived**, so replacing it doesn't silently reshuffle the sidebar. Note `dawn-external-orchestrator` has no folder on `main` (it lives on its own branch), making it a live placeholder case for T4.
- [x] Retire the prose-scraping path in `readMasterPlanOrder` in favour of the declaration reader. `readPlanHierarchy()` now delegates to the shared `readPlanDeclarations`, and `readMasterPlanOrder` returns its `roadmap`, so the admin consumes the parser rather than re-reading frontmatter. The link regex is gone — a silent-failure surface removed.

#### Phase 1 Verification
- [x] T6, T7, T8, T9 green: `pnpm vitest run src/lib/` in `apps/indusk-mcp` → 7/7 in `plan-declarations.test.ts`; suite 431 passed. The only 2 failures are `daemon-identity` (PID/port daemon tests), **verified pre-existing via `git stash`** — identical on the unmodified baseline, untouched by this change.
- [x] T1–T5 authored and red for their stated reasons: T1 `expected a group element for the parent plan: expected null not to be null`, T2 `grouping child missing: expected -1 to be greater than -1`, T4 `expected a placeholder for the uncreated subplan: expected null not to be null`. T3 and T5 pass — green from birth, exactly as the rationale predicted, since they assert current behaviour is *preserved*. They also fail `tsc` in `apps/indusk-admin` (the `grouping` prop lands in Phase 2) — expected red at the type level too, confined to the new test file.
- [x] `pnpm exec tsc --noEmit` exit 0 and `biome check` clean in `apps/indusk-mcp` (two files auto-formatted).

#### Phase 1 Context
- [x] Add to CLAUDE.md Conventions: plan hierarchy is declared top-down only — the root `master.md` frontmatter names `parents:` and the `roadmap:` order, each parent's own `master.md` names its ordered `subplans:`, children declare nothing, and the plan inventory always comes from disk rather than any list. One rule + pointer, per the context budget.

#### Phase 1 Document
- [x] Document the declaration convention in `apps/docs/src/reference/cli/plans.md` — the frontmatter keys, the top-down rule, and the never-hides-a-plan fallback. It sits with the other planning-directory reference material.

### Phase 2: Grouped sidebar

- [x] Build the grouped tree. **Deviation from the plan, deliberate:** the grouping lives in `PlanList.tsx` (`buildGroups`) rather than `planning-reader.ts`. The reader stays a pure data layer exposing declarations (`readPlanHierarchy`); grouping is a display concern, and T1–T5 exercise the component directly. `buildGroups` guarantees every plan passed in comes back out — inside a group or in `rest`.
- [x] Render it: `layout.tsx` reads `readPlanHierarchy` and passes `grouping` to `PlanList`; `PlanGroupSection` renders the parent with children indented behind a left border, placeholders greyed with a `planned` badge and no link, unparented plans untouched.
- [x] Verify a parent owning no subplans renders as an ordinary plan — `buildGroups` skips any parent whose declared list is empty or resolves to nothing, so it falls through to `rest` and renders as a normal item.

#### Phase 2 Verification
- [x] T1–T5 green: `pnpm vitest run --project browser src/components/PlanList.grouping.test.tsx` → 5 passed.
- [x] T6–T9 still green (7/7 in `plan-declarations.test.ts`); admin suite 134 passed. **Two real regressions found and fixed here, both caused by retiring the link-scraping in Phase 1:** (1) `planning-reader.test.ts` pinned the old regex — migrated the fixture to `roadmap:` frontmatter and rewrote the one test that asserted link-shaped parsing; (2) `page.test.tsx` mocks `planning-reader` and the mock lacked the layout's new `readPlanHierarchy` import — added it. Remaining 3 failures are `http-*` tests that spawn `next dev`; two fail on the stashed baseline, and `http-smoke` passes 4/4 in isolation — CPU contention, exactly what the vitest config's `fileParallelism: false` comment warns about.
- [x] Visual check: verified via `next dev` against this worktree (registry project `dawn-wt`) — `indusk-v2-dawn` renders as a group with `dawn-ui-plan-grouping` navigable beneath it and **six** greyed `planned` placeholders in declared order (`dawn-external-orchestrator`, `dawn-hook-parity`, `dawn-verify`, `dawn-agents`, `dawn-linear`, `dawn-cloud`) — six, not the four this item predicted, because the Dawn master restructure added `dawn-cloud` and `dawn-external-orchestrator`'s folder lives only on its own branch. Roadmap-ordered Active list + Unordered group unchanged below. Screenshot: `p2-visual-check-sidebar.png` (session artifact). Parent detail page confirmed still blank + stray Falsification heading — the Phase 3 target.

#### Phase 2 Context
- [x] Updated CLAUDE.md's admin-UI Known Gotchas: the sidebar tree is derived entirely from declarations (top-level = unclaimed, not a reader bug), grouping lives in `PlanList.buildGroups` not the reader, and a browser test mocking `planning-reader` must include every export the layout imports — the failure mode that cost a debug cycle here.

#### Phase 2 Document
- [x] Updated `/reference/admin-ui/overview` with the grouped sidebar: parent groups, greyed `planned` placeholders for uncreated subplans, top-level-means-unclaimed, and degrade-to-flat-list on broken declarations.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plan-parser.ts` | Add `readPlanDeclarations` + `PlanDeclarations` |
| `apps/indusk-mcp/package.json` | Subpath export for the declarations reader (if not already covered) |
| `apps/indusk-admin/src/lib/planning-reader.ts` | Consume declarations; build grouped tree; retire prose-scraping |
| `apps/indusk-admin/src/app/p/[project]/layout.tsx` | Render groups, ordered children, placeholders |
| `.indusk/planning/master.md` | Add `parents:` + `roadmap:` frontmatter |
| `.indusk/planning/indusk-v2-dawn/master.md` | Add `subplans:` frontmatter |
| `apps/docs/src/reference/cli/plans.md` | Document the declaration convention |
| `apps/docs/src/reference/admin-ui/overview.md` | Document the grouped sidebar |
| `CLAUDE.md` | Conventions entry (Phase 1); admin-UI gotcha (Phase 2) |

## Dependencies

- None. Component 0 of the [Dawn master plan](../indusk-v2-dawn/master.md).

## Notes

- `readMasterPlanOrder`'s regex only matches `[name](name/doc.md)` and therefore matches nothing against the Dawn master, whose links carry a `../` prefix. Phase 1 removes it rather than fixing it — the replacement reads frontmatter, which fails loudly instead of silently.
- The admin app must never duplicate frontmatter parsing; it consumes InDusk parsers through workspace subpath exports.
- One level of nesting only. If a subplan ever needs children of its own, that is a new plan with its own decision, not an extension smuggled in here.

### Phase 3: Parent plan detail — subplan cards

**Discovered during the Phase 2 visual check.** Making parents first-class in the sidebar left them unrenderable in the detail view: a parent carries `master.md` / `maxims.md` / `positioning.md`, none of which are in `DOC_FILES`, so every section resolves to undefined. `PlanDetail.tsx:107` (`{!plan.impl && <FalsificationSection …>}`) then renders unconditionally, producing the blank page with a stray "Falsification" heading. Rendering a parent is the completion of the feature, not an addition to it.

- [x] Detect a parent plan in `PlanDetail` — it has declared subplans — and render a card per subplan (name, status badge, stage) linking to that plan, instead of the standard document sections. Detection is a `subplans?: SubplanEntry[]` prop resolved by the page (`plan/[name]/page.tsx` reads `readPlanHierarchy` and maps declared names against active+archived plans) — the component stays data-source-agnostic, same layering as the sidebar. Stage derives from the furthest lifecycle document the child carries (`planStage`).
- [x] Render a placeholder card, visually distinct and non-navigable, for declared subplans with no folder yet — same semantics as the sidebar. Dashed border + greyed text + `planned` badge, no link; `data-testid="subplan-placeholder-{name}"`.
- [x] Guard the doc-less path: sections whose documents are all absent must not render (fixes the stray Falsification heading at `PlanDetail.tsx:107`). `hasAnyDocument` gates the falsification empty-state; a doc-less plan renders header-only. **Deliberate test change:** `PlanDetail.test.tsx`'s old T14 pinned the buggy behaviour ("still renders falsification empty state") — rewritten to assert header-only, with a comment recording why. Also added the `next/link` vi.mock stub to `PlanDetail.test.tsx` (PlanDetail now imports next/link for cards — the known browser-test gotcha).
- [x] Surface the parent's own prose — `master.md` — above the cards via the existing `<Markdown>` wrapper, so the sequence and its reasoning are on one page. New reader export `readPlanMasterContent(projectRoot, planName)` (reuses `readDoc`; absent/malformed → null → prose simply omitted, cards unaffected); page passes it only for parents.
- [x] (discovered, user feedback during P3) Placeholder badge relabelled `planned` → `queued` in both surfaces (sidebar + detail cards). "planned" collided with the plan-lifecycle/trajectory vocabulary and implied a stage the name hasn't reached — these entries are declared-but-uncreated, i.e. work queued ahead (the brief's own phrasing). No test asserted the badge text.

#### Phase 3 Verification
- [x] T10 green: `pnpm vitest run --project browser src/components/PlanDetail.parent.test.tsx` → 4/4 (card with status+stage+link, placeholder card, prose-above-cards, no stray Falsification). Live check on `/p/dawn-wt/plan/indusk-v2-dawn`: full Dawn master prose, `dawn-ui-plan-grouping` card (in-progress/impl), six `queued` placeholders, no empty sections — screenshot `p3-parent-detail-subplan-cards.png`. Full suites: admin 141/141 (earlier 15 http failures were the leftover dev server holding port 3000 — retested clean after killing it); mcp 783 passed with 3 pre-existing failures (`agent-roles-phase4` fails identically on unmodified main — makeover CLAUDE.md compaction, cross-plan finding; the `daemon-identity` PID-reuse pair documented pre-existing in Phase 1). The daemon-test failures initially looked like 12 — root cause was the worktree lacking the gitignored admin production bundle; `pnpm build` + `bundle-admin.js` reproduced trunk's environment and they pass. `tsc --noEmit` exit 0, `biome check` clean in both apps; `next build` succeeds with the new page code.

#### Phase 3 Context
- [x] Record in CLAUDE.md's admin-UI gotcha that a plan whose documents fall outside `DOC_FILES` (a parent carrying only `master.md`) renders empty unless the detail view has a branch for it. Appended to the existing declarations gotcha line rather than a new bullet (budget discipline).

#### Phase 3 Document
- [x] Update `/reference/admin-ui/overview` with the parent plan detail view: subplan cards, placeholder cards, and the parent's own prose. Also fixed the grouped-sidebar section's badge wording (`planned` → `queued`) to match the rename, with a note on why `queued` isn't a lifecycle stage.

### Phase 4: Falsification — declaration edges the happy path never exercised

**Goal**: verify whether the attested state holds against the lifecycle and hygiene edges the T1–T10 fixtures never touch: subplans that have been archived, parents that grow standard documents, more than one parent, and declaration names treated as trusted path segments. Each trajectory row (T11–T15) captures one hypothesis about what's broken today; each checklist item is the fix the code needs when the hypothesis confirms.

Investigation notes (what was found, ritual 2026-08-03):
- `layout.tsx` resolves groups from `active` only, while `plan/[name]/page.tsx` resolves cards from `[...active, ...archived]` — an archived subplan is a `queued` placeholder in the sidebar and a real card in the detail view, and the spread order makes archived win a name collision, inverting the page's own `active.find ?? archived.find` precedence (T11).
- Every standard section in `PlanDetail` is gated `!isParent` — a parent carrying a brief/impl silently hides them (T12).
- `buildGroups` iterates `Object.keys(subplans)` = the parser's candidate-`Set` insertion order (`parents:` order, then readdir order), not roadmap order (T13).
- `plan-parser.ts` `readPlanDeclarations` joins declared parent names into `join(planningDir, parent, "master.md")` unsanitized — `parents: ["../../../x"]` reads a `master.md` outside the planning dir and renders its `subplans:` strings; the repo convention (sanitize at the boundary, `readResearchContent` precedent) is not applied to declarations (T14). `stringArray` also passes duplicates through, double-rendering a child with duplicate React keys (T15).

- [x] Resolve group children against active + archived plans (active wins on name collision — the `[...archived, ...active]` spread order is the fix in both `buildGroups` and `plan/[name]/page.tsx`). An archived child renders as a navigable item with its real status in both surfaces; it remains in the Archived collapsible; `rest` stays active-only.
- [x] Make the parent branch in `PlanDetail` additive: master prose + subplan cards first, then whatever standard document sections the plan actually carries. Only a doc-less parent renders cards alone. All `!isParent` gates removed; sections gate on document presence alone (the falsification empty-state keeps its `hasAnyDocument` guard from Phase 3).
- [x] Order sidebar groups by roadmap position; parents not in the roadmap follow after, in declaration order (stable sort by roadmap index in `buildGroups`).
- [x] Guard declaration names at the parser boundary: `isCleanSegment` + dedupe inside `stringArray`, so all three lists (`parents`, `roadmap`, `subplans`) are filtered before any join or render. Degrade silently to structure-loss, never a path join or raw render.

#### Phase 4 Verification
- [x] T11: green — `PlanList.falsify.test.tsx` (archived child renders as link with `completed` badge, no placeholder) + `plan/[name]/page.test.tsx` (name collision resolves the active copy; red output before the fix showed `twincompletedno documents yet`, the archived copy winning verbatim).
- [x] T12: green — parent with a brief renders `brief-section` alongside `subplan-cards` (`PlanDetail.parent.test.tsx`); full PlanDetail suite 33/33.
- [x] T13: green — groups render `[plan-group-parent-a, plan-group-parent-b]` per roadmap despite subplans-object order b-first.
- [x] T14: green — traversal parent name dropped (`parents: []`, no subplans key, `leaked-plan` never read); non-segment subplan names filtered.
- [x] T15: green — `[twin, other, twin]` → `[twin, other]`. All five red-first, confirmed against the pre-fix code. Suites: admin 145/145 (`tsc` + `biome` clean), mcp 786 passed with the same 3 pre-existing failures as the Phase 3 baseline (`agent-roles-phase4`, the `daemon-identity` PID-reuse pair) — zero new. mcp dist rebuilt so the admin consumes the guarded parser.

#### Phase 4 Context
- [x] Extend CLAUDE.md's plan-hierarchy convention line: declaration names are boundary values — segment-guarded and deduped in `readPlanDeclarations`; archived children resolve as real items, not placeholders.

#### Phase 4 Document
- [x] Update `/reference/cli/plans` (new "Name hygiene" section: segment guard + first-occurrence dedupe; archived-subplan note under placeholders) and `/reference/admin-ui/overview` (three falsification-pass behaviours in the sidebar section; parent detail view reworded as additive).

### Phase 5: Cleanup — decompose the two 400-cap-busting admin files this plan grew

**Goal**: decompose what this plan grew per cohesive-module extraction (the enabled domain extensions are typescript + testing — no react/nextjs extension, so the idiom is module/function extraction, not framework-specific splitting). Flagged by `listOversizedChangedFiles` vs `main`: `PlanDetail.tsx` 704/400, `PlanDetail.test.tsx` 803/400, `planning-reader.ts` 465/400. Each item is a concrete extraction or a reasoned leave-as-is; T16 pins the whole phase as behavior-parity.

- [x] Extract the parent-detail unit — `ParentPlanView`, `SubplanCard`, `SubplanPlaceholderCard`, `planStage`, and the `SubplanEntry` type — from `PlanDetail.tsx` into `apps/indusk-admin/src/components/ParentPlanView.tsx`. This is the cohesive unit Phase 3 added to a file already past its cap; `PlanDetail` and `plan/[name]/page.tsx` import from the new file. Verbatim move; `next/link` import left PlanDetail with it.
- [x] Extract the falsification renderers — `FalsificationSection`, `FalsificationPhaseSection`, `HypothesisItem`, `isHypothesis`, `isTerminator`, `outcomeToBadge` — from `PlanDetail.tsx` into `apps/indusk-admin/src/components/FalsificationSection.tsx`, and move their describe blocks from `PlanDetail.test.tsx` into a new `FalsificationSection.test.tsx` (tests follow the unit; this also relieves the 803-line test file). Moved the "falsification section (T10)" describe (assertions verbatim, still exercising through PlanDetail); the T26/T27/T28 phase-splitting describes stayed — they test PlanDetail's orchestration, not the section. Combined suite count unchanged (33 before and after).
- [x] Extract the duplicated badge maps — `statusToBadge` (verbatim-identical in `PlanList.tsx` and `PlanDetail.tsx`) plus `stateToBadge` — into `apps/indusk-admin/src/components/ui/badge-variant.ts`; both components import the single source. **Done first (out of authored order, dependency reason):** `ParentPlanView.tsx` needs `statusToBadge`, and extracting it before the parent-view move avoids creating a third copy.
- [x] Extract the research-directory reader — `ResearchEntry`, `readProjectResearch`, `readResearchContent`, `readFirstH1` — from `planning-reader.ts` into `apps/indusk-admin/src/lib/research-reader.ts` (the section is already boundary-commented and shares nothing with plan parsing). Importers updated: `layout.tsx`, `research/[slug]/page.tsx`, and `page.test.tsx`'s mock split into a second `vi.mock("@/lib/research-reader")` per the every-export gotcha.
- [x] (reviewed the `vi.mock("next/link")` block repeated in 10 test files — left as-is: vitest hoists mock factories per-file by design, and the repo's convention is an inline copy with a comment pointing at `PlanList.test.tsx` as canonical; extracting through an async factory helper would add indirection exactly where debugging needs explicitness)
- [x] (reviewed `PlanList.tsx` (~300 LOC, under cap) — left as-is: `buildGroups` + the group/item renderers are one cohesive sidebar concern; `plan/[name]/page.tsx` — thin route wrapper by design; `plan-parser.ts` — under cap, the declarations section is cohesive with the rest of the parser)

#### Phase 5 Verification
- [x] T16: behavior parity — admin 145/145 across 24 files (same test count, one more file from the falsification-test split; zero assertion/testid changes — the only test-file edits are the moved describe and the split `research-reader` mock), mcp 786 passed with the identical 3 pre-existing failures, `tsc --noEmit` exit 0 + `biome check` clean in both apps (4 import-style nits from the moves auto-fixed). Flagged files after: `PlanDetail.tsx` 704→345, `planning-reader.ts` 465→378 (both under cap); `PlanDetail.test.tsx` 803→731 — still over cap, accepted: the phase's decision was tests-follow-the-unit, not mechanical splitting.

#### Phase 5 Context
- [x] Update CLAUDE.md's admin-UI gotcha line with the post-decomposition structure: parent-detail cards live in `ParentPlanView.tsx`, falsification renderers in `FalsificationSection.tsx`, badge maps in `ui/badge-variant.ts`, research reading in `lib/research-reader.ts`.

#### Phase 5 Document
- [x] Update `/reference/admin-ui/component-conventions`: the "Data layer" section notes the `planning-reader` / `research-reader` split (and the mock-the-right-module corollary), and the primitives section gains `badge-variant.ts` as the shared status/state→variant map.
