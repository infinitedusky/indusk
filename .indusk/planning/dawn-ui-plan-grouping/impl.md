---
title: "Dawn UI — Plan Grouping — Implementation"
date: 2026-08-02
status: in-progress
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
| T11 | a subplan whose folder lives in `archive/` renders as a navigable item with its real status — in both the sidebar group and the parent detail cards — never as a "queued" placeholder | Phase 0 | Phase 4 | written |
| T12 | a parent plan that also carries standard documents (e.g. a brief) still renders those documents alongside its subplan cards — the parent branch adds, it never suppresses | Phase 0 | Phase 4 | written |
| T13 | with two or more parents, sidebar groups follow the roadmap's declared order, not parser iteration order | Phase 0 | Phase 4 | written |
| T14 | a declared name that is not a single clean path segment (`/`, `\`, or `..`) is ignored everywhere — it reaches neither a filesystem path join nor the rendered sidebar | Phase 0 | Phase 4 | written |
| T15 | a name declared twice in one `subplans:` list renders once (first occurrence) — no duplicate sidebar items, no duplicate React keys | Phase 0 | Phase 4 | written |

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

- [ ] Resolve group children against active + archived plans (layout passes both into `buildGroups`; active wins on name collision — also fix the `[...active, ...archived]` Map precedence in `plan/[name]/page.tsx`). An archived child renders as a navigable item with its real status in both surfaces; it may also remain in the Archived collapsible.
- [ ] Make the parent branch in `PlanDetail` additive: master prose + subplan cards first, then whatever standard document sections the plan actually carries. Only a doc-less parent renders cards alone.
- [ ] Order sidebar groups by roadmap position; parents not in the roadmap follow after, in declaration order.
- [ ] Guard declaration names at the parser boundary: `readPlanDeclarations` drops names that aren't single clean path segments (no `/`, `\`, or `..` — mirror `readResearchContent`'s guard) and dedupes each list to first occurrence. Degrade silently to structure-loss, never a path join or raw render.

#### Phase 4 Verification
- [ ] T11: sidebar group + detail cards render an archived subplan as navigable-with-status (red today: sidebar shows a `queued` placeholder; detail already resolves it — assert both surfaces agree)
- [ ] T12: a parent with a brief renders the brief section alongside its cards (red today: `!isParent` suppresses it)
- [ ] T13: two parents whose roadmap order differs from parser order render groups in roadmap order (red today: parser order wins)
- [ ] T14: `parents: ["../outside"]` never causes a read outside the planning dir and never renders (red today: the join happens)
- [ ] T15: a `subplans:` list naming the same child twice renders one child item (red today: two, with a duplicate-key warning)

#### Phase 4 Context
- [ ] Extend CLAUDE.md's plan-hierarchy convention line: declaration names are boundary values — segment-guarded and deduped in `readPlanDeclarations`; archived children resolve as real items, not placeholders.

#### Phase 4 Document
- [ ] Update `/reference/cli/plans` (declaration hygiene: non-segment names and duplicates are ignored) and `/reference/admin-ui/overview` (archived subplans render with their real status; parents with documents show both cards and sections).
