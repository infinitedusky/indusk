---
title: "Dawn UI — Plan Grouping"
date: 2026-08-02
status: accepted
---

# Dawn UI — Plan Grouping — Brief

## Problem

The admin UI renders every plan as a flat, undifferentiated list. That was fine when plans were peers, but plans now come in families: [indusk-v2-dawn](../indusk-v2-dawn/master.md) is a **parent plan** that owns eight components, each becoming its own plan folder. In a flat list, `dawn-external-orchestrator`, `dawn-hook-parity`, and `dawn-verify` look like three unrelated plans, with no sign that they belong to one effort or sit in a deliberate order.

This isn't cosmetic. The failure it produces cost a full session: with no visible parent-and-order structure, "where are we" gets reconstructed from memory each time, and the reconstruction drifts. The master plan documents now record the sequence; the UI should show it.

## Proposed Direction

**Parents declare their children. Declaration flows top-down only, at both levels.**

1. **Root `master.md` declares which folders are parent plans, and the top-level order.** Frontmatter carries `parents:` (the subset of folders that own subplans) and `roadmap:` (the ordered top-level sequence).
2. **Each parent plan carries its own `master.md`** whose frontmatter holds `subplans:` — an ordered list of its children. Order is explicit and arbitrary, decoupled from names.
3. **Subplans are ordinary plans.** A child folder is structurally identical to any other plan and declares nothing about its lineage.
4. **The sidebar renders the resulting tree** — parents as group headers with their subplans nested in declared order; everything else at top level as today.

Three properties this buys:

- **Single source of truth per relationship.** Only one place declares each parent→child link, so the two sides can never disagree and there is no drift to reconcile.
- **Membership comes from disk, not a list.** The filesystem already *is* the plan inventory (`parseAllPlans` reads it). `master.md` declares only what disk cannot express: which folders are parents and what order things take. A prose inventory may exist for humans, but nothing reads it as truth.
- **Machine truth lives in frontmatter, not prose.** The evidence is in this repo: `readMasterPlanOrder` scrapes markdown links by regex and silently matches *nothing* against the Dawn master, because those links carry a `../` prefix the pattern doesn't expect. Prose-derived structure fails quietly; frontmatter fails loudly.

Shape:

```yaml
# .indusk/planning/master.md
---
parents: [indusk-v2-dawn]
roadmap: [indusk-v2-dawn, local-telemetry, doppler-extension]
---
```

```yaml
# .indusk/planning/indusk-v2-dawn/master.md
---
subplans: [dawn-ui-plan-grouping, dawn-external-orchestrator, dawn-hook-parity, dawn-verify]
---
```

**A parent may name a subplan that doesn't exist yet, and that is the normal case, not an error.** The Dawn master names five children; two exist on disk today. Those unwritten ones render as greyed placeholders, which turns the sidebar into the sequence itself — done, in flight, and queued ahead. That rendering is arguably the most useful part of the feature, since it directly answers the "where are we" question that motivated it.

## Context

- Shared parser: `apps/indusk-mcp/src/lib/plan-parser.ts` (`PlanFrontmatter`, `PlanSummary`, `parsePlan`, `parseAllPlans`). The admin app consumes InDusk parsers via workspace subpath exports and must never duplicate parsing.
- Admin reader: `apps/indusk-admin/src/lib/planning-reader.ts` (`Plan`, `readActivePlans`, `readMasterPlanOrder`); sidebar: `apps/indusk-admin/src/app/p/[project]/layout.tsx`.
- **Scoping finding:** `readMasterPlanOrder` exists but only matches links shaped `[name](name/doc.md)`. This work replaces its prose-scraping with frontmatter reading and generalizes it to read a *parent plan's own* `master.md`, not only the root one.
- The root `.indusk/planning/master.md` is stale (last updated 2026-05-25) and Dawn-unaware. This plan gives it the new frontmatter; rewriting its prose is a separate concern.
- Same daemon, same port — a parsing and rendering change, not new hosting. — see [/decisions/admin-ui-hosting](../../../apps/docs/src/decisions/admin-ui-hosting.md)

**Workflow:** brief → test-plan → impl. No research (the code is read; the finding is above) and no ADR (the design was settled in conversation before authoring and is recorded here plus a CLAUDE.md Conventions entry, rather than a seven-clause Y-statement). Both omissions are deliberate.

## Scope

### In Scope
- `parents:` + `roadmap:` frontmatter on the root master; `subplans:` frontmatter on a parent's master.
- Surfacing those through the shared parser — no duplicated frontmatter reading in the admin app.
- Sidebar rendering: parent headers, ordered children, placeholders for declared-but-uncreated subplans, unparented plans unchanged.
- Graceful degradation: a missing master, a missing frontmatter key, or a parent with no children never hides a plan that exists on disk.

### Out of Scope
- **Dates** on roadmap entries. Explicitly excluded.
- Renaming the UI to "Dawn UI" or any rebranding.
- Nesting deeper than one level (a subplan of a subplan).
- Editing or reordering plans *from* the UI — the admin stays read-only. — see [/decisions/indusk-admin-ui](../../../apps/docs/src/decisions/indusk-admin-ui.md)
- Rewriting the root master's stale prose, or retiring it.
- A database-backed store or Linear mapping. Both are future *projections* over these files; the repo stays the record (maxim 6).

## Success Criteria

- The admin UI shows `indusk-v2-dawn` as a group with its subplans nested beneath, in the order its `master.md` declares.
- A subplan named by a parent but not yet created appears as a placeholder rather than being absent or erroring.
- A plan not named by any parent appears at top level, exactly as today.
- Deleting or corrupting a `master.md` degrades to the current flat listing; no plan on disk ever disappears from the UI.
- `pnpm test` green across `indusk-mcp` and `indusk-admin`, with no duplicated frontmatter parsing introduced.

## Depends On

- Nothing. Component 0 of the Dawn master plan, deliberately first — it makes the sequence of everything after it visible.

## Blocks

- Nothing hard. It improves legibility for every Dawn subplan that follows (`dawn-hook-parity`, `dawn-verify`, `dawn-agents`, `dawn-linear`), so doing it first compounds.
