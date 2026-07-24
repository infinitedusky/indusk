# InDusk Makeover — budgets, decay, removal

> Accepted 2026-07-23. Supersedes the `context-budget` plan (pieces absorbed; Graphiti-as-canonical thesis rejected).

## Goal

**A session starts with ~18k tokens of fixed context instead of ~123k, and the memory system gains decay rituals so it never regrows.**

Today a session on this workbench consumes roughly half a 200k window before any work happens — 488 KB of CLAUDE.md, a ~55k-token catchup dominated by stale current.md sections and 90+ dead-draft plans, and schemas for a dozen MCP servers, two of which (Graphiti, CGC) contribute almost nothing to actual work. This burns Claude Max quota, forces early compactions, and worsens monotonically because no ritual ever deletes anything. When this ADR ships, the curated value (rules, lessons, live state) survives at ~15% of the cost, and write-time budgets plus sweep rituals keep it there.

## Y-Statement

**In the context of:**
InDusk's memory and ritual system as used across dusk and the workbench-shaped projects, where every session pays the full fixed-context tax (CLAUDE.md + catchup + MCP schemas) before the first useful token of work, and the tax compounds with quota limits and context-window compactions.

**Facing:**
The measured audit (research.md) shows the expensive layers are the *valuable* ones — CLAUDE.md and current.md — grown append-only with no decay mechanism anywhere in the system, while two whole subsystems (Graphiti recall, CGC code graph) cost infrastructure, schemas, and catchup steps yet were observed contributing ~one generic query per session and near-zero reads respectively.

**We decided for:**
Budgets, decay, and removal. A 60 KB hard budget on CLAUDE.md enforced by a write-time hook, with entries compressed to rule-sentence-plus-pointer and a compaction ritual owning ongoing decay; complete removal of Graphiti and CGC while preserving the highlight→eval→lessons rail; a current.md stale-section sweep and dead-draft plan auto-archive; a catchup rewrite targeting ≤15k tokens; MCP keep-lists (project: indusk, dash0, posthog, **jaeger — critical, keeps the local-telemetry surface**; global: playwright only); and a push/pull rule-distribution flow with InDusk as the hub, pulled at catchup time.

