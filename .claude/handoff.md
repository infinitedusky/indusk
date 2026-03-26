# Handoff — 2026-03-26

## What was being worked on
indusk-mcp v1.5.1 → v1.5.4. Catchup auto-permissions, extension directory format, Excalidraw extension, Dash0 dataset from composable.env, auto-add MCP servers.

## Where it stopped
- **indusk-mcp v1.5.4**: committed and pushed to PR #10 (graph-tools). NOT published to npm yet.
- **Excalidraw extension**: plan complete (research → brief → ADR → impl). Extension enabled, MCP server added to `.mcp.json`. Excalidraw doesn't render in VS Code extension — works in Claude Desktop, CLI, or web.
- **Extension directory format**: migrated from flat files (`{name}.json`) to directories (`{name}/manifest.json`). Auto-migration on load. All extensions in this repo already migrated.
- **Catchup auto-permissions**: added to `.claude/settings.json` and to `init` command so all projects get them.

## Key decisions made this session
- Extension directories: `{name}/manifest.json` + `.env` instead of flat `{name}.json` — enables per-extension config
- Excalidraw complements Mermaid: informal/conceptual = Excalidraw, formal docs = Mermaid
- No-auth HTTP MCP servers auto-add via `claude mcp add` during `extensions enable`; auth-required servers print setup instructions
- Dash0 dataset should come from composable.env component or `.indusk/extensions/dash0/.env`, not hardcoded
- Catchup MCP tools are read-only and should be auto-allowed in permissions

## Watch out for
- Excalidraw MCP doesn't render in VS Code extension — only CLI, Claude Desktop, web
- `extensions enable` now auto-runs `claude mcp add` for no-auth servers — if `claude` CLI isn't available it falls back to printing the command
- Stale tests: plan-parser and impl-parser tests were updated to reference current plans (gsd-inspired-improvements, gate-policy-enforcement) instead of archived ones
- Pre-existing biome lint issue in `init-docs.ts` (useTemplate) — not from this session

## Active plans (this repo)
| Plan | Status | Next step |
|------|--------|-----------|
| excalidraw-extension | impl completed | Ready for retrospective |
| context-graph | research complete, brief draft | Sandy reviews brief, then spike |
| otel-core-skill | research complete | Write brief |
| mcp-dashboard | research complete | Write brief (lower priority) |
| gsd-inspired-improvements | impl in-progress | Continue work |
| gate-policy-enforcement | impl completed | Ready for retrospective |

## Unpushed/uncommitted work
PR #10 (graph-tools) has everything through v1.5.4. Needs merge and npm publish.

## Catchup Status
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
