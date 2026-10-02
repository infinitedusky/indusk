---
title: "Context tiers — a rule reaches you where and when it applies"
date: 2026-10-02
status: proposed
---

# Context tiers

## Goal

**Every rule in the root `CLAUDE.md` moves to the delivery that fits it, so the
root holds only cross-cutting design intent and every later plan is built on a
smaller, deliberate root.**

Today the root is pinned at its 60 KB budget (61,346 of 61,440 bytes on
2026-10-01), every plan close evicts something under gate pressure, and about
half of it restates rules a test or hook already enforces. On 2026-10-01 alone
the root had to be compacted three times for one plan to close, and the budget
hook refused an edit that would have *shrunk* the file. After this, a rule a
test enforces is delivered by that test's failure, an area's rules arrive when
that area's files are opened, and the root is held by a lower budget with room
to spare.

## Y-Statement

**In the context of:**
a single always-loaded `CLAUDE.md` that carries four kinds of content — rules
an enforcer already holds, rules relevant to one directory, cross-cutting
design intent, and operational state — under a hard byte budget that every
plan close presses against.

**Facing:**
the fact that only design intent earns always-on loading, that half the file
is a second copy of rules machinery already holds, and that deleting those
copies would lose the explanation the agent needs at the moment it breaks one.

**We decided for:**
three tiers. Enforced rules are delivered by their enforcer, whose failure
message names the lesson (`lesson: <name>`, the promise token's grammar and
opener rule). Area rules move to context files in the directory where the work
is written — `.indusk/planning/` (package-owned, shipped by `init`/`update`),
`apps/indusk-admin/`, `apps/indusk-mcp/` — which Claude Code loads on read.
Design intent stays in the root, which is then held by a lowered budget. A
register records where every root entry went, checked against the root as it
stood when the impl began.

**And against:**
retrieval by subagent; a PreToolUse hook that injects context; load-time
truncation or summarisation; a shared registry with promises; requiring every
test to carry a token (that is `day-contract`'s, component 4c in the Day
master plan, which makes each row name a promise or a lesson or say why
neither).

**To achieve:**
a rule delivered at the moment it is relevant, at no standing cost; a root that
can be read rather than skimmed; and no rule lost in the move.

**Accepting:**
dependence on Claude Code's observed (not documented) nested-loading behaviour,
held by an e2e probe that runs locally rather than in CI; a lesson nothing
enforces reaches an agent only by directory or by the catchup skim; and one
more token grammar to keep single-sourced.

**Because:**
the failure is the moment a rule matters, so the failure is the cheapest place
to deliver it; directory scoping matches how Claude Code already loads context
(research Finding 4); and the register turns "did we lose anything" from a
judgement into a test.

## Context

