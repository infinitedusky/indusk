---
title: "CodeGraphContext — Structural Knowledge Layer"
date: 2026-03-19
status: completed
---

# CodeGraphContext

## Goal

Set up CodeGraphContext as a structural knowledge layer, giving the agent instant understanding of codebase relationships via MCP tools. FalkorDB runs as a global Docker container (shared across projects, per-project graph names), CGC is installed locally via pipx, and Claude Code connects via MCP.

## Scope

### In Scope
- Global FalkorDB container (auto-restarts with OrbStack)
- CGC installed locally via pipx
- MCP connection config for Claude Code (`.mcp.json`)
- `.cgcignore` to exclude build artifacts
- Initial indexing of the codebase
- Integration guidance in skill docs

### Out of Scope
- Modifying CodeGraphContext itself
- Cross-project graph queries
- Visualizing the graph in brand-site

## Checklist

### Phase 1: Infrastructure setup

Architecture changed significantly from original plan. Neo4j replaced with FalkorDB (CGC's native backend). Docker-per-project replaced with global FalkorDB + local CGC.

- [x] Explored composable-env persistent contracts with Neo4j — worked but architecture was wrong
- [x] Discovered CGC uses FalkorDB natively, not Neo4j
- [x] Discovered CGC is a lightweight CLI (stdio MCP) — doesn't need to be containerized
- [x] Set up global FalkorDB container: `docker run -d --name falkordb --restart unless-stopped -p 6379:6379 -v falkordb-global:/data falkordb/falkordb:latest`
- [x] Installed CGC locally via pipx: `pipx install codegraphcontext`
- [x] Removed per-project Neo4j/CGC contracts and components from composable-env

#### Phase 1 Verification
- [x] `docker ps --filter name=falkordb` shows container running
- [x] `cgc --version` returns `CodeGraphContext 0.3.1`
- [x] `pnpm env:build` succeeds without FalkorDB/CGC contracts

#### Phase 1 Context
- [x] Add to Architecture: FalkorDB as global Docker container, CGC installed via pipx

### Phase 2: Connect Claude Code via MCP and index

- [x] Added CGC MCP server config to `.mcp.json` with `FALKORDB_HOST=localhost`, `FALKORDB_PORT=6379`, `FALKORDB_GRAPH_NAME=infinitedusky`
- [x] Created `.cgcignore` to exclude `.next/`, `node_modules/`, `dist/`, `planning/`, images, generated files
- [x] Indexed codebase via `add_code_to_graph` MCP tool
- [x] First index included `.next/` build artifacts (81 files, 9723 functions) — deleted and re-indexed
- [x] Clean re-index: 10 files, 1 function, 3 seconds
- [x] Set up directory watch for live updates

#### Phase 2 Verification
- [x] `list_indexed_repositories` returns the project
- [x] `get_repository_stats` shows 10 files, 1 function (clean, no build artifacts)
- [x] CGC tools appear in Claude Code's available tools

#### Phase 2 Context
- [x] Add to Architecture: CodeGraphContext connected as MCP server for structural queries
- [x] Add to Conventions: create `.cgcignore` in new projects to exclude build artifacts

### Phase 3: Add integration guidance to skills

- [x] Update `.claude/skills/plan/SKILL.md`: query the code graph during research to understand structural landscape and scope work
- [x] Update `.claude/skills/work/SKILL.md`: query dependencies before modifying files, flag blast radius for widely-imported code
- [x] Update `.claude/skills/verify/SKILL.md`: use the graph to find affected test files instead of guessing
- [x] Update `.claude/skills/context/SKILL.md`: use graph stats in retrospectives for factual analysis

#### Phase 3 Verification
- [x] All four skill files reference CodeGraphContext tools where relevant
- [x] Cross-read skills — guidance is consistent and non-contradictory

#### Phase 3 Context
- [x] Update Current State in CLAUDE.md: codegraph-context impl completed
- [x] Add to Conventions: "Before touching shared code, query the graph to understand blast radius"

## Files Affected

| File | Change |
|------|--------|
| `.mcp.json` | Add CGC MCP server connection with FalkorDB config |
| `.cgcignore` | Create — exclude build artifacts, deps, non-code files |
| `.claude/skills/plan/SKILL.md` | Add structural scoping guidance |
| `.claude/skills/work/SKILL.md` | Add impact awareness guidance |
| `.claude/skills/verify/SKILL.md` | Add graph-based test discovery |
| `.claude/skills/context/SKILL.md` | Add structural context for retros |
| `CLAUDE.md` | Context updates per phase |

## Dependencies
- Docker / OrbStack running locally
- FalkorDB global container running (`docker ps --filter name=falkordb`)
- CGC installed via pipx (`cgc --version`)

## Notes
- Architecture diverged significantly from original plan. Original assumed Neo4j + Docker-per-project. Actual: FalkorDB global + CGC local via pipx. This is simpler and avoids port conflicts across projects.
- Per-project isolation is via `FALKORDB_GRAPH_NAME` in `.mcp.json`, not separate containers.
- `.cgcignore` is critical — without it, CGC indexes `.next/` build output and inflates the graph by 100x.
