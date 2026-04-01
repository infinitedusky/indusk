# Handoff

**Date:** 2026-04-01
**Session:** OTel extension (full plan completed), Dash0 auto-setup, context graph Phase 0, agent-skills-format brief

## What Was Being Worked On
OTel extension plan (`planning/archive/otel-core-skill/`) — all 4 phases completed, retrospected, archived. Also completed context graph Phase 0 (CGC graph rename) and built Dash0 auto-setup for `extensions enable`.

## Where It Stopped
- **OTel plan**: completed, retrospected, archived. indusk-mcp v1.6.1 published with everything. Version bumped to 1.6.5 but not yet published or committed.
- **Context graph (graphiti-infrastructure)**: Phase 0 done (CGC graphs renamed to `cgc-*`). Phase 1 validated (Graphiti works with Gemini on FalkorDB from source) but not formalized — container setup, MCP client, health checks still pending.
- **Dash0 auto-setup**: working — `extensions enable dash0` reads `.env` credentials and runs `claude mcp add`. Composable.env contract created.

## What's Next
1. Commit and publish the 1.6.5 version bump
2. Continue `graphiti-infrastructure` Phase 1 — formalize Graphiti deployment (Docker image vs local)
3. `agent-skills-format` — convert skills to standard Agent Skills format for cross-editor compatibility
4. `mcp-dashboard` — write brief (lower priority)

## Open Issues
- FalkorDB data was lost earlier when container was deleted — recreated with volume mount but data had to be re-indexed. The `--restart unless-stopped` flag is set but if someone does `docker rm falkordb` the data is gone.
- Pre-existing biome nested root config issue blocks `pnpm check` globally
- Graphiti source at `/tmp/graphiti-src/` has a reranker patch that would be lost if `/tmp` is cleaned — needs to be persisted or submitted upstream
- `CLAUDE-NEW.md` exists at root from init runs — can be deleted

## Decisions Made This Session
- **OTel is a fifth gate**: implementation → otel → verify → context → document. Enforced by hooks.
- **Four runtime templates**: Node.js (full SDK), Next.js (server: @vercel/otel + client: OTel Web SDK), React SPA (OTel Web SDK), Python (opentelemetry-distro)
- **Backend-agnostic**: all templates use standard OTLP. Dash0 is preferred but any OTLP backend works.
- **Dash0 MCP endpoint is `api.*` not `ingress.*`**: ingress is for OTLP data, api is for MCP queries
- **`npx --yes` required**: for MCP server commands in `.mcp.json` to avoid interactive prompts in stdio mode
- **Agent Skills format**: plan created to convert all skills to the agentskills.io standard format
- **Composable.env `default` field**: dash0 contract uses `"default": ".env"` to write a non-profile env file for extension setup

## Watch Out For
- `apps/otel-test` and `apps/otel-test-v2` were deleted — they were validation artifacts, not permanent apps
- The OTel gate is now active on ALL feature/refactor impls. Any impl written without `#### Phase N OTel` sections will be blocked by the hook.
- Graphiti needs `google-genai` installed separately after `uv sync` — it's not in the default extras
- Graphiti's `gemini-2.0-flash` model is deprecated. Use `gemini-2.5-flash` for LLM and `gemini-embedding-001` for embeddings.
- jj is co-managing this repo — detached HEAD is normal, use jj commands for version control

## Catchup Status
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
