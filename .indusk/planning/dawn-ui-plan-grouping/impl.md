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
| T1 | a parent plan appears in the sidebar with its subplans shown beneath it, not in one flat list | Phase 1 | Phase 2 | planned |
| T2 | subplans appear in the order their parent declares — not alphabetical, not filesystem order | Phase 1 | Phase 2 | planned |
| T3 | a plan no parent claims appears at the top level, exactly as today | Phase 1 | Phase 2 | planned |
| T4 | a subplan a parent names but that does not exist yet appears as a greyed placeholder | Phase 1 | Phase 2 | planned |
| T5 | clicking a subplan opens that plan's page, the same as any other plan | Phase 1 | Phase 2 | planned |
| T6 | when a parent's declaration is missing, corrupt, or has no subplan list, every plan on disk still appears — the sidebar falls back to the flat list | Phase 1 | Phase 1 | planned |
| T7 | a plan that exists on disk but is named by no declaration is never hidden — every planning folder is accounted for | Phase 1 | Phase 1 | planned |
| T8 | declaring a plan as a parent when it owns no subplans leaves it displayed as an ordinary plan, not an empty group | Phase 1 | Phase 1 | planned |
| T9 | the plan list the CLI and MCP report is unchanged by this feature — grouping is display-only | Phase 1 | Phase 1 | planned |

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

- [ ] Worktree kickoff: create/confirm this plan's worktree (`indusk worktree create dawn-ui-plan-grouping`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter.
- [ ] Author T1–T9 red (test-first). Reader/parser tests in `apps/indusk-mcp/src/lib/__tests__/`; sidebar tests in `apps/indusk-admin/src/`. Fixtures are plain temp directories — a parent with subplans, a parent with a corrupt master, a parent with no subplan list, and an unparented plan. Confirm each fails for its intended reason before implementing.
- [ ] Add `readPlanDeclarations(planningDir)` to `apps/indusk-mcp/src/lib/plan-parser.ts` (or a sibling module it re-exports): reads the root `master.md` frontmatter for `parents: string[]` and `roadmap: string[]`, and a named plan's own `master.md` for `subplans: string[]`.
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
  Every field defaults to empty on a missing file, absent key, or malformed YAML — **never throws, never drops a plan** (T6). Follow the existing `parsePlan` precedent: malformed frontmatter is reported, not fatal.
- [ ] Export it for the admin app through the package's subpath exports, alongside the existing parser exports — the admin must consume this, never re-read frontmatter itself.
- [ ] Apply the frontmatter to the real files: `parents:` + `roadmap:` on `.indusk/planning/master.md`, and `subplans:` on `.indusk/planning/indusk-v2-dawn/master.md` listing this plan, `dawn-external-orchestrator`, and the not-yet-created `dawn-hook-parity` / `dawn-verify` / `dawn-agents` / `dawn-linear`.
- [ ] Retire the prose-scraping path in `readMasterPlanOrder` (`apps/indusk-admin/src/lib/planning-reader.ts`) in favour of the declaration reader — its link regex matches nothing against the Dawn master today, so this removes a silent-failure surface rather than replacing working code.

#### Phase 1 Verification
- [ ] T6, T7, T8, T9 green: `pnpm vitest run` in `apps/indusk-mcp` — corrupt/missing/empty declarations all fall back safely, every folder is still accounted for, and the existing plan-list output is unchanged.
- [ ] T1–T5 authored and red, each failing for its stated reason (not a fixture or import error). Capture the failure output.
- [ ] `pnpm exec tsc --noEmit` and `pnpm exec biome check` clean in `apps/indusk-mcp`.

#### Phase 1 Context
- [ ] Add to CLAUDE.md Conventions: plan hierarchy is declared top-down only — the root `master.md` frontmatter names `parents:` and the `roadmap:` order, each parent's own `master.md` names its ordered `subplans:`, children declare nothing, and the plan inventory always comes from disk rather than any list. One rule + pointer, per the context budget.

#### Phase 1 Document
- [ ] Document the declaration convention in `apps/docs/src/reference/cli/plans.md` — the frontmatter keys, the top-down rule, and the never-hides-a-plan fallback. It sits with the other planning-directory reference material.

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
