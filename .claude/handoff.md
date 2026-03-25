# Handoff — 2026-03-25

## What was being worked on
Major indusk-mcp development session spanning v1.0.0 through v1.5.0. Extension system, Dash0 integration, CGC improvements, context graph research.

## Where it stopped
- **Context graph plan**: research complete (4 docs), brief written (draft, needs Sandy's review). Next step: Sandy reviews brief, then spike.
- **OTEL core skill plan**: research written, needs brief.
- **indusk-mcp v1.5.0**: published. Uses `claude mcp add` for server setup, `.mcp.json` gitignored, init copies extension skills on `--force`.
- **PR #10 (graph-tools)**: open on GitHub, has all commits from v1.1.0 through research docs. Needs merge.
- **This repo's code graph**: NOT indexed. FalkorDB is running but CGC indexing kept failing (exit 137 in background, broken pipe with SCIP enabled). Run manually: `DATABASE_TYPE=falkordb-remote FALKORDB_HOST=falkordb.orb.local FALKORDB_GRAPH_NAME=infinitedusky SCIP_INDEXER=false cgc index --force .`

## Key decisions made this session
- Extensions use `claude mcp add` for MCP server setup, never write `.mcp.json` directly
- `.mcp.json` should be gitignored (contains auth tokens)
- Dash0 MCP server is type `http` (not `streamable-http` or `streamableHttp`)
- Context graph direction: integrate CGC + Graphiti on shared FalkorDB, don't build from scratch
- OTEL should be a core skill (like plan, work, verify), not an extension
- The context graph is a **layer** alongside traditional context (skills, lessons, CLAUDE.md), not a replacement

## Watch out for
- SCIP_INDEXER causes broken pipe errors during indexing on this repo — disable it (`SCIP_INDEXER=false`)
- `init --force` now runs `claude mcp add` which can fail if Claude Code CLI isn't available in the npx context
- Graphiti MCP server needs an LLM API key (OpenAI default, Anthropic supported) for contradiction detection
- numero's `.mcp.json` was clobbered by `init --force` in an earlier version — the fix is in v1.5.0 but check it

## Active plans (this repo)
| Plan | Status | Next step |
|------|--------|-----------|
| context-graph | research complete, brief draft | Sandy reviews brief, then spike |
| otel-core-skill | research complete | Write brief |
| mcp-dashboard | research complete | Write brief (lower priority) |
| gsd-inspired-improvements | impl in-progress | Continue work |
| gate-policy-enforcement | brief written | Needs ADR + impl |

## Unpushed/uncommitted work
PR #10 (graph-tools) is open and has everything. Merge it.

## Catchup Status
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
