---
title: "Graphiti Infrastructure — ADR"
date: 2026-03-27
status: accepted
---

# Graphiti Infrastructure — ADR

## Decision
Integrate the Graphiti temporal knowledge graph engine as indusk-mcp's core context backend. Graphiti runs as a Docker container managed by `init`, connected to the existing FalkorDB instance. indusk-mcp calls Graphiti over MCP as an internal client — the agent never interacts with Graphiti directly.

## Context
indusk-mcp needs a persistent, temporal, contradiction-aware knowledge graph to replace flat file context (CLAUDE.md, lessons, handoff files). Graphiti (by Zep, 14K+ GitHub stars) provides entity extraction, deduplication, contradiction detection, and temporal tracking on FalkorDB. The spike validated that semantic + structural nodes coexist in FalkorDB with 3-15ms query times.

## Decisions

### 1. Graphiti is internal infrastructure, not an extension
**Decision**: Graphiti is a runtime dependency of indusk-mcp, like FalkorDB. Not an extension.

**Rationale**: The context graph isn't optional tooling (like Dash0 or Excalidraw). It's how indusk-mcp operates — the engine behind `context_beam`, episode capture, and knowledge management. Making it an extension would create a bifurcated experience (with/without graph context). Instead, it's core infrastructure that degrades gracefully when unavailable.

**Alternatives rejected**:
- Extension pattern (like Dash0): creates optional complexity, agent needs to know whether to use graph or flat files
- No Graphiti (build from scratch): Graphiti's temporal engine, contradiction detection, and entity resolution are battle-tested. Building custom wastes months.

### 2. LLM provider: Gemini
**Decision**: Use Google Gemini for Graphiti's LLM and embedding calls.

**Rationale**: Free credits available now. Gemini has full first-class support in Graphiti — `GeminiClient`, `GeminiEmbedder`, `GeminiRerankerClient`. Validated working with `gemini-2.5-flash` (LLM) and `gemini-embedding-001` (embeddings). Note: `gemini-2.0-flash` is deprecated for new users, and `text-embedding-001`/`text-embedding-004` don't exist — must use `gemini-embedding-001`. After free credits: Gemini Flash pricing is competitive.

**Alternatives rejected**:
- Anthropic: supported but doesn't route small model calls, ~4x more expensive per session
- OpenAI: cheapest (~$0.19/session) but no free credits, adds another API key dependency

**Migration path**: LLM provider is a config change (`--llm-provider`). Can switch to Anthropic or OpenAI anytime.

### 3. Database: FalkorDB (global shared instance)
**Decision**: Use the existing global FalkorDB instance (`falkordb.orb.local:6379`). One Graphiti MCP server globally. Project isolation via `group_id` per request.

**Rationale**: FalkorDB is already running globally for CGC. The Graphiti MCP server supports per-request `group_id` routing — each project gets its own FalkorDB graph automatically, and search can span multiple group_ids in a single call. This mirrors the brain metaphor: shared knowledge in a central area, project-specific knowledge on branches.

**Graph layout** (FalkorDB, one instance):
- `infinitedusky` — CGC structural graph (code structure)
- `numero` — CGC structural graph (code structure)
- `shared` — Graphiti semantic graph (universal knowledge: conventions, developer preferences, cross-project lessons)
- `infinitedusky` — Graphiti semantic graph (project-specific context)*
- `numero` — Graphiti semantic graph (project-specific context)*

*Note: On FalkorDB, Graphiti creates separate graphs per group_id. CGC and Graphiti graphs with the same name are separate because they're created by different systems with different schemas. This needs validation — if naming collision is an issue, prefix Graphiti graphs: `ctx-infinitedusky`, `ctx-numero`, `ctx-shared`.

**Multi-project knowledge model**:
```
              shared (group_id: "shared")
             (universal conventions, developer
              preferences, cross-project lessons)
                        │
             ┌──────────┼──────────┐
             │          │          │
       infinitedusky  numero   litigraph
       (group_id:     (group_id: (group_id:
        project-       project-   project-
        specific)      specific)  specific)
```

When the agent works on infinitedusky:
- Episodes are written with `group_id: "infinitedusky"`
- Universal lessons are written with `group_id: "shared"`
- Beam queries include `group_ids: ["infinitedusky", "shared"]`
- Cross-project queries can include any combination of group_ids

**Alternatives rejected**:
- Neo4j: heavier, requires separate deployment, no existing infrastructure
- Single graph with property-based namespacing: cleaner long-term but requires custom filtering Graphiti doesn't support natively. Revisit later.
- Per-project Graphiti servers: unnecessary — one server handles all projects via group_id routing
- Kuzu: embedded (no server), less suitable for multi-client access

### 4. Run from source, not Docker image
**Decision**: Run the Graphiti MCP server from the cloned `getzep/graphiti` repo via `uv run`, not from the Docker image.

