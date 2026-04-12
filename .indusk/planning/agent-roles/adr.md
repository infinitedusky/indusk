---
title: "Agent Roles — Define and Enforce Role Boundaries"
date: 2026-04-15
status: accepted
---

# Agent Roles

## Y-Statement

In the context of **a growing InDusk system with multiple planned capabilities (transcript search, knowledge graph improvements, LSP indexing, MCP orchestration, personas)**,
facing **undefined role boundaries where the working agent writes to Graphiti directly and the eval agent's responsibilities keep expanding**,
we decided for **a three-tier role model (working agent, eval agent, infrastructure) with a highlights queue as the interface between working and eval agents**
and against **eval agent as sole graph writer reading only from transcripts, and against the working agent writing structured data directly to Graphiti**,
to achieve **clean separation of concerns where each agent does what it's best at — the working agent captures intent in real time, the eval agent writes structured knowledge with full context**,
accepting **a slight delay between when something happens and when it appears as structured knowledge in Graphiti (until next `jj describe`)**,
because **the working agent shouldn't slow down to think about graph structure, the eval agent has the best vantage point (full transcript + highlights + diff) to write high-quality structured data, and highlights ensure nothing important is missed**.

## Context

The InDusk system currently has two agents and an infrastructure layer, but responsibilities were assigned organically. The working agent writes directly to Graphiti via `graph_capture` in planner/work/retro skills. The eval agent scores commits and writes findings. Multiple planned features (transcript search, graph-knowledge-architecture, LSP indexing, MCP orchestration, personas) add new responsibilities with no clear ownership model.

Key insight from planning: the working agent shouldn't write structured data to Graphiti because (a) it slows down the interactive session, (b) the working agent isn't thinking about entity types and relationships, and (c) having two writers (working + eval) produces inconsistent graph structure. But the eval agent can't rely solely on the transcript because important moments might be buried in noise.

Solution: the working agent writes lightweight **highlights** — flags that say "this moment matters" — and the eval agent reads both the full transcript and the highlights to produce structured knowledge.

## Decision

### Role Definitions

**Working Agent** (the Claude Code session the user interacts with)
- Execution model: interactive session, lives as long as the user is working
- **Owns:** code changes, plan execution, skill invocation, user interaction, CLAUDE.md context updates, handoff, auto-memory
- **Reads:** everything — code, graph, transcripts, context, highlights
- **Writes:** code, plan documents, handoff, CLAUDE.md, auto-memory, **highlights**
- **Does NOT write:** Graphiti episodes, eval scorecards, structured graph data
- Principle: **move fast, capture intent, don't think about graph structure**

**Eval Agent** (fires on `jj describe`)
- Execution model: persistent via `claude --resume`, fires on every `jj describe`
- **Owns:** quality assessment, structured knowledge capture, graph writes
- **Reads:** full transcript, highlights, diff, code graph, Graphiti, codebase
- **Writes:** eval scorecards, findings, **all Graphiti episodes** (structured), processed-highlights log
- **Does NOT write:** code, plan documents, CLAUDE.md, handoff
- Principle: **take the time to write high-quality structured knowledge with proper entity types and relationships**

**Infrastructure** (not an agent — hooks, CLI commands, MCP tools)
- **Owns:** gate enforcement, index maintenance, health checks, plan ordering
- **Examples:** transcript indexing (FTS5), graph rebuild/sync, hook enforcement, `check-plan-order.js`
- **Triggered by:** CLI commands, catchup steps, hooks
- Principle: **maintenance tasks that don't require agent intelligence**

### The Highlights Queue

The interface between working agent and eval agent. Simple, append-only, idempotent.

**Working agent writes highlights** at key moments:
- Brief accepted
- ADR accepted
- Correction ("user said X was wrong because Y")
- Retro lesson learned
- Any moment the user explicitly flags (`/highlight ...`)

**Format:** Append-only JSONL at `.indusk/highlights.jsonl`

