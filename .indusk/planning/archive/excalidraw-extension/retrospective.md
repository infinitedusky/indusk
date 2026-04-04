---
title: "Excalidraw Extension — Retrospective"
date: 2026-03-27
---

# Excalidraw Extension — Retrospective

## What We Set Out to Do
Add Excalidraw as a built-in extension so agents can create hand-drawn diagrams during planning, debugging, and teach mode. Complement Mermaid (formal docs) with Excalidraw (conceptual/informal). The Excalidraw MCP server is remote and free — no auth, no install.

## What Actually Happened
The extension itself was straightforward — manifest, skill, MCP server config. Two phases: extension + skill in Phase 1, document/plan skill updates in Phase 2. Both completed cleanly.

The plan then spawned two follow-on changes that weren't in scope:
1. **Auto-add MCP servers** — `extensions enable excalidraw` now auto-runs `claude mcp add` for no-auth HTTP servers. This was needed because the enable command only printed instructions before, which users skipped.
2. **ExcalidrawEmbed for VitePress** — became a separate plan (vitepress-extension) when Sandy wanted diagrams to persist in docs. This revealed that excalidraw.com doesn't support iframe embedding — the `#json=` URL loads a blank editor in an iframe. We pivoted to `@excalidraw/utils` for server-side SVG rendering.

The Excalidraw MCP server doesn't render in VS Code's Claude Code extension — only in CLI, Claude Desktop, and web. This was discovered during testing and is a limitation of the VS Code extension environment, not something we can fix.

## Getting to Done
- The extension itself was clean — no surprises
- The auto-add MCP feature was an opportunistic improvement that improved the whole extension system
- The ExcalidrawEmbed component went through three iterations: iframe (failed — excalidraw.com blocks iframes), link card (worked but didn't render inline), SVG via `@excalidraw/utils` (current approach, renders shapes but text labels need bound elements fix)
- Text in SVG rendering is still broken — standalone text elements with `containerId` don't render labels inside shapes. Needs the `boundElements` array on the parent shape.

## What We Learned
- excalidraw.com shareable URLs with `#json=` fragments don't work in iframes — the fragment isn't passed to the embedded page
- `@excalidraw/utils` requires `window` — it's browser-only, needs dynamic import in `onMounted`
- The MCP server's `label` shorthand on shapes creates proper text bindings, but manually constructing the JSON for `exportToSvg` requires explicit `boundElements` arrays on containers
- Extensions with no auth can safely auto-install MCP servers during enable — reduces friction significantly

## What We'd Do Differently
- Would have tested the iframe approach before building the full ExcalidrawEmbed component
- Would have saved the raw MCP checkpoint data directly as the `.excalidraw.json` file instead of manually reconstructing the elements — the checkpoint has proper label bindings

## Insights Worth Carrying Forward
- The MCP-created diagram → export → embed pipeline works but needs the proper Excalidraw element format, not a manually reconstructed version
- For future extensions with MCP servers: auto-add for no-auth is the right default, print instructions for auth-required
- VS Code extension chat panel can't render MCP app iframes — this affects any MCP server that renders visual content
