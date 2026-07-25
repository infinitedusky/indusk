---
title: "Compaction Skill — the makeover's missing companion"
date: 2026-07-24
status: accepted
---

# Compaction Skill — Brief

## Problem

The indusk-makeover budget hook (`claude-md-budget.js`, Phase 2) blocks any CLAUDE.md write that leaves the file over `context.claude_md_budget_bytes` (60 KB default), and its error message tells the agent to "run the compaction ritual." But no runnable ritual existed — compaction shipped only as an *incremental* step inside `/retrospective` (demote this plan's narrative + one old entry at close). That step cannot pay down a file that is already multiples over budget: on numero the workbench CLAUDE.md is 497 KB (~125k tokens injected every session), and every plan since the hook landed has been unable to add even its one-line Key-Decision entry, because the hook blocks all growth — including a net-shrinking edit that doesn't land all the way under.

This is the same defect class as the retired `check-catchup` hook: shipped tooling demanding an action the system does not provide as a first-class verb — the "writing-a-warning-is-a-design-smell" pattern, in the makeover's own surface.

## Proposed Direction

Ship `/compact-context` beside the hook — the **bulk** compaction ritual the hook's message promises:

- **Report mode default** (`/compact-context`), destructive pass only on `--apply` + confirmation — the editorial calls need project judgment, never blind automation.
- Classify every entry: load-bearing convention / shipped-plan narrative / operational state / dead.
- Demote narratives to one-line rule + pointer (create the pointer's home page first if missing — never a dangling pointer), move operational state to `.indusk/current.md`, drop only provably-dead entries.
- Land under budget in one `Write` (the hook blocks incremental growth, so the apply is a single fully-compacted write), verify with `indusk context check-pointers`.
- Update the hook's error message to name the now-runnable `/compact-context`.
- Complements — does not replace — the retrospective's incremental step (don't-accrue) with the bulk pay-down-debt half.

## Scope

### In Scope
- `apps/indusk-mcp/skills/compact-context.md` + installed `.claude/skills/` copy
- Hook error-message fix; retrospective cross-reference; context-budget guide link

### Out of Scope
- Running the actual numero 497 KB → 60 KB pass — that is numero's own session (editorial judgment on numero's content belongs there); dusk ships the skill, numero is first consumer.
- Automating the editorial classification (report-mode preview is deliberate; a human confirms).

## Success Criteria
- The budget hook's error message names a command that exists and runs.
- `/compact-context` produces a report (no mutation) by default; `--apply` lands CLAUDE.md under budget with all pointers resolving.
- dusk's own CLAUDE.md (already 23 KB from the makeover Phase 6 compaction) is unaffected; numero can run the skill to reclaim ~125k tokens/session.

## Context

Companion to `.indusk/planning/archive/indusk-makeover/` (the hook is its Phase 2). Shipped directly (bug-adjacent — a dangling promise made true), like the check-catchup removal. Surfaced 2026-07-24 by the numero agent-training-sandbox session hitting the block on its Key-Decision line.
