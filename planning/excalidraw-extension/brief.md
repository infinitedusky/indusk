---
title: "Excalidraw Extension"
date: 2026-03-26
status: draft
---

# Excalidraw Extension — Brief

## Problem
Agents can create Mermaid diagrams for documentation but have no way to produce quick visual sketches during planning, debugging, or teaching. Mermaid is formal and text-based — good for docs, but too rigid for "sketch this architecture on a whiteboard" moments. The Excalidraw MCP server exists and is free, but we haven't integrated it.

## Proposed Direction
Add Excalidraw as a built-in extension with a remote HTTP MCP server (no install required). Create a skill that teaches agents when to use Excalidraw vs Mermaid. Update the document skill to reference Excalidraw as a diagram option for informal/conceptual visuals.

## Context
The Excalidraw MCP server is official, MIT-licensed, and hosted at `https://mcp.excalidraw.com`. It accepts natural language diagram descriptions and produces hand-drawn style visuals. No auth, no config, no npm package — just a URL. See `research.md` for transport options and comparison to Mermaid.

## Scope
### In Scope
- Built-in extension with manifest, skill, and MCP server config
- Skill teaches: when Excalidraw vs Mermaid, how to describe diagrams effectively
- `extensions enable excalidraw` adds the MCP server via `claude mcp add`
- Update document skill to mention Excalidraw for informal diagrams
- Update plan skill to suggest visual sketches during research/brief phases

### Out of Scope
- Local/offline Excalidraw setup
- Exporting Excalidraw to VitePress (future — needs SVG export investigation)
- Replacing Mermaid with Excalidraw
- Auto-detection (this is opt-in, not project-specific)

## Success Criteria
- `extensions enable excalidraw` works and adds the MCP server
- Agent can create diagrams when asked during planning or teaching
- Document skill references Excalidraw for conceptual diagrams
- No breaking changes to existing Mermaid workflow

## Depends On
- Extension system (completed)

## Blocks
- None
