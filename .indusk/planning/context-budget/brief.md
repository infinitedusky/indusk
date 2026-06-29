---
title: "Context Budget — Targeted Retrieval, Thinner Auto-Load"
date: 2026-06-29
status: accepted
audience: indusk-mcp maintainers + Sandy
---

# Context Budget — Brief

## Why

Numero's per-prompt token cost has ballooned to the point that it's affecting both the speed and the dollar cost of every interaction. The cause is structural — InDusk currently auto-loads four artifacts into every conversation, each of which accretes monotonically with no pruning discipline:

1. **`CLAUDE.md`** — every `/retrospective` appends a multi-paragraph entry to Current State. After ~20 completed plans, Current State alone is ~10KB of prose. The actual detail lives in the archived ADR + lessons + retrospective; the Current State entry is redundant.
2. **`.indusk/current.md`** — the per-agent presence-section TTL (60 min default) filters which sessions appear in `agent list`, but the SECTION CONTENT stays in the file. After N sessions, current.md is a flat history of every session's in-flight / open-questions / cursor that any agent has ever written.
3. **`.claude/lessons/`** content — partially mitigated by 1.31.5's lazy-load (titles only at `list_lessons`), but lessons can become stale (rule X no longer applies because the code it was about is gone) and there's no pruning surface.
4. **Handoff prose** in current.md per-agent sections — semantically equivalent to highlights that the eval agent will materialize into Graphiti episodes anyway, but the raw prose stays in the file forever.

Every new Claude Code session pays the cost of all four. The fix at 1.31.5 (lazy lessons) addressed one of them; the other three are open. Numero's pain proves the structural fix is overdue.

**The mental-model correction worth saying out loud**: Graphiti is *not* a way to "reduce" context. Graphiti grows monotonically like any database. The leverage is **targeted retrieval at use-time** — a single beam query against a 100MB Graphiti returns ~5KB of relevant facts instead of paying for the full DB. So the right architectural pivot is:

- Move content from **auto-loaded prose artifacts** → **Graphiti episodes** (canonical store)
- Replace **always-load** with **query-when-relevant** (beam-style retrieval)
- Per-session context size shrinks even as total stored knowledge grows

The existing `context_beam` infrastructure is the substrate for this. It already does distance-decayed graph traversal across Graphiti + semantic graph + eval findings + CGC. Today it's invoked explicitly (`indusk beam <file>` or `mcp__indusk__context_beam`). For this plan, beam-style retrieval becomes the DEFAULT load path at session start, with the always-loaded artifacts shrunk to thin reference layers.

## Thesis

**Every InDusk project gets a configurable context budget. The catchup skill respects it. Artifacts that would push past the budget are loaded via targeted retrieval (beam queries against Graphiti), not auto-load.**

Three concrete shapes follow:

### 1. Catchup loads a thin "navigation layer," not full prose

Today, catchup auto-loads CLAUDE.md (full), `current.md` (full), every lesson title (cheap as of 1.31.5), plans, Graphiti recall query (8 nodes). The thin replacement:

- **CLAUDE.md**: only top three sections — *What This Is*, *Architecture*, *Conventions*. *Key Decisions*, *Known Gotchas*, *Current State* become beam-queryable, not auto-loaded. A one-line index of "topics covered" (extracted at update time) lands in CLAUDE.md so the agent knows what to query for.
- **`current.md`**: only `## Project (shared)` + per-agent sections within the TTL filter (already correct as of section-shape work). Sections beyond the TTL **archive to `.indusk/current-archive/<date>.md`**, removed from the live file. The eval agent verifies Graphiti coverage of any highlights in the archived section before deletion.
- **Lessons**: titles already lazy-loaded. Add a `last_applied` timestamp tracked by eval agent — lessons untouched for > 6 months get flagged in a separate `indusk prune --dry-run` surface (operator decides).
- **Plans**: list with name + status + brief one-liner only. Full plan content already queryable on demand via `mcp__indusk__list_plans` + `Read`.

