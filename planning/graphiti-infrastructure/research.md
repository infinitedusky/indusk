---
title: "Graphiti Infrastructure — Research"
date: 2026-03-27
status: complete
---

# Graphiti Infrastructure — Research

## MCP Client Integration (TypeScript)

indusk-mcp (TypeScript) connects to Graphiti MCP server using `@modelcontextprotocol/sdk`:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";

const client = new Client({ name: "indusk-mcp", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(
  new URL("http://graphiti.orb.local:8000/mcp/")
);
await client.connect(transport);

// Call tools
await client.callTool({
  name: "add_memory",
  arguments: {
    name: "developer-observation",
    episode_body: "The extension system uses manifests in .indusk/extensions/",
    group_id: "indusk-context",
    source: "text",
    source_description: "developer conversation"
  }
});
```

### Available Tools
| Tool | Purpose |
|------|---------|
| `add_memory` | Ingest an episode (text, JSON, or message) |
| `search_nodes` | Find entities by semantic query |
| `search_memory_facts` | Find facts/relationships by query |
| `get_episodes` | Retrieve recent episodes |
| `get_entity_edge` | Get a specific relationship |
| `delete_entity_edge` | Remove a relationship |
| `delete_episode` | Remove an episode |
| `clear_graph` | Purge all data |
| `get_status` | Health/status check |

## Docker Deployment

### Image Choice
Use `zepai/knowledge-graph-mcp:standalone` (Zep's official image). The `falkordb/graphiti-knowledge-graph-mcp` image is stale (last updated 2025-10-10).

### Container Config
```yaml
services:
  graphiti-mcp:
    image: zepai/knowledge-graph-mcp:standalone
    ports:
      - "8000:8000"
    environment:
      - FALKORDB_URI=redis://falkordb.orb.local:6379
      - FALKORDB_DATABASE=indusk-context
      - GRAPHITI_GROUP_ID=main
      - SEMAPHORE_LIMIT=5
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - GRAPHITI_TELEMETRY_ENABLED=false
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 10s
      timeout: 5s
      retries: 5
```

### Key Details
- **Port**: 8000 (MCP endpoint at `/mcp/`, health at `/health`)
- **Ephemeral**: all data in FalkorDB, no volumes needed
- **amd64 only**: runs under Rosetta on Apple Silicon via OrbStack
- **FalkorDB graph name**: configurable via `FALKORDB_DATABASE` (default: `default_db`)
- **OrbStack DNS**: `falkordb.orb.local` resolves from other OrbStack containers

### CLI Flags for LLM/Embedder Provider
The image supports `--llm-provider` and `--embedder-provider` flags:
- `--llm-provider gemini --embedder-provider gemini`
- `--database-provider falkordb` (default for MCP server)

## LLM Provider: Gemini

### Support
Full first-class support: `GeminiClient`, `GeminiEmbedder`, `GeminiRerankerClient`.
- Default model: `gemini-3-flash-preview`
- Small model: `gemini-2.5-flash-lite` (used for edge resolution — the bulk of calls)
- Embedder: `text-embedding-001`
- Requires: `google-genai>=1.62.0` (included in Docker image)
- Env var: `GOOGLE_API_KEY`

### Gemini vs Other Providers
| Feature | Gemini | OpenAI | Anthropic |
|---------|--------|--------|-----------|
| Small model routing | Yes (`flash-lite`) | Yes (`nano`) | No (single model) |
| Cost (50 eps/session) | Free credits / ~$0.10 | ~$0.19 | ~$0.85 |
| Embedder | Built-in (`text-embedding-001`) | Built-in (`text-embedding-3-small`) | None (needs separate) |
| Reranker | Built-in | Not built-in | Not built-in |

## LLM Cost Analysis

### Calls Per Episode
| Call | ModelSize | Count |
|------|-----------|-------|
| Entity extraction | medium | 1 |
| Node deduplication | medium | 1 |
| Edge/fact extraction | medium | 1 |
| Edge resolution | small | 1 per edge |
| Summary (conditional) | small | 0-1 |

Typical: 5 calls per episode (3 entities, 2 edges).

### Token Consumption
~10K-15K tokens per episode (input-dominated). 50 episodes/session = ~600K input + ~50K output.

### Cost with Gemini Free Credits
$0 during free tier. After: Gemini Flash pricing is competitive with GPT-4.1-mini.

## Database: FalkorDB

### Why FalkorDB
- Already running for CGC (`falkordb.orb.local:6379`)
- MCP server's default and recommended database
- Redis-based, lightweight
- Separate graph name isolates from CGC: `indusk-context` vs `infinitedusky`

### Alternatives
| DB | Status | Notes |
|----|--------|-------|
| FalkorDB | **Chosen** | Already running, MCP server default |
| Neo4j | Supported | Library default, heavier, production-grade |
| Kuzu | Supported | Embedded, no server needed |
| Neptune | Supported | AWS only |

### Co-location
FalkorDB shared instance, two graphs:
- `infinitedusky` — CGC structural graph (read-only reference)
- `indusk-context` — Graphiti semantic graph (living context)

Both on the same FalkorDB container. Graphiti MCP server is a separate ephemeral container.

## Graceful Degradation

If Graphiti is unavailable (container down, no API key):
- `context_beam` falls back to CLAUDE.md parsing (existing `get_context` tool)
- Lessons fall back to flat file reading (existing `list_lessons` tool)
- Episode capture silently no-ops
- Health check reports Graphiti as unhealthy but system continues

## group_id Caveat (FalkorDB)

On FalkorDB, if `group_id` differs from `FALKORDB_DATABASE`, Graphiti creates a **separate graph** per group_id. To keep everything in one graph, `GRAPHITI_GROUP_ID` must match `FALKORDB_DATABASE` or use a single consistent value.

Resolution: use `GRAPHITI_GROUP_ID=main` and `FALKORDB_DATABASE=indusk-context`. All data goes to the `indusk-context` graph.