**Rationale**: The Docker image (`zepai/knowledge-graph-mcp:standalone`) bundles graphiti-core 0.28.2 without the `google-genai` extra, making Gemini unavailable. Running from source with `uv sync` + `uv pip install google-genai` gives us Gemini support. Additionally, the MCP server code needed a patch to pass a Gemini reranker client (the upstream code only creates LLM + embedder clients, not the cross-encoder/reranker).

**Deployment**: Clone `getzep/graphiti` to a known location (e.g., `/opt/graphiti` or managed by `init`), install deps via `uv sync` + `uv pip install google-genai`, run via `uv run --no-sync main.py`. The config file at `config/config.yaml` is mounted/copied from indusk-mcp.

**Upstream contribution opportunity**: The reranker patch (passing `cross_encoder` to `Graphiti()` based on configured LLM provider) should be submitted upstream.

### 5. Integration pattern: MCP client in indusk-mcp
**Decision**: indusk-mcp uses `@modelcontextprotocol/sdk` with `StreamableHTTPClientTransport` to call Graphiti's MCP tools programmatically.

**Rationale**: Graphiti's MCP server exposes tools via Streamable HTTP at port 8000. The MCP SDK provides a clean TypeScript client. indusk-mcp calls `add_memory`, `search_nodes`, `search_memory_facts` behind its own tools. The agent sees `context_beam`, `context_add`, etc. — never Graphiti directly.

**Alternatives rejected**:
- Expose Graphiti MCP server directly to agent: breaks the "indusk owns context" principle
- REST API: Graphiti has no REST API, only MCP
- Python subprocess: adds complexity, harder to manage lifecycle

### 6. Container management: `init` handles lifecycle
**Decision**: `indusk-mcp init` creates and manages the Graphiti container, same pattern as FalkorDB.

**Rationale**: FalkorDB container is already managed by `init` (auto-creates on first run, auto-starts with OrbStack). Same pattern for Graphiti. Composable.env component possible later but not required for the first iteration.

**Container config**:
```
FALKORDB_URI=redis://falkordb.orb.local:6379
FALKORDB_DATABASE=shared
GOOGLE_API_KEY=<from user config>
--llm-provider gemini
--embedder-provider gemini
--database-provider falkordb
```

`FALKORDB_DATABASE=shared` sets the default graph. Per-request `group_id` overrides this for project-specific data. The server defaults to the shared graph when no group_id is specified.

### 7. Graceful degradation
**Decision**: If Graphiti is unavailable, indusk-mcp falls back to flat file context.

**Rationale**: The system must do as well or better than what it replaces. During the transition period (and for projects that don't set up Graphiti), flat files remain functional. `context_beam` returns CLAUDE.md-parsed content when Graphiti is down. Episode capture silently no-ops. Health check reports status.

### 8. Multi-project knowledge architecture
**Decision**: One global Graphiti server. Per-request `group_id` for project isolation. A `shared` group for universal knowledge. Beam queries always include both project-specific and shared group_ids.

**Rationale**: Graphiti's MCP tools accept `group_id` per request and `group_ids` (plural) for search. On FalkorDB, each group_id creates a separate graph — giving us physical isolation between projects with zero config. The `shared` group holds developer preferences, universal conventions, and cross-project lessons. This mirrors human cognition: general knowledge that applies everywhere, plus project-specific knowledge that applies locally.

**How indusk-mcp uses group_id**:
- `addEpisode(body, { group_id: "infinitedusky" })` — project-specific
- `addEpisode(body, { group_id: "shared" })` — universal lesson
- `searchNodes(query, { group_ids: ["infinitedusky", "shared"] })` — beam query
- `searchNodes(query, { group_ids: ["shared"] })` — cross-project query

**What goes where**:
- `shared`: developer preferences, coding conventions, universal lessons, tool knowledge
- `{project}`: file-specific gotchas, project decisions, plan context, architecture knowledge

## Consequences

### Positive
- Temporal, contradiction-aware knowledge graph from day one
- No custom graph engine to build or maintain
- Shared FalkorDB instance — zero new infrastructure
- Gemini free credits — zero LLM cost during development
- Clean MCP-to-MCP integration pattern (TypeScript SDK)
- Graceful degradation preserves existing functionality

### Negative
- New Docker container to manage (Graphiti MCP server)
- amd64 image on Apple Silicon (Rosetta overhead)
- LLM dependency for episode processing (cost after free credits)
- Two graphs to reason about (structural + semantic)
- Graphiti is a moving target (actively developed, API may change)

### Risks
- Graphiti's Gemini client may have edge cases (newer provider, less battle-tested than OpenAI)
- Rosetta emulation could impact Graphiti server performance
- FalkorDB group_id behavior may change in future Graphiti versions
- Episode volume could create unexpected LLM costs if not throttled
