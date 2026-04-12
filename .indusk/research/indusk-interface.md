---
title: "InDusk Interface — Beyond Code Editors"
date: 2026-04-15
status: notes
---

# InDusk Interface — Research Notes

## Idea

Two related problems that might converge into one solution:

### 1. Installation Complexity

InDusk today requires: Claude Code, pnpm, Node 22, Docker/OrbStack, pipx for CGC, MCP server configs in .mcp.json, Claude Code hooks, skills installed via init, Graphiti container, FalkorDB, Google API key for Gemini embeddings. That's a lot of moving parts. Each one is a failure point during setup.

A custom VS Code fork (or extension pack) could bundle all of this — install one thing, everything works. Similar to how Cursor is a VS Code fork with AI built in, InDusk could be a VS Code fork with the dev system built in.

### 2. Non-Code-Forward Interface

The current interface is a code editor with a chat panel. But much of what InDusk does isn't code — it's planning, reviewing plans, tracking progress, visualizing the knowledge graph, browsing eval results, searching past sessions. These activities are better served by:

- A Kanban view where plans are cards and phases are columns
- A graph visualization showing how files, concepts, and decisions connect
- A timeline of sessions with searchable transcripts
- An eval dashboard showing quality trends
- A visual plan builder (connects to the visual planning research)

This isn't "a dev tool that augments Claude Code" — it's "a project management tool where AI agents do the work and code is one of several outputs."

## Spectrum of Options

| Option | Effort | Reach | Control |
|--------|--------|-------|---------|
| VS Code extension pack | Low | High (VS Code users) | Low (limited to VS Code APIs) |
| VS Code fork (like Cursor) | High | High | High (full control) |
| Standalone web app + Claude Code CLI | Medium | Medium | High |
| Electron app wrapping Claude Code | Medium | Medium | Medium |
| VS Code extension with custom webview panels | Medium | High | Medium |

## Key Questions

- Is the installation problem big enough to justify a fork, or would a better `init` command solve it?
- Who is the target user? Developers who live in VS Code? Non-technical project managers? Both?
- Would a web-based Kanban/planning interface that orchestrates Claude Code sessions in the background be more valuable than a code editor fork?
- How does Claude Code's own evolution affect this? If Anthropic adds planning views, graph visualization, etc., does the custom interface become redundant?
- Could this be a Progressive Web App that talks to a local InDusk daemon (connecting to the Hermes Agent research — persistent background process)?

## Related Plans

- dusk-v2 — major rewrite, could include interface decisions
- mcp-orchestration-layer — the orchestration layer could serve a web interface as easily as it serves Claude Code
- complementary-personas — a visual interface could show persona perspectives side by side
- hermes-inspired-improvements — transcript search results need a good browsing UI eventually
