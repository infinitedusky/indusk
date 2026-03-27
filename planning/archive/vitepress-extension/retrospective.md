---
title: "VitePress Excalidraw Embed — Retrospective"
date: 2026-03-27
---

# VitePress Excalidraw Embed — Retrospective

## What We Set Out to Do
Add an `<ExcalidrawEmbed>` component to VitePress so Excalidraw diagrams could persist in docs as interactive visuals. The component would wrap the FullscreenDiagram pattern.

## What Actually Happened
Three iterations:

1. **iframe with excalidraw.com URL** — The `export_to_excalidraw` tool returns a shareable URL. We built an iframe component and embedded it. The iframe loaded excalidraw.com but showed a blank editor with an infinite loading spinner — the `#json=` URL fragment isn't passed to iframed pages.

2. **Link card** — Pivoted to a clickable card that opens the diagram in a new tab. Works, but doesn't render the diagram inline — defeats the purpose.

3. **`@excalidraw/utils` SVG rendering** — Added the package to indusk-docs. The component fetches a `.excalidraw.json` file from `public/diagrams/`, calls `exportToSvg`, and injects the SVG into the DOM wrapped in `<FullscreenDiagram>`. Shapes render but text labels inside rectangles are missing — the JSON needs `boundElements` arrays on container shapes for text binding to work.

The component works for shapes and standalone text. The label-in-rectangle issue is a data format problem, not a component problem.

## Getting to Done
- Added `@excalidraw/utils` as a dependency to indusk-docs
- Added `@excalidraw/utils` to Vite SSR `noExternal` config
- The component uses dynamic import in `onMounted` to avoid SSR issues (`@excalidraw/utils` requires `window`)
- Diagram JSON files live in `public/diagrams/` — version controlled, served as static assets
- Created the architecture diagram JSON manually from MCP checkpoint data — this is where the text binding broke

## What We Learned
- `@excalidraw/utils` is browser-only — needs dynamic import, can't be used in SSR
- The Excalidraw element format distinguishes between standalone text and bound text (container labels). `exportToSvg` only renders bound text when the container has a `boundElements` array pointing to the text element, AND the text has a `containerId` pointing back.
- The MCP server's `label` shorthand creates proper bidirectional bindings. When manually constructing JSON, you need both directions.

## What We'd Do Differently
- Save the MCP server's raw checkpoint data directly instead of manually reconstructing elements — the checkpoint has proper bindings
- Test the iframe approach with a quick prototype before building the full component
- Would have researched `@excalidraw/utils` API before committing to the iframe approach

## Insights Worth Carrying Forward
- For diagram JSON: always use the MCP checkpoint data directly, never manually reconstruct
- VitePress components that need browser APIs: dynamic import in `onMounted`, add to Vite SSR `noExternal`
- The FullscreenDiagram component is a good wrapper for any rendered SVG content, not just Mermaid
