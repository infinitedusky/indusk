---
title: "CodeGraphContext — Structural Knowledge Layer"
date: 2026-03-19
status: accepted
---

# CodeGraphContext — Brief

## Problem

The context skill maintains decision memory in CLAUDE.md — why things were built, what conventions to follow, what mistakes to avoid. But it has no structural memory. When an agent needs to understand how files relate to each other, what calls what, or what would break if a function signature changed, it has to grep around and read files one at a time. This is slow, incomplete, and scales poorly as codebases grow.

In a monorepo like numero (or infinitedusky as it grows), structural understanding is critical. Changing a shared package's interface could break multiple apps. The agent needs to know the blast radius of a change before making it — not discover it after verify fails.

## Proposed Direction

Add CodeGraphContext as the structural knowledge layer, running as a persistent Docker service via composable-env. It indexes the codebase into a queryable graph database and exposes it via MCP, giving the agent instant access to dependency graphs, call chains, and impact analysis.

### What CodeGraphContext Provides

- **Dependency graph** — what imports what, across files and packages
- **Call graph** — what functions call what, how deep
- **Impact analysis** — "if I change this, what breaks?"
- **Architecture queries** — "show me all files that depend on this package" or "what's the boundary between these two apps?"
- **Symbol search** — find definitions, references, and usages across the codebase

### How It Fits Into the System

The development system now has four knowledge layers:

```
1. Context (CLAUDE.md)         — decision memory    — "why we built it this way"
2. Structural (CodeGraphContext) — structural memory  — "how the code connects"
3. Enforcement (Biome)          — quality rules      — "what patterns are allowed"
4. Retrospective                — learning loop      — feeds back into 1, 2, and 3
```

Each layer answers a different question at session start:
- CLAUDE.md: "What should I know about this project?"
- CodeGraphContext: "How is this project actually wired together?"
- Biome: "What am I not allowed to do?"

### Integration Points

**verify skill** — instead of guessing which tests are affected by a change, verify queries the graph. "What test files transitively depend on this module?" gives an exact list. This makes verify faster (run only truly affected tests) and more reliable (never miss an affected test).

**context skill** — when writing a retrospective or updating CLAUDE.md, the agent can pull structural context. "This change touched 4 files across 2 apps and affected 12 downstream consumers" is more useful than "we changed some stuff."

**work skill** — before starting an impl item, the agent can query the graph to understand what it's about to touch. "This function is called by 3 other modules" changes how carefully you approach the change.

**plan skill** — during research, structural queries help scope the work. "How many files would need to change if we migrated from X to Y?" turns a guess into a number.

### Running as a Persistent Service via composable-env

CodeGraphContext needs to persist its graph index across container rebuild cycles. Re-indexing an entire codebase on every `ce start` would be too slow.

This is the first consumer of the `persistent: true` contract option being added to composable-env. The setup:

- A composable-env contract with `persistent: true` and `target` pointing at docker-compose
- Volume mount: the project codebase mounted read-only into the container
- Named volume: the graph database persists across rebuilds
- The container runs the MCP server, Claude Code connects to it alongside the project's own MCP server
- `ce start` leaves it running; only restarts if the contract config changes
- Incremental re-indexing: CodeGraphContext watches for file changes and updates the graph, no full rebuild needed

### Per-Project Instances

Each project gets its own CodeGraphContext instance. When you `claude-skills init` a new project that uses composable-env, it scaffolds the CodeGraphContext contract alongside the skills, CLAUDE.md, and biome.json. The graph is project-scoped — no cross-project contamination.

For projects without composable-env/Docker (simple repos), CodeGraphContext can also run directly as a local process via its CLI mode.

## Scope

### In Scope
- CodeGraphContext as a composable-env persistent service
- Docker contract with volume mounts and named volume for graph persistence
- MCP connection config in `.mcp.json` for Claude Code
- Integration guidance in verify, context, work, and plan skill docs
- Addition to `claude-skills init` for new project scaffolding

### Out of Scope
- Forking or modifying CodeGraphContext itself (use it as-is)
- Building our own graph indexer
- Cross-project graph queries (each project is isolated)
- Visualizing the graph in the brand-site (future enhancement)

## Success Criteria
- Agent can answer "what depends on this file?" in < 2 seconds via MCP query
- verify skill uses graph queries to determine affected tests instead of guessing
- CodeGraphContext persists across `ce start` cycles without re-indexing from scratch
- New project setup via `claude-skills init` includes CodeGraphContext contract scaffolding
- Agent demonstrates measurably better impact awareness when making changes

## References
- GitHub: https://github.com/CodeGraphContext/CodeGraphContext
- Docs: https://codegraphcontext.vercel.app/
- Community Docker image: https://github.com/MekayelAnik/codegraphcontext-mcp-docker

## Depends On
- composable-env `persistent: true` feature — shipped in composable.env 1.8.0
- context-skill (CodeGraphContext is one of the layers context orchestrates) — completed

## Blocks
- Nothing — this is additive
