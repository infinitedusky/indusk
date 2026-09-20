---
title: "Context tiers — where a rule lives, and how it reaches you"
status: complete
date: 2026-09-20
---

# Research

CLAUDE.md is injected into every session, it is pinned at its budget ceiling,
and the mechanism meant to hold it there — the retrospective's compaction step
— is losing. This records what the file actually contains, which approaches
were considered, and which was rejected and why. The recommendation is the
brief's job.

The conversation that produced this ran during `day-always-on`, where three
separate Context gates each had to evict something before they could add a
line. That is the symptom worth keeping in mind: the eviction decision gets
made mid-phase, under gate pressure, by whoever is in a hurry.

## Finding 1 — the ceiling is reached, and the arithmetic does not balance

Measured 2026-09-20, on the `day-always-on` worktree:

```
total 61,410 bytes  (100.0% of the 61,440 budget, ~15,350 tokens)
   23,330  38.0%  Known Gotchas
   19,608  31.9%  Conventions
    8,057  13.1%  Architecture
    6,548  10.7%  Key Decisions
    3,577   5.8%  Current State
      232   0.4%  What This Is
```

The retrospective's steady state is "collapse one old entry per close." A plan
typically *adds* two to four — a Key Decision plus one to three
Conventions/Gotchas. Net growth of one to three entries per plan at roughly
150–400 bytes each, against one retirement. At the current pace that is the
couple of kilobytes a week that has held the file against its ceiling.

The budget is therefore not a budget. It is a tax, payable at the moment of
least attention, and the entries evicted are the ones that are nearby and long
rather than the ones that are least valuable.

## Finding 2 — most of the weight is already enforced elsewhere

Of the 37 entries in Known Gotchas, **20 (54%) name a test, hook or validator
that already enforces them**. Of the 40 in Conventions, **14 (35%)** do.

`resolveImplPath` is single-definition because `shared-resolution.test.ts`
fails otherwise. Code stays off `main` because `trunk-guard.js` refuses the
edit. Impl structure holds because `validate-impl-structure.js` blocks the
write. In each case the prose in CLAUDE.md is a second copy of a rule that
machinery already holds — in a repository carrying three separate lessons
about one home per fact.

**This number is a keyword match, not a verification.** It counts entries whose
text mentions a test file, a hook, a validator, "pinned by", "refuses" or
"guard". The brief must hand-check the list before relying on it; some entries
name machinery that enforces only part of what the entry claims, and those are
the interesting ones.

The counterargument to acting on this, which is real: a test tells you *after*
you wrote the code, while the context entry tells you *before*. That is a
genuine difference in cost, but it is a cheap failure — you wrote something, a
test went red, you read the message — set against the expensive failure of a
rule nobody can find at all.

## Finding 3 — the scoping mechanism exists and is empty

```
   11 bytes  apps/indusk-admin/CLAUDE.md
  485 bytes  apps/indusk-mcp/CLAUDE.md
```

Both are stubs containing little more than `@AGENTS.md`. Meanwhile the root
file carries the entire admin block — the sidebar tree, the badge maps,
`next/link` mocking, `fileParallelism: false`, the component conventions —
paid for by every session that never opens the admin, when it already has a
free home two directories down.

## The approach that was rejected: retrieval by subagent

The proposal was to make every entry a key into a larger file and delegate the
read to a subagent, scoped by plan. Three objections, in descending strength:

1. **A subagent can only fetch what you thought to ask for.** CLAUDE.md's
   function is not reference, it is *surprise*. "Never predict Edit results
   with `String.replace`" is valuable precisely because nobody would search
   for it. Turn it into a key and the failure becomes silent: not a wrong
   answer, but no answer, with no signal that one existed.
2. **It is token-negative on dense text.** These entries are already the
   compressed form. Spending a subagent to read three kilobytes and return
   three hundred bytes costs more than reading the three kilobytes.
   Delegation wins when the source is large and the conclusion small; this is
   the opposite shape.
3. **The plan is a poor scoping key.** It requires predicting what the work
   will touch at plan-open, which is when least is known.

Objection 1 is the one that matters: it reframes the question from "how do I
fetch the right rule" to "how does the right rule reach me unbidden, at the
moment it matters."

## The three tiers that reframe produces

**1. Enforce.** Ask of every entry: can this be a hook, a test or a type? Those
cost zero context, never decay, fire unbidden and catch the case nobody thought
about. This is the tier the project already bet on — "hooks enforce what
discipline won't" — and where new rules should go by default.

**2. Make the enforcement carry the pointer.** This is the missing piece, and
it is what makes tier 1 safe to lean on. A red test whose message ends `— see
/lessons/dawn-verify` delivers the body at exactly the moment it is relevant,
at zero standing cost. That is retrieval triggered by the failure rather than
by guessing to look, and it answers objection 1 above. The CLAUDE.md entry then
shrinks to a line, or goes away.

**3. Scope by location.** Directory-scoped CLAUDE.md files, read down the tree
as work reaches a file.

Whatever survives all three is genuine cross-cutting design intent — why the
lifecycle is one definition, why papers are declared and never inferred — and
there is much less of it than there is incident knowledge.

## The axis question, which decides whether tier 3 works

**Scope by where the work is written, not by what it is about.**

`/planner` writing an impl needs the trajectory rules, the gate vocabulary and
the test-phase structure. By subject those belong to `lib/trajectory/`. But the
file being edited is `.indusk/planning/<plan>/impl.md`, so a tree-walk from the
edited file would never reach them — planning would silently lose its rules,
and silently is the worst way to lose them. The rules belong in
`.indusk/planning/CLAUDE.md`.

Every candidate entry therefore gets asked: *which directory is the work
written in when this rule applies?* — not *which module is this rule about?*

## Tier 3 needs a hook, not a discipline

"Read down the tree as you go" is a rule someone has to remember, and this
project has a lesson about what happens to those. The structural version is a
PreToolUse hook on Edit/Write that injects the nearest CLAUDE.md up the tree
when a file is touched and it has not been read this session.

Whether Claude Code already loads nested context files automatically, and on
what trigger (cwd, or the file being edited), is **unverified** and is the
first thing the brief should establish — it decides whether the hook is the
mechanism or merely the backstop.

## The Midnight rhyme, and where it stops

Tier 2 has the same shape as a promise: **a declared invariant, a link to the
thing that enforces it, and a path back to the knowledge when it breaks.** A
test naming the lesson it guards is a site naming the promise it keeps, and the
notation can mirror it exactly — `lesson: <name>` beside `promise: <name>`,
read by the same kind of token scan.

**Reuse the pattern; do not reuse the registry.** Lessons written into
`.indusk/promises/` would make "holding N promises" count development hygiene
alongside product behaviour, and that number is the entire point of Day 4a. Two
registries, one shape.

## Open questions for the brief

- Does nested-CLAUDE.md loading already happen, and on which trigger? (Decides
  hook-as-mechanism vs hook-as-backstop.)
- Hand-check the 54%/35%: for each entry, does the named machinery enforce the
  *whole* claim, or only part of it?
- How does a test surface its lesson body — runner-agnostic, since the project
  refuses to parse runner output in core? Likely the assertion message itself,
  which needs no tooling at all.
- Does the budget go *down* after the migration? The real ceiling is attention,
  not bytes: at 15k tokens the file is already past being read rather than
  skimmed. Low confidence on where that line sits, high confidence it is below
  where we are.
- What happens to `indusk context check-pointers` when pointers start living in
  several files?
