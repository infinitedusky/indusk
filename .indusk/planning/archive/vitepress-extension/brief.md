---
title: "VitePress Excalidraw Embed"
date: 2026-03-26
status: draft
---

# VitePress Excalidraw Embed — Brief

## Problem
Excalidraw diagrams created during sessions are ephemeral — they disappear when the session ends. When an architecture sketch or conceptual diagram is worth keeping in the docs, there's no way to embed it. The document skill currently says "docs = Mermaid only," which means conceptual diagrams either get recreated as Mermaid (losing the hand-drawn style) or don't make it into docs at all.

## Proposed Direction
Add an `<ExcalidrawEmbed>` Vue component to the VitePress docs app. The agent creates a diagram with `create_view`, exports it with `export_to_excalidraw` to get a shareable URL, and embeds it in a docs page with `<ExcalidrawEmbed url="..." />`. Update the VitePress extension skill and document skill to include the Excalidraw embed workflow.

## Context
The VitePress extension already exists (`apps/indusk-mcp/extensions/vitepress/`). The `FullscreenDiagram` component is the established pattern for interactive diagram display (280 lines, pan/zoom, fullscreen modal). The Excalidraw MCP server's `export_to_excalidraw` tool returns shareable URLs that can be iframed. See `research.md` for embedding options and trade-offs.

## Scope

### In Scope
- `<ExcalidrawEmbed>` Vue component in `apps/indusk-docs/src/.vitepress/components/`
- Register component globally in theme (like FullscreenDiagram)
- Responsive iframe, loading state, fullscreen toggle
- Update VitePress extension skill: when/how to use ExcalidrawEmbed
- Update document skill: expand diagram guidance to include Excalidraw embeds for conceptual docs

### Out of Scope
- Saving `.excalidraw` JSON files in the repo (future — version control for diagrams)
- Build-time SVG rendering from Excalidraw files
- Dark mode theme param (investigate later)
- Replacing Mermaid for any existing diagrams

## Success Criteria
- `<ExcalidrawEmbed url="..." />` renders an interactive Excalidraw diagram in VitePress
- Fullscreen toggle works (consistent with FullscreenDiagram UX)
- Agent can create → export → embed in a single session workflow
- Document skill clearly guides when to use Mermaid vs Excalidraw embed
- No breaking changes to existing Mermaid/FullscreenDiagram workflow

## Depends On
- Excalidraw extension (completed)
- VitePress extension (exists)

## Blocks
- None