```jsonl
{"id": "h-20260415-001", "timestamp": "2026-04-15T10:23:00Z", "level": "critical", "tag": "brief-accepted", "note": "hermes-inspired-improvements brief accepted — FTS5 search over existing Claude Code transcripts"}
{"id": "h-20260415-002", "timestamp": "2026-04-15T10:45:00Z", "level": "important", "tag": "correction", "note": "transcript search is additive to Graphiti, not a replacement"}
{"id": "h-20260415-003", "timestamp": "2026-04-15T11:15:00Z", "level": "note", "tag": "observation", "note": "user prefers to define roles before building infrastructure"}
```

**Levels:**
- **`critical`** — changed project direction, architectural decision, ADR acceptance. Eval agent must extract full context and write structured episode. (brief-accepted, adr-accepted, major correction)
- **`important`** — significant but not directional. Correction, lesson learned, pattern identified. Eval agent should extract and write if there's substance. (correction, retro-lesson, pattern)
- **`note`** — FYI, might be useful context. Eval agent considers during transcript analysis but may skip if it's already captured or not substantial enough. (observation, preference, minor decision)

**Levels map to graph edge weights.** When the eval agent writes to Graphiti, the highlight level determines the weight on the resulting edges:
- `critical` → high weight (e.g., 1.0)
- `important` → medium weight (e.g., 0.6)
- `note` → low weight (e.g., 0.3)

The beam's distance-based decay queries already use `COALESCE` for optional weights. This gives those weights real signal — a critical architectural decision about auth ranks higher in beam results than a passing observation about naming. Weight propagates through the graph and shapes what context gets delivered to the working agent.

**Eval agent processes highlights:**
- Reads `highlights.jsonl`
- Reads `highlights-processed.jsonl` (tracks which IDs are done)
- For each unprocessed highlight: reads the full transcript around that timestamp for context, extracts structured entities and relationships, writes to Graphiti
- Marks the highlight as processed regardless of outcome (idempotent — never processes twice)
- The eval agent also reads the full transcript independently and can find important things the working agent didn't highlight

**`highlights-processed.jsonl`:**
```jsonl
{"id": "h-20260415-001", "processedAt": "2026-04-15T10:30:00Z", "action": "wrote-episode", "episodeName": "brief-accepted-hermes-inspired-improvements"}
{"id": "h-20260415-002", "processedAt": "2026-04-15T10:30:00Z", "action": "skipped", "reason": "already captured in transcript analysis"}
```

### Audit Results

| What | Current Owner | New Owner | Change |
|------|--------------|-----------|--------|
| Graphiti episodes (brief/ADR) | Working agent (planner skill via `graph_capture`) | Eval agent (from highlights) | Working agent writes highlight instead of `graph_capture` |
| Graphiti episodes (corrections) | Working agent (work skill via `graph_capture`) | Eval agent (from highlights) | Working agent writes highlight instead of `graph_capture` |
| Graphiti episodes (retro lessons) | Working agent (retro skill via `graph_capture`) | Eval agent (from highlights) | Working agent writes highlight instead of `graph_capture` |
| Eval scorecards | Eval agent | Eval agent | No change |
| Eval findings → Graphiti | Eval agent | Eval agent | No change |
| CLAUDE.md context updates | Working agent (context skill) | Working agent | No change |
| Handoff | Working agent (handoff skill) | Working agent | No change |
| Auto-memory | Working agent (Claude Code built-in) | Working agent | No change |
| Semantic graph event log | Working agent (`graph_capture`) | Eval agent | Moves with Graphiti writes |
| Transcript indexing | Nobody | Infrastructure | CLI command, called by catchup and optionally by eval agent |
| Triage/routing | Nobody | Working agent | Lightweight convention in CLAUDE.md |
| MCP request logging | Nobody | Infrastructure | Logging layer in MCP orchestration (future plan) |
| Highlights | N/A (new) | Working agent writes, eval agent reads | New interface between agents |

