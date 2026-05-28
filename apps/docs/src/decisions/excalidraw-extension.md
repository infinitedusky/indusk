---
title: Excalidraw Extension
---

# Excalidraw Extension

**Decision:** Add Excalidraw as a built-in extension using the official remote MCP server at `https://mcp.excalidraw.com`. Complements Mermaid — hand-drawn style for conceptual/informal diagrams, Mermaid for formal docs.

**Why:** Agents need a way to create quick visual sketches during planning, debugging, and teach mode. Mermaid is too formal for "sketch this architecture" moments.

**Tradeoffs:**
- Depends on remote server availability — no offline fallback
- Diagrams are ephemeral in-session unless exported via `export_to_excalidraw`
- VS Code extension can't render MCP app iframes — only works in CLI, Claude Desktop, web

**Key details:**
- No auth, no install — `extensions enable excalidraw` auto-adds the MCP server
- Skill teaches when to use Excalidraw vs Mermaid (decision guide table)
- For persistent docs, use `<ExcalidrawEmbed>` with `@excalidraw/utils` SVG rendering

Full ADR: `planning/archive/excalidraw-extension/adr.md`
