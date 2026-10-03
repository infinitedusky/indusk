# Context tiers

The root `CLAUDE.md` is loaded into every session, so every rule in it is paid
for on every turn. By October 2026 it sat 2 bytes under its 60 KB budget, and
each plan close evicted an entry to make room for the next. This decided
**where a rule lives**, instead of how hard to compress it.

Full ADR: `.indusk/planning/archive/context-tiers/adr.md`. How to use the tiers
day to day: [the context-tiers guide](/guide/context-tiers).

## What was decided

**A rule reaches the agent where and when it applies.** Four places, tried in
this order when a new rule appears:

1. **An enforcer.** A test or hook that already holds the rule names it when it
   fails: its message carries `lesson: <name>`, which points at
   `.claude/lessons/<name>.md`. The explanation arrives at the moment the rule
   is broken, at no standing cost. `list_lessons` reports each lesson
   **guarded** (some enforcer carries its token) or **advisory** (none does),
   derived on every read and never stored.
2. **The directory where the work is written.** Claude Code loads a nested
   `CLAUDE.md` when a file in its directory is read. Area rules live there: the
   planning rules in `.indusk/planning/CLAUDE.md` (package-owned, shipped by
   `init` and `update`), and one file each for the admin, the package and its
   hooks.
3. **`.indusk/current.md`** for operational state — what is in flight, what was
   published.
4. **The root** for design intent only, with a reason for anything added.

**A register proves no rule was lost.** Every one of the root's 138 entries
has a row naming its destination, checked against the root as it stood at the
baseline commit; enforcer rows are checked against the lesson scan itself.

**The root is held by a lowered budget** — 18,432 bytes, the surviving size
plus a quarter, with the reason in `.indusk/config.json`. Nested files have
their own 16 KB budget. The budget hook judges growth, not size: an edit that
makes an over-budget file smaller is always allowed.

## Tradeoffs accepted

- **Rules live in four places.** An agent that never reads a file in a
  directory never sees its rules — by design, and the reason it is cheaper.
- **Nested loading is observed, not documented.** It is guarded by end-to-end
  probes run at the close of any plan that edits a context file. They are not
  wired into the release; that is an open decision.
- **Delivery does not guarantee compliance.** In this plan's own sessions two
  delivered rules were broken anyway. The enforcer tier exists for that.

## Alternatives rejected

- **Retrieval by subagent or search index** — the root's job is to tell the
  agent what it did not know to ask, and a lookup keyed on the question misses
  exactly those rules.
- **A hook that injects context** — Claude Code already loads nested files on
  read; an injector would duplicate it and drift.
- **Compression by discipline** — changes how content is cut, not where it
  belongs; the pressure returns at the next plan.
- **Lessons in the promises registry** — promises count product behaviour;
  development hygiene must not inflate them. The token grammar is shared, the
  registry is not.
