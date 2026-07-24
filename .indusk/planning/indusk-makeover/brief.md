---
title: "InDusk Makeover — Brief"
date: 2026-07-23
status: accepted
---

# InDusk Makeover — Brief

## Problem

Every session pays a huge fixed context tax — ~120k tokens of CLAUDE.md alone, plus catchup (~55k) and MCP schemas — before any work happens. This burns the user's Claude Max quota fast, exhausts context windows early (forcing costly compactions), and the tax grows monotonically because no ritual ever deletes anything. Meanwhile two whole subsystems (Graphiti recall, CGC code graph) cost infra + schemas + a catchup step while contributing almost nothing to actual work.

## Proposed Direction

Make InDusk's value explicit — **the rituals and the curated artifacts they produce** — and cut everything else, with a budget that keeps it cut:

1. **CLAUDE.md hard budget: ~60 KB.** Every Conventions entry becomes 1-3 lines (rule sentence + pointer to its docs/decision page — the lessons titles-hot/bodies-cold pattern). Current State keeps only live/unmerged items; shipped plans get one line + pointer. A write-time size-budget hook (validate-impl-structure precedent) stops regrowth; a **compaction ritual** owns decay (demote stale entries on plan close + periodic pass).
2. **Rip out Graphiti + CGC** — MCP servers, extensions, catchup steps, infra. **Keep the highlight→eval→lessons rail** (retarget the eval agent's output to lessons/retrospective artifacts only).
3. **Sweep the append-only layers**: current.md stale-session sweep (TTL already exists for display; make it actually archive), dead-draft plan auto-archive (109 "active" → the ~15 real ones), so catchup reads only live state.
4. **Catchup diet**: skip the duplicate CLAUDE.md fetch, read only Project(shared) + live sections of current.md, list only in-progress plans. Target ≤15k tokens (from ~55k).
5. **MCP diet**: project keeps indusk, dash0, posthog (+ jaeger TBD); drops codegraphcontext, graphiti. Global keeps playwright only; drops context7, chrome-devtools, supabase, tmux, vibe_kanban.
6. **Push/pull rule distribution — InDusk as the hub.** As we work, rules that prove general get *promoted* upstream into InDusk (extending the existing `community-*` lesson channel + skill versioning); projects *pull* on a regular interval (catchup-time check or explicit sync) to receive the latest rules/skills. One fleet-wide brain, per-project working sets.

Scope is **both levels**: fix this workbench now; land the reusable mechanisms (sweep, auto-archive, budget hook, sync) as InDusk features so every project benefits.

## Context

See [research.md](research.md) for the measured cost table and per-layer value assessment. Key finding: the expensive layers are the *valuable* ones (CLAUDE.md, current.md) grown append-only — the fix is decay + budgets, not deletion of the curation. Graphiti/CGC are the removable line items but not the dominant cost.

## Scope

### In Scope
- CLAUDE.md restructure to the 60 KB budget + size-budget hook + compaction ritual (skill or retrospective step)
- Graphiti + CGC removal (MCP config, extensions, catchup skill steps, indusk-infra containers) with the highlight→eval→lessons rail preserved
- current.md sweep + plan auto-archive (upstream InDusk commands, wired into catchup/handoff)
- Catchup skill rewrite (cheaper reads)
- MCP server pruning per the keep-lists above
- Push/pull distribution: promote-rule flow (project → InDusk) + pull-latest flow (InDusk → project), building on community lessons + skill versions
- Backfill: this workbench's stale current.md sections and dead-draft plans actually swept/archived

### Out of Scope
- Model/effort tuning (eval already on sonnet)
- Rewriting the docs site or archived plan content (pointers target it as-is)
- Changing the planning document lifecycle or gates themselves (they're the value — untouched)
- numero application code

## Success Criteria

- Session-start fixed context (CLAUDE.md + memory index) ≤ ~18k tokens (from ~123k) — measured
- /catchup total cost ≤ ~15k tokens (from ~55k) — measured
- Zero live-rule loss: every compressed convention keeps a resolvable pointer; falsification samples pointers and quizzes rules
- Graphiti/CGC gone from configs + catchup; `rail-check` still green (highlight→eval→lessons works without Graphiti materialization)
- current.md contains only Project(shared) + live sessions; plan list shows only genuinely active plans
- A rule promoted from this project is pullable into a second InDusk project via the sync flow
- The budget holds: the size hook blocks/warns on CLAUDE.md writes past 60 KB

## Depends On
- Nothing hard. Coordinate with the go-live push (don't churn CLAUDE.md the same hour someone's mid-merge reading it).

## Blocks
- Every future session's economics (the point).

## Relationship to `context-budget` (this repo)

`.indusk/planning/context-budget/` (accepted 2026-06-29, impl in-progress) attacks the same problem and this plan **absorbs and partially supersedes** it:

- **Absorbed**: Piece 1 (`indusk prune --dry-run` measurement CLI), Piece 2 (one-line retrospective Current State entries — note: numero's Current State kept growing to ~120 KB after this shipped, so the discipline needs the write-time budget hook, not just skill prose), Piece 3's current.md auto-archive.
- **Superseded**: the central thesis "move content into Graphiti episodes; beam-retrieval becomes the default load path; Graphiti is the canonical store." Field evidence from numero (research.md here) is that Graphiti recall returned generic process entities and was queried ~once per session; the query-formulation problem (agent doesn't know what it doesn't remember) makes pull-based canonical storage the wrong bet. This plan keeps push-based curated artifacts (CLAUDE.md rules, lessons) as canonical and removes Graphiti entirely.
- **Action**: mark context-budget superseded-by-this-plan (or fold its remaining impl items into this plan's impl) when this plan's ADR is accepted.

**Canonical home note**: the upstream mechanisms (sweep, auto-archive, budget hook, hub sync) are worked HERE in dusk; the numero-workbench copy of this plan (`numero-workbench/.indusk/planning/indusk-makeover/`) drives the consuming-project side (that workbench's actual CLAUDE.md compression, MCP pruning, backfill sweep). Keep both in sync on decision changes.