- [brief.md](brief.md) — the four kinds of content, the decisions taken at
  acceptance (Current State moves to `current.md`; the lowered budget is set in
  this plan's last phase; `day-contract` does not wait), and the 2026-10-02
  additions (the shrinking-edit defect first; ahead of the loop fixes).
- [research.md](research.md) — the keyword census (20 of 37 Known Gotchas and
  14 of 40 Conventions name an enforcer), the rejected subagent approach, and
  Finding 4: nested context files load on read, every ancestor between the read
  file and the cwd, no depth limit observed.
- [test-plan.md](test-plan.md) — A1–A16 and U1–U2; this ADR is constrained by
  making all sixteen true.
- [day-promises](../archive/day-promises/) — the token, opener rule and scan
  shape reused here (`lib/promises/vocabulary.ts`, `citations.ts`).

## Decision

1. **The budget hook allows a shrinking edit** (A16), first, because the rest
   of this plan is such edits. `claude-md-budget.js` compares the post-edit size
   with the current size: an edit that does not grow the file is allowed at any
   size; one that grows it past its budget is refused as today.

2. **One token grammar, one definition.** The promise token's opener rule — a
   comment opener earlier on the line, or a quote directly before — moves out
   of `lib/promises/vocabulary.ts` into a shared module both kinds import, and
   `lesson:` is the second kind it recognises. A test puts the token at the
   start of its assertion message (`expect(n, "lesson: <name> — …")`); a hook
   at the start of a refusal line inside a template string. One scanner reads
   both (A5, A6). The day-promises single-definition pin covers the move.

3. **Guarded or advisory is derived on every read, never stored** (A7, A8).
   A lesson is *guarded* when `scannableFiles` — the promise scan's file set,
   which already skips prose and `.indusk/` — finds its token in some file;
   otherwise *advisory*. Lesson files, guides and changelogs are prose and never
   count. `list_lessons` returns the state per lesson; the catchup skill skims
   only advisory titles and states both counts (A9). No registry is shared
   with promises.

4. **Three nested context files, placed by where the work is written.**
   - `.indusk/planning/CLAUDE.md` — trajectory rules, gate vocabulary,
     test-phase structure, the fenced-mask rule, Deferred Verification shape.
     **Package-owned**: its source is `apps/indusk-mcp/templates/planning/CLAUDE.md`,
     written by `init` and overwritten by `update` like a skill, pinned
     byte-equal beside `skill-sync-parity` (A4).
   - `apps/indusk-admin/CLAUDE.md` and `apps/indusk-mcp/CLAUDE.md` — this
     repository's own; not shipped.
   The e2e probe (`apps/indusk-mcp/e2e/context-tiers.e2e.test.ts`) asserts a
   codeword in each arrives when a file beneath it is read and not otherwise,
   against a fixture and against this repository's planning file (A1–A3).

5. **The register is the plan's record that no rule was lost** (A10).
   `register.md` in this plan folder: one row per root entry as of the impl's
   baseline commit — entry, tier, destination, and for tier 2 the enforcer and
   token, or a reason for deletion. A test parses the root at that commit
   (`git show <baseline>:CLAUDE.md`) and fails naming any entry without a row.
   The hand-check of each row — does the named enforcer hold the *whole* claim,
   or part of it — is the plan's real work, and partial enforcement keeps the
   unenforced part in prose.

6. **`check-pointers` walks every context file** (A11): every `CLAUDE.md` git
   knows about, not only the root, and resolves `lesson:` tokens to
   `.claude/lessons/<name>.md`, failing with the file and the pointer.

7. **Current State moves to `current.md`'s shared region** (A12), as the brief
   decided; the readers that look for the root heading are found and moved
   first.

8. **The root is held by a lowered budget, set last** (A13, A14). After the
   rewrite, `context.claude_md_budget_bytes` is set to the surviving size plus
   at least 25 % (20 % headroom), with `context.claude_md_budget_reason` beside
   it. Nested files get their own `context.nested_claude_md_budget_bytes`
   (16,384 by default); the hook applies whichever governs the edited file.

9. **The skills route by tier** (A15). The `/claude-md` routing table becomes
   the tier table; a `/planner` Context gate item names its tier and
   destination, and one aimed at the root says why it must be always-on; the
   retrospective's compaction step becomes classification-at-close. The gate
   vocabulary itself does not change.

## Alternatives Considered

### Retrieval by subagent or search index
Rejected (research §Rejected): the root's job is surprise — telling the agent
what it did not know to ask — and a lookup keyed on what the agent asks fails
silently on exactly those rules.

### A PreToolUse hook that injects the right context
Rejected as the mechanism: Claude Code already loads nested files on read
(Finding 4). An injector would duplicate that and drift from it. The e2e probe
is the backstop instead.

### Truncation, summarisation, or compression by discipline
Rejected by the makeover ADR and again here: they change how content is cut,
not where it belongs, and the budget pressure returns at the next plan.

### Lessons in the promises registry
Rejected: "holding N promises" counts product behaviour; development hygiene
must not inflate it. The token shape is shared, the registry is not.

### A token on every test
Rejected here as out of scope: whether every test must say what it is for is
`day-contract`'s rule (Day master plan, 2026-10-02: a row names its promise,
its lesson, or why neither). This plan supplies the lesson token it will use.

## Consequences

### Positive
- The root shrinks to design intent and stays readable; every later plan's
  Context gate has a destination other than "squeeze it in".
- A failing guard explains itself, which removes the cheapest bad fix —
  deleting or loosening the test.
- Consumer projects receive the planning rules at the moment they plan,
  without carrying them in their own root.

### Negative
- Rules now live in four places; an agent that never touches a directory never
  sees its rules, by design.
- The token grammar moves out of a module day-promises pinned, so the pin is
  updated in the same commit.

### Risks
- **Nested loading changes in a Claude Code release** — mitigated by the e2e
  probe, run at the close of any plan that touches a context file and before
  each release; a red probe blocks the release.
- **An advisory lesson has no route to an incident** — open (brief, 2026-10-02):
  whether a lesson should name the code it applies to, as a promise names its
  sites. Not decided here; noted for `day-contract` and `incident-recording`.
- **The register is hand-classified** — mitigated by A10 making a missing row a
  failing test, and by the rule that partial enforcement keeps the remainder in
  prose.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/context-tiers.md` — the four kinds, the three
  tiers, where to put a new rule, the token.
- Update: `guide/context-budget.md` — points to the tiers guide; the lowered
  budget and the shrinking-edit rule.
- Update: `reference/tools/indusk-mcp.md` (`list_lessons` state),
  `reference/cli/` (`context check-pointers` over every file),
  `reference/skills/` for `/claude-md`, `/planner`, `/retrospective`,
  `/catchup`.

### Diagrams
- Mermaid in the guide: which tier a rule goes to (a three-question decision).

### Changelog
- Added: `lesson:` tokens, guarded/advisory lessons, the shipped planning
  context file. Fixed: the budget hook refuses only growth past the budget.

### ADR in Docs
- Yes: `apps/docs/src/decisions/context-tiers.md` at close.

## References
- [brief.md](brief.md), [research.md](research.md), [test-plan.md](test-plan.md)
- [indusk-makeover ADR](../archive/indusk-makeover/adr.md)
- [day-promises](../archive/day-promises/)
- Day master plan, component 4c (`day-contract`):
  [indusk-v4-day/master.md](../indusk-v4-day/master.md)
