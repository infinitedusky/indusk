# `indusk plans`

Planning-lifecycle housekeeping. Introduced in the `indusk-makeover` plan as the decay mechanism for `.indusk/planning/` — before it, dead-draft plans accumulated forever and every `/catchup` paid to list them.

## Subcommands

### `plans archive-dead`

```bash
indusk plans archive-dead [--dry-run]
```

Moves **dead-draft** plans to `.indusk/planning/archive/` — the directory is moved intact; nothing is ever deleted or overwritten (a name collision with an existing archive entry is a skip, reported with a reason).

A plan is a dead draft only when **all three** hold:

1. **No document carries a status beyond draft.** Blocking statuses: `accepted`, `approved`, `in-progress`, `completed`, `complete`, `proposed`. Eligible: `draft`, `abandoned` (terminal — archive is where it belongs), or no status at all. A document whose frontmatter fails to parse **blocks** archiving — conservative on bad input.
2. **The newest file in the plan directory is older than `planning.dead_draft_days`** (default 30; configured in `.indusk/config.json`).
3. **master.md does not protect it.** A markdown link to the plan on a master.md line that does *not* contain the word "draft" protects it — so a `parked — revisit with v2` row protects its plan, while a `brief draft` row leaves it archivable.

`--dry-run` prints the candidate list and skip reasons without moving anything. Always review the dry-run before the first real run on a project with a large backlog.

## Configuration

```json
{
  "planning": {
    "dead_draft_days": 30
  }
}
```

Absent field → 30-day default. `indusk update` scaffolds the key idempotently.

## Relationship to the sweep

`plans archive-dead` and [`agent sweep`](/reference/cli/agent#agent-sweep) are the two halves of InDusk's decay layer (see the [indusk-makeover decision](/decisions/indusk-makeover)): plans and operational state both accumulate append-only, and these commands give each an owner. Both archive rather than delete, both run from the catchup/handoff rhythm, and both are safe to invoke manually at any time.

## Plan hierarchy (parents and subplans)

Plans are flat folders under `.indusk/planning/` — parents and children are all siblings on disk. Hierarchy is **declared in frontmatter**, not expressed by nesting, so moving a plan under a different parent is a one-line edit rather than a directory move that breaks links and history.

Declaration flows **top-down only**:

```yaml
# .indusk/planning/master.md — the root sequence
---
parents:
  - indusk-v2-dawn        # folders that own subplans
roadmap:
  - indusk-v2-dawn        # top-level display order; unlisted plans follow
  - local-telemetry
---
```

```yaml
# .indusk/planning/indusk-v2-dawn/master.md — one parent's children
---
subplans:
  - dawn-ui-plan-grouping
  - dawn-external-orchestrator
  - dawn-verify
---
```

A child declares **nothing** about its lineage. Only one place declares each parent→child link, so the two sides can never disagree and there is no drift to reconcile.

### Two rules that keep it safe

**The inventory comes from disk.** The filesystem is the list of plans; `parents:` / `roadmap:` / `subplans:` only add structure over it. A declaration can group plans — it can never subtract one. A plan named by no declaration appears at the top level, exactly as before.

**Broken declarations degrade, never fail.** A missing `master.md`, an absent key, a non-array value, or malformed YAML each yield empty declarations and the flat list. Losing structure is acceptable; losing a plan is not.

### Name hygiene

Declaration names are boundary values — they get joined into filesystem paths and rendered verbatim, so the parser guards them on the way in:

- A name that isn't a single clean path segment (contains `/` or `\`, or is `.` / `..` / blank) is **dropped** from `parents:`, `roadmap:`, and `subplans:` alike. A traversal name can never cause a read outside the planning directory.
- Duplicate names in one list collapse to the **first occurrence**, preserving declared order — a child is never rendered twice.

Both are silent degrades, consistent with the rule above: a bad name loses its structure, never a plan.

### Declared-but-uncreated subplans

A parent may name a subplan whose folder doesn't exist yet — that is the **normal** case for a sequence, not an error. Those entries render in the admin sidebar as greyed placeholders, so the plan list shows work queued ahead as well as work underway.

A subplan whose folder has moved to `archive/` is the opposite of uncreated — it renders as a navigable item with its real status, never as a placeholder. If the same name somehow exists both active and archived, the active copy wins.

### API

`readPlanDeclarations(planningDir)` in `apps/indusk-mcp/src/lib/plan-parser.ts` returns `{ parents, roadmap, subplans }`. It is exported for consumers at `@infinitedusky/indusk-mcp/planning/plan-parser` — the admin UI consumes it rather than re-reading frontmatter, per the never-duplicate-parsing rule.
