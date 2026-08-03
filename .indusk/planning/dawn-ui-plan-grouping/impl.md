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
| T1 | a parent plan appears in the sidebar with its subplans shown beneath it, not in one flat list | Phase 1 | Phase 2 | written |
| T2 | subplans appear in the order their parent declares — not alphabetical, not filesystem order | Phase 1 | Phase 2 | written |
| T3 | a plan no parent claims appears at the top level, exactly as today | Phase 1 | Phase 2 | written |
| T4 | a subplan a parent names but that does not exist yet appears as a greyed placeholder | Phase 1 | Phase 2 | written |
| T5 | clicking a subplan opens that plan's page, the same as any other plan | Phase 1 | Phase 2 | written |
| T6 | when a parent's declaration is missing, corrupt, or has no subplan list, every plan on disk still appears — the sidebar falls back to the flat list | Phase 1 | Phase 1 | written |
| T7 | a plan that exists on disk but is named by no declaration is never hidden — every planning folder is accounted for | Phase 1 | Phase 1 | written |
| T8 | declaring a plan as a parent when it owns no subplans leaves it displayed as an ordinary plan, not an empty group | Phase 1 | Phase 1 | written |
| T9 | the plan list the CLI and MCP report is unchanged by this feature — grouping is display-only | Phase 1 | Phase 1 | written |

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

- [ ] Build the grouped tree in `apps/indusk-admin/src/lib/planning-reader.ts`: given the declarations plus `readActivePlans`, return parents with their ordered children, placeholder entries for declared-but-absent subplans, and every remaining plan at top level in `roadmap:` order (unlisted plans after, current ordering preserved).
- [ ] Render it in `apps/indusk-admin/src/app/p/[project]/layout.tsx`: parent as a group header, children indented in declared order, placeholders greyed and non-navigable, unparented plans unchanged.
- [ ] Verify a plan declared as a parent but owning no subplans renders as an ordinary plan (T8's rendering half).

#### Phase 2 Verification
- [ ] T1–T5 flip to green: `pnpm vitest run` in `apps/indusk-admin` — nesting, declared order, unparented plans unchanged, placeholders rendered, subplan navigation intact.
- [ ] T6–T9 still green (no regression from the rendering work): `pnpm test` across both apps.
- [ ] Visual check: `indusk ui` shows `indusk-v2-dawn` as a group with its subplans beneath in declared order, four of them greyed as not-yet-created.

#### Phase 2 Context
- [ ] Update CLAUDE.md's admin-UI Known Gotchas line with the grouping behaviour: the sidebar tree is derived entirely from declarations, so a plan that appears at top level unexpectedly means no parent claims it — not a bug in the reader.

#### Phase 2 Document
- [ ] Update `apps/docs/src/reference/admin-ui/overview.md` with the grouped sidebar: what a parent group looks like, what a greyed placeholder means, and the fallback behaviour when declarations are missing.

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
