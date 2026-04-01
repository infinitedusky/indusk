# Handoff

**Date:** 2026-03-30
**Session:** Context graph Plan 1 execution — Phase 0 complete, Graphiti validated with Gemini

## What Was Being Worked On
Plan 1: graphiti-infrastructure (`planning/graphiti-infrastructure/impl.md`), status: in-progress.

## Where It Stopped
- **Phase 0 (CGC Graph Naming): COMPLETE** — all 4 gates done
  - Graphs renamed in FalkorDB: `cgc-infinitedusky`, `cgc-numero`, etc.
  - Code updated: `getCgcGraphName()` helper in `graph-tools.ts`, `init.ts` uses `cgc-` prefix
  - `.mcp.json` updated, CLAUDE.md gotcha added, docs page updated
- **Phase 1 (Graphiti Setup): VALIDATED but not formalized**
  - Full Graphiti pipeline proven working with Gemini
  - Episode → entity extraction (7 entities) → fact creation (6 facts) → embedding → semantic search
  - Working models: `gemini-2.5-flash` (LLM), `gemini-embedding-001` (embeddings)
  - Needed patch: MCP server doesn't pass `cross_encoder` to `Graphiti()` — added Gemini reranker
  - Test server was at `/tmp/graphiti-src/mcp_server/` — killed and cleaned up
  - Deployment approach (Docker vs local) still TBD

## What's Next
1. Decide Graphiti deployment (custom Docker image with google-genai, or local process)
2. Formalize Phase 1: check off impl items, run gates
3. Phase 2: Build `graphiti-client.ts` MCP client wrapper in indusk-mcp
4. Phases 3-5: health checks, init integration, end-to-end validation

## Open Issues
- `/tmp/graphiti-src/` needs re-clone next session (or move to permanent location)
- The reranker patch lives only in `/tmp/` — needs to be persisted somewhere
- CGC MCP server needs restart to pick up `cgc-infinitedusky` graph name
- Code changes (graph-tools.ts, init.ts) are uncommitted
- Pre-existing biome nested root config issue blocks `pnpm check` globally

## Decisions Made This Session
- **CGC graphs use `cgc-` prefix**: clears namespace for Graphiti semantic graphs
- **Gemini works with Graphiti**: `gemini-2.5-flash` + `gemini-embedding-001`. Deprecated: `gemini-2.0-flash`. Nonexistent: `text-embedding-001`, `text-embedding-004`.
- **Docker image lacks Gemini**: `zepai/knowledge-graph-mcp:standalone` doesn't include `google-genai` extra. Need custom image or local run.
- **MCP server needs reranker patch**: upstream doesn't create cross_encoder for non-OpenAI providers.
- **GOOGLE_API_KEY**: sourced from `env/.env.secrets.shared` as `GEMINI_API_KEY`
- **Graph naming**: `cgc-{project}` for structural, `{project}` for semantic, `shared` for universal

## Watch Out For
- Config with correct model names is at `docker/graphiti-config.yaml`
- FalkorDB should show only `cgc-*` graphs. Bare project names = stale data or unrestarted CGC server.
- `google-genai>=1.62.0` must be installed separately after `uv sync`

## Catchup Status
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