### 2. Per-edit beam retrieval becomes the default before significant edits

Today, when an agent is about to edit a complex file, it doesn't necessarily know what Graphiti episodes / past decisions / known gotchas apply to that file. The beam exists for this but isn't the default invocation pattern.

New skill behavior — both built into existing skills (work, planner) AND surfaced as a standalone `/context-for <file>` skill:

- Before any meaningful edit to a file the agent hasn't touched in this session: query beam for that file
- Beam returns: 3-5 most relevant Graphiti episodes + eval findings + semantic-graph anchors
- Agent reads those before editing
- Net cost: one extra ~2KB query per touched file vs always-loaded ~10KB of "everything that might apply"

### 3. Per-project token budget enforced at catchup boundary

`.indusk/config.json` gains a `context.budget_tokens` field (default e.g. 50_000). Catchup measures cumulative tokens loaded across all steps; if a step would push past the budget, that step is replaced with a beam query (or omitted with a logged note). Visible to the user in the catchup summary: "loaded N of M tokens; deferred X to beam queries."

This gives a hard ceiling and makes the cost VISIBLE per session. Users see the bill and can adjust the budget or the discipline.

## Proposed Direction

Three pieces, separable, can ship as independent patches:

### 1. Measurement + surface (`indusk prune --dry-run`) — ship as 1.31.11

Cheap, immediately useful, no behavior change. New CLI surface that reports:

- CLAUDE.md size by section (`### Current State` is often the offender)
- `current.md` size; sections older than configurable threshold flagged
- Lessons sorted by file age; flagged if older than N months
- Total auto-loaded context estimate (sum of the above + skill summaries)
- Recommended cleanup commands (manual `rm` + a script to collapse Current State entries to one-liners)

Doesn't auto-prune. Surfaces the bill. Operator decides.

### 2. CLAUDE.md retrospective-folding convention — ships in retrospective skill

Update the `retrospective` skill so the Current State entry it writes is **one line + link to archive** by default, with the full prose going into the archived plan's docs. Existing entries can be collapsed via a one-time migration script.

Net: each `/retrospective` adds ~100 chars to Current State instead of ~500. Over 20 plans: 2KB vs 10KB.

### 3. Current.md auto-archive + beam-default catchup — real plan

This is the larger architectural shift. Components:

- TTL-based archive of per-agent sections from `current.md` to `current-archive/<date>.md` (eval agent verifies Graphiti coverage first)
- `.indusk/config.json` `context.budget_tokens` field
- Catchup measures + enforces the budget; falls back to beam queries when over
- Beam becomes default before file edits via skill content updates (work, planner)
- New `/context-for <file>` slash command for explicit invocation

Lands as 1.32 or via several incremental 1.31.x patches if the per-piece appetite is there.

## Out of Scope