**And against:**
The Graphiti-as-canonical-store direction (context-budget piece 3's beam-default retrieval — field evidence says pull-based recall fails because the agent doesn't know what it doesn't remember); keeping CGC with better index hygiene (near-zero reads across many sessions; Grep/Read substitutes; index freshness is a liability across ~10 drifting worktrees); summarization-only without budgets (numero's Current State regrew to ~120 KB after the one-line-entries discipline shipped — prose discipline without a write-time gate doesn't hold); and dropping jaeger from the project keep-list (rejected — Sandy: absolutely critical).

**To achieve:**
An ~85% cut in session-start fixed context (~123k → ~18k tokens), catchup at ≤15k (from ~55k), later compactions and more real work per window and per quota-dollar, and a system whose append-only layers finally have owners for their decay — plus a fleet-wide distribution channel so rules proven in one project reach every project.

**Accepting:**
Loss of Graphiti recall and code-graph queries (both measured as near-unused; lessons and Grep are the working substitutes); the risk that narrative compression drops nuance a future session needed (mitigated by the A4 15-entry sample gate now and U1's 2-week repeat-mistake review); one-time migration effort across this workbench's CLAUDE.md, plans, and configs; and the loss of context7 convenience globally (re-addable in one `claude mcp add` line if missed).

**Because:**
Observed usage concentrates value in rule sentences and lesson titles — the multi-paragraph narratives duplicate `apps/docs/decisions/*` and archived plan docs that pointers can reach; the fix for valuable-but-bloated layers is decay and budgets, not deletion of the curation; and fixed context size is the multiplier on *all* session cost, so cutting it compounds across every future session.

## Context

Research at [research.md](research.md) — measured 2026-07-23 on this workbench. Brief at [brief.md](brief.md), accepted 2026-07-23. Test plan (15 assertions, 2 mitigated untestables) accepted 2026-07-23; this ADR is constrained by "what makes A1–A15 true."

This plan absorbs and partially supersedes `.indusk/planning/context-budget/` (see brief §Relationship). Canonical home: upstream mechanisms (hook, sweep, auto-archive, sync) are built HERE in dusk; the numero-workbench copy of this plan drives that workbench's consuming-side migration.

## Decision

1. **CLAUDE.md budget + compaction.** Restructure to ≤60 KB: Conventions entries become 1–3 lines (rule sentence + pointer to docs/decision page — the lessons titles-hot/bodies-cold pattern); Current State keeps only live/unmerged items, shipped plans get one line + pointer. A write-time size-budget hook (following the `validate-impl-structure.js` precedent) warns/blocks past budget. A compaction ritual owns decay: demote-on-plan-close (wired into `/retrospective`) plus a periodic pass.
2. **Graphiti + CGC removal.** Drop both MCP servers from all configs, disable/remove the extensions and catchup steps, retire the indusk-infra FalkorDB+Graphiti container. The highlight→eval→lessons rail is preserved: the eval agent's materialization target becomes lessons/retrospective artifacts only (no `graph_capture`). The local-telemetry daemon is untouched — `jaeger` stays in the project MCP config (critical).
3. **Decay for the append-only layers.** `indusk` gains a current.md sweep (archive — never delete — sections older than the stale TTL, protecting Project(shared) and live sessions) and a dead-draft plan auto-archive; both wired into catchup/handoff so they run as part of normal rhythm. Backfill: this workbench's ~30 stale sections and ~90 dead drafts actually swept.
4. **Catchup diet.** Rewrite the catchup skill: no duplicate CLAUDE.md fetch, read only Project(shared) + live current.md sections, list only in-progress plans, no Graphiti step. Target ≤15k tokens.
5. **MCP keep-lists.** Project `.mcp.json`: indusk, dash0, posthog, jaeger. Global `~/.claude.json`: playwright only — context7, chrome-devtools, supabase, tmux, vibe_kanban dropped (context7 explicitly take-or-leave → diet default applies).
6. **Push/pull distribution — InDusk as hub.** Promote flow: a rule proven general moves upstream into InDusk's shared channel (extending `community-*` lessons + skill versioning). Pull flow: projects receive latest rules/skills at catchup time, with an explicit `indusk sync` for on-demand pulls. No daemon, no new interval machinery — catchup is the cadence. (versioned-workbench's later rapid-sync loop composes with, not duplicates, this.)

## Alternatives Considered

### Graphiti as canonical store + beam-default retrieval (context-budget piece 3)
Rejected on field evidence: recall returned generic process entities, was queried ~once per session, and pull-based storage founders on query formulation — the agent doesn't know what it doesn't remember. Push-based curated artifacts (CLAUDE.md rules, lessons) stay canonical.

### Keep CGC with tighter index hygiene
Rejected: near-zero observed reads, Grep/Read substitute adequately, and keeping the index fresh across ~10 drifting worktrees is a standing liability rather than an asset.

### Discipline-only compression (no write-time hook)
Rejected: already tried — context-budget piece 2 shipped one-line retrospective entries and numero's Current State still regrew to ~120 KB. Prose discipline without enforcement doesn't hold; the hook is the ratchet.

### Aggressive truncation/summarization at load time
Rejected: treats the symptom per-session while the canonical files keep growing; loses the guarantee that what's on disk is what agents read.

## Consequences

### Positive
- ~85% fixed-context cut; catchup ~73% cheaper; later compactions; more work per quota window.
- Decay becomes owned: budget hook + compaction ritual + sweeps mean the system tends toward its budget instead of away from it.
- Two fewer infra dependencies (FalkorDB, Graphiti) and their failure modes; simpler onboarding.
- The hub channel turns per-project lessons into fleet-wide rules.

### Negative
- Graphiti episodes accumulated to date become unreachable in-session (bodies remain in the DB until the container is retired; lessons/docs carry the curated survivors).
- Code-graph queries (blast-radius checks) fall back to Grep + tests.
- One-time migration cost across CLAUDE.md, plans, current.md, and configs — plus the same again on numero-workbench.

### Risks
- **Compression drops a load-bearing nuance** → A4's 15-entry sample gate before merge; U1's 2-week repeat-mistake review; any repeat traced to a compressed entry strengthens its rule sentence in place.
- **Eval rail silently breaks when its Graphiti target is removed** → A8 end-to-end smoke is the gate; the rail's known failure mode is silent (see eval-agent-mcp-access history), so the smoke is mandatory, not optional.
- **Sweep eats live state** → A9/A10 adversarial fixtures; sweep archives rather than deletes, so recovery is a file move.

## Documentation Plan

### Pages
- New: `apps/docs/src/decisions/indusk-makeover.md` (this ADR, published)
- New: `apps/docs/src/guide/context-budget.md` (the 60 KB budget, compaction ritual, hook behavior)
- New: `apps/docs/src/reference/cli/sync.md` (promote/pull flows)
- Update: `apps/docs/src/reference/skills/catchup.md` (dieted read set)
- Update: guide pages referencing Graphiti/CGC (removal notices + what replaced them)

### Diagrams
- Mermaid in the context-budget guide: the decay loop (write-hook → compaction ritual → sweep → archive)
- Mermaid in the sync reference: promote/pull flow between a project and the InDusk hub

### Changelog
- "InDusk Makeover: CLAUDE.md 60 KB budget + compaction ritual, Graphiti/CGC removed (lessons rail preserved), current.md sweep + plan auto-archive, catchup diet, hub push/pull rule distribution."

### ADR in Docs
- Yes — `decisions/indusk-makeover.md`, with a supersession note added to context-budget's entry.

## References
- [research.md](research.md) — measured context-cost audit
- [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/context-budget/` — absorbed/superseded (mark at ADR acceptance)
- `.indusk/planning/versioned-workbench/` — sequenced after this plan; composes with the hub sync
- `.indusk/planning/archive/eval-agent-mcp-access/` — the silent-rail failure history motivating A8
