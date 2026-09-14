---
title: "InDusk Makeover — Context-Cost Audit"
date: 2026-07-23
status: complete
---

# InDusk Makeover — Research

## Question

Where does the per-session token budget actually go, and which layers of the memory/ritual system earn their cost? Driver: the user burns through Claude Max quota primarily on context, and sessions exhaust the context window early.

## Findings

### Measured fixed-context tax (2026-07-23, this workbench)

| Layer | On-disk size | ~Tokens (chars/4) | When paid |
|---|---|---|---|
| CLAUDE.md (project) | 488 KB | ~120k | Injected every session; cache-read every turn |
| — Conventions section | 359 KB | ~90k | append-only since project start |
| — Current State section | 120 KB | ~30k | includes long-shipped/archived plans |
| current.md | 88 KB | ~22k | full read every /catchup (973 lines, ~30 sections, ~0 live) |
| Plans (`list_plans`) | 109 active + 160 archived | ~8k output | every /catchup; most "active" are dead drafts |
| MEMORY.md index | 12 KB | ~3k | every session |
| Lesson titles (111) | 205 KB bodies | ~6k titles only | every /catchup — **correct hot/cold pattern** |
| MCP tool schemas | 6 project + 6 global servers | ~30-60k (non-deferred sessions) | every session |

- Project `.mcp.json`: indusk, codegraphcontext, graphiti, jaeger, dash0, posthog.
- Global (`~/.claude.json`): playwright, context7, tmux, vibe_kanban, chrome-devtools, supabase.

### Consequences of the tax

- A session starts with roughly half a 200k window consumed before any work. Compaction fires earlier; each compaction re-pays the prefix as fresh cache-writes.
- Every new session re-pays the full fixed context as cache-writes (25% premium), then every turn pays cache-reads on it. **Fixed context size is the multiplier on all session cost.**
- /catchup adds ~50-60k on top of the fixed tax, dominated by current.md staleness and dead-draft plan listing.

### Which layers earn their cost (observed usage over many sessions)

- **CLAUDE.md**: the workhorse — ~80% of mid-task knowledge. But value is concentrated in the *rule sentences*; the multi-paragraph narratives duplicate `apps/docs/decisions/*` + archived plan docs.
- **Lessons**: high value at low cost (titles-hot/bodies-cold). The pattern to replicate.
- **Graphiti**: ~1 generic query per session (catchup); recall returns process-narrative entities, rarely actionable. Write side is fire-and-forget via highlight→eval. **Removable; keep the highlight→eval→lessons rail** (lessons are the materialization that pays off).
- **CGC/FalkorDB code graph**: near-zero reads; Grep/Read substitutes; index freshness is a liability across ~10 drifting worktrees. **Removable.**
- **current.md**: Project (shared) section is high-value; per-session sections are ~all stale husks (sessions that never ran `indusk agent done` linger forever — no sweep exists).
- **Nothing in the system ever deletes.** Every layer is append-mostly; no ritual owns decay.

### Existing mechanisms to build on

- `community-*` lessons (18 of 111) already represent cross-project rules — a proto-distribution channel.
- `get_skill_versions` MCP tool exists — versioned skill updates are already a concept upstream.
- `validate-impl-structure.js` hook precedent — write-time enforcement (a CLAUDE.md size-budget hook can follow the same shape).
- `agents.stale_ttl_minutes` config exists for *display* filtering (`indusk agent list`) but nothing sweeps the file.
- Eval agent already runs on sonnet (`eval_model: sonnet`).

## Open Questions

- Does Claude Code truncate very large CLAUDE.md files, or load all 488 KB? (Either way the fix is the same; affects only the size of the win.)
- `jaeger` MCP entry: is it the local-telemetry surface? Keep/drop decided at impl.
- context7 (global): user didn't select it in the keep-list; confirm drop vs keep before editing `~/.claude.json`.
- Push/pull cadence: pull-on-catchup vs explicit `indusk sync` on an interval — decide in ADR.

## Sources

- Live measurements this session (wc/grep on the workbench).
- Catchup transcript 2026-07-23 (session 930b4ac0): Graphiti recall returned July-6 process entities vs CLAUDE.md carrying all operational state.