- **Graphiti-side pruning** — Graphiti grows monotonically and that's correct. We're not solving "Graphiti is too big"; we're solving "we auto-load too much from outside Graphiti."
- **Cross-project beam queries** — beam stays per-project (with the existing `shared` group fallback for cross-project conventions). Federation across projects is a different plan.
- **Auto-pruning lessons** — operator confirms each removal. We surface; we don't delete.
- **Token-counting for OUTPUT** — this brief is about INPUT context. Output token budget is a different concern (cost / latency on the agent's response side).
- **Replacing CLAUDE.md entirely with Graphiti** — CLAUDE.md keeps the architectural / convention layers (slow-changing, always-relevant). Only the operational / historical layers move to beam-queryable.
- **Migrating existing plans/lessons to a new format** — additive only. Existing artifacts work as-is; new conventions apply going forward + an optional migration script for those who want it.

## Success Criteria

- **Numero's catchup cost drops by ≥ 50%** after the diet + beam-default lands. (Measured: tokens consumed by `/catchup` execution on a representative session.)
- **No loss of decision context**: the operator can still trace why X was decided by following the one-line Current State entry → archived plan → ADR / retro. Nothing important becomes unreachable.
- **Beam query latency stays acceptable** (< 2s per query) for the default file-edit-triggered queries. If beam is slow, the discipline doesn't hold.
- **`indusk prune --dry-run` accurately reports** what's bloat vs what's load-bearing. False positives undermine trust in the tool.
- **CLAUDE.md doesn't shrink to nothing** — the architectural / convention layers stay full. Only redundant operational prose moves out.

## Depends On

- **`indusk_v2_dawn` / projection-context model** (philosophically) — this plan implements the "connection-based context retrieval" thesis from the Dawn product definition. Doesn't BLOCK on Dawn; predates it as the substrate Dawn would use.
- **`context_beam`** (already shipped) — load-bearing for the query-at-use-time pattern. Beam works today; this plan makes it the default invocation pattern.
- **Eval agent reliability on workbench mode** (just shipped 1.31.10) — without the eval agent reliably materializing highlights to Graphiti episodes, the "active removal once baked" mechanism can't be trusted.

## Blocks

- **Numero's day-to-day cost** — the more this plan defers, the more Numero pays per prompt
- **Sandy's "tell my agent and it works" UX** — when context bloat causes errors or slow responses, the "trust the agent to drive" promise weakens
- **Dawn's projection-petal model proving out** — Dawn assumes thinner auto-load + targeted retrieval is feasible. This plan is the proof-of-life

## Open Questions for ADR

1. **Budget default** — what's the right `context.budget_tokens` floor? 50k? 100k? Should it scale by Claude Code model (Sonnet vs Opus)?
2. **Beam invocation pattern** — automatic on every file-touch (cost: more queries) vs explicit `/context-for` (cost: agent must remember)? Hybrid?
3. **Archive trigger** — TTL-based (days since last update) vs count-based (only N most recent sections) vs hybrid?
4. **Eval-agent "baked into Graphiti" signal** — how does the archive step know a current.md section's content is safely in Graphiti? Highlight processed-markers exist; broader content tracking doesn't.
5. **Current State distillation policy** — one-line is enough or do we want one-paragraph? Tradeoff: one-line forces clicks to archive; one-paragraph still bloats over time but slower.
6. **Migration script** — opt-in or auto-run on `indusk update`? Opt-in is safer but slower adoption.

## Risks

- **Beam query quality determines whether this works**. If beam returns irrelevant or low-quality episodes, agents need MORE context to compensate, and total tokens go UP. The 1.31.10 eval-agent rail fix is a prerequisite — without quality episodes in Graphiti, beam has nothing to query.
- **The "active removal once baked" mechanism is structurally complex.** Easier patches (TTL archive without content-bakedness check) lose information. The right fix requires the eval agent to publish a "this content is materialized" signal that doesn't currently exist.
- **Operator trust risk**: if `indusk prune --dry-run` recommends removing something the operator wants, trust in the tool drops. Mitigation: conservative defaults + explicit opt-in for each removal.
- **Skill-content discipline drift**: telling skills "use beam by default" relies on the skills actually following the convention. Skill drift is a real failure mode.

## Notes for next session

- This plan implements the "connection-based context retrieval" thesis from the Dawn product definition. The principle is: context lives in the graph; auto-load is the thin navigation layer; retrieval is targeted at use-time. This is the proof-of-life for that thesis on the existing InDusk stack — Dawn can inherit it directly.
- The cheapest immediate win is the manual one-time CLAUDE.md diet — collapse completed-plan Current State entries to one-liners. No infrastructure needed; could ship as a 30-minute migration script. Probably 30-50% reduction on its own.
- The lesson-pruning piece is genuinely low priority since 1.31.5 mitigated the loading cost. Defer unless a separate signal (lessons that frequently mislead the agent) emerges.
- This plan is **the architectural inverse of `code-reviewer-agent`** — code-reviewer was a write-side new-petal; context-budget is a read-side trimming-pass. Both inform Dawn's eventual "what auto-loads, what queries on-demand" decision.