### Eval Agent Execution Model

**Decision: `claude --resume` is sufficient, with one addition.**

The eval agent's responsibilities after this plan:
1. Score commit quality (existing)
2. Read highlights and write structured Graphiti episodes (new)
3. Process transcript for additional insights beyond highlights (existing, enhanced)

All of these fire on `jj describe`, which is the natural commit point. The eval agent doesn't need to be a daemon — it does its work at commit time and stops.

**One addition:** the eval agent should also fire at session end (when `/handoff` runs) to process any remaining highlights that weren't followed by a commit. This is a second trigger point for the same `claude --resume` session, not a new agent.

Future responsibilities (from downstream plans) that also fit the `jj describe` trigger:
- LSP structural indexing (query document symbols for changed files — fires at commit)
- Type edge extraction (query type hierarchy — fires at commit)
- Graph enrichment (cross-reference concepts — fires at commit)

None of these require a daemon. They all naturally fire at commit time.

### What Changes in Code

1. **Planner skill:** Replace `graph_capture` calls with highlight writes
2. **Work skill:** Replace `graph_capture` on corrections with highlight writes
3. **Retrospective skill:** Replace `graph_capture` on lessons with highlight writes
4. **Eval agent prompt:** Add "read highlights.jsonl, process unprocessed entries alongside transcript analysis"
5. **New utility:** `writeHighlight(tag, note)` function in indusk-mcp for skills to call
6. **New utility:** `readUnprocessedHighlights()` and `markProcessed(id)` for eval agent
7. **Handoff skill:** Trigger eval agent at session end (in addition to `jj describe`)
8. **CLAUDE.md:** Document the role definitions

## Alternatives Considered

### Eval agent as sole writer, reading only from transcripts
Proposed in graph-knowledge-architecture brief. The eval agent infers everything from the transcript — no explicit signals from the working agent.

**Why rejected:** Important moments can be buried in long transcripts. The eval agent might miss a brief acceptance in a 500-message session. Highlights solve this without making the working agent write structured data.

### Working agent writes structured Graphiti episodes directly
Current behavior. The working agent calls `graph_capture` with episode content.

**Why rejected:** Two writers (working + eval) produce inconsistent graph structure. The working agent isn't thinking about entity types and relationships — it's thinking about code. And the writes slow down the interactive session.

### Separate agents per responsibility
Split eval into: quality-scorer, graph-writer, structure-indexer.

**Why rejected:** Overhead of multiple `claude --resume` sessions, each needing catchup. One eval agent with a clear checklist (score → process highlights → analyze transcript → index structure) is simpler and the work is naturally sequential.

## Consequences

### Positive
- Clean role separation — each agent does what it's best at
- Working agent is faster (highlight write vs `graph_capture` + Graphiti API call)
- Graph data quality improves (one writer, consistent structure, full context)
- Clear ownership for every write operation
- Downstream plans have a defined role model to reference

### Negative
- Slight delay between event and structured knowledge appearing in Graphiti (until next `jj describe`)
- Highlights not followed by a commit need the session-end trigger to be processed
- The eval agent's prompt gets more complex (score + highlights + transcript + structure)

### Risks
- Eval agent context window pressure — reading transcript + highlights + diff + codebase is a lot. Mitigation: the eval agent can process highlights first (small), then transcript analysis (selective), then structural indexing.
- Highlights file grows indefinitely. Mitigation: processed highlights can be archived periodically (infrastructure task).

## References
- `.indusk/planning/agent-roles/brief.md`
- `.indusk/planning/graph-knowledge-architecture/brief.md` — original "eval as sole writer" proposal
- `.indusk/planning/hermes-inspired-improvements/research.md` — Hermes memory architecture analysis
- `/tmp/hermes-agent/agent/memory_manager.py` — Hermes MemoryProvider lifecycle hooks (prefetch, sync, on_pre_compress)
