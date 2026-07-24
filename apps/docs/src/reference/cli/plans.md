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
