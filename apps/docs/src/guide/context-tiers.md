# Context tiers

*A rule reaches you where and when it applies.*

The root `CLAUDE.md` used to be the one channel for every kind of knowledge,
and it filled: pinned at its budget, evicting an entry under gate pressure at
every plan close, skimmed rather than read at fifteen thousand tokens. The
root carried four kinds of content that want four deliveries:

| Kind | Example | Where it is delivered now |
|---|---|---|
| A rule a test or hook already enforces | the single-definition pins; trunk refuses code on `main` | by the enforcer, whose failure message names the lesson |
| A rule relevant only in one area | the admin's sidebar tree; the papers module map | a context file in that directory, loaded when a file there is read |
| Design intent with no enforcer | why the lifecycle is one definition | the root, always loaded — the only kind that earns it |
| Operational state | what is in flight | `.indusk/current.md` |

## The three context files

Claude Code loads every `CLAUDE.md` on the path between a file it reads and
the session's working directory, at read time. Three nested files use that:

- **`.indusk/planning/CLAUDE.md`** — the rules of plan documents: trajectory
  rows, gates, test phases, the fenced-mask rule. **Package-owned**: `indusk
  init` writes it and `indusk update` overwrites it from the package's
  `templates/planning/CLAUDE.md`, so every consumer project gets the planning
  rules the moment a plan is written and carries none of them in its root.
  Edit the template, never the copy.
- **`apps/indusk-admin/CLAUDE.md`** and **`apps/indusk-mcp/CLAUDE.md`** — this
  repository's own area rules, filled from the classification register when
  the root was rewritten.

A nested file has its own, smaller budget
(`context.nested_claude_md_budget_bytes`, 16 KB by default); see
[the context-budget guide](./context-budget).

## The lesson token

A test or hook that enforces a rule names the lesson behind it, at the start of
its failure message:

```ts
expect(definers, "lesson: structural-single-definition-test-for-must-agree-invariants — …").toEqual(["lib/tokens.ts"]);
```

When the rule breaks, the agent reads the message, follows the name to
`.claude/lessons/<name>.md`, and gets the explanation at the moment it is
relevant — at no standing cost. `list_lessons` reports each lesson as
**guarded** (some enforcer carries its token) or **advisory** (none does),
derived on every read and never stored; `/catchup` skims only the advisory
titles. Guarded is relative to the project scanned: a hook's token travels
with the hook and guards every project, a test's guards the one the test lives
in.

The token shares its grammar with the promise token (`lib/tokens.ts`): the
kind, a colon, the name, after a comment opener or directly inside a quote.
`indusk context check-pointers` treats a lesson token in any context file as a
pointer and fails when the lesson file does not exist.

*Where a new rule goes — the decision, with its diagram — is written when the
register is complete.*
