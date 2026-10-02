---
title: "Context tiers — classification register"
date: 2026-10-02
baseline: 9f108ede
---

# Context tiers — classification register

**Baseline**: `9f108ede` — the trunk commit this plan's worktree branched from.
A10 parses `git show 9f108ede:CLAUDE.md` into entries and fails naming any
entry without a row below. The root as it stood there is the whole input;
nothing is classified from memory.

One row per root entry. Tier is one of:

- `enforcer` — a test or hook already holds the rule; the row names it and the
  lesson its failure message carries (`lesson: <name>`). Where the enforcer
  holds only part of the claim, the remainder column says what stays as prose
  and where.
- `directory` — the rule applies in one area; the row names the context file.
- `root` — design intent with no enforcer and no home directory; stays, with
  the reason it must be always-on.
- `current.md` — operational state.
- `deleted` — removed, with the reason.

## Pending rows (destinations not yet created)

Rules this plan's own Context gates produce before Build Phase 3 creates the
nested files. Each moves into its file in Build Phase 3 and is struck here.

| Rule | Destination | From |
|------|-------------|------|
| A trajectory row's `Test` column may name a `manual:` command; `verify` reports it unverified, never passed | `.indusk/planning/CLAUDE.md` (template) | Test Phase 1 Context |
| `lib/tokens.ts` is the one token grammar for `promise:` and `lesson:`; a new token kind is added there, never as a second pattern; the file that documents a marker must not spell one | `apps/indusk-mcp/CLAUDE.md` | Build Phase 2 Context |

## Register

| # | Section | Entry (first words) | Tier | Destination | Enforcer / lesson | Remainder kept as prose |
|---|---------|---------------------|------|-------------|-------------------|-------------------------|

_Filled in Build Phase 4._
