---
title: VitePress Excalidraw Embed
---

# VitePress Excalidraw Embed

**Decision:** Use `@excalidraw/utils` `exportToSvg` for client-side SVG rendering of Excalidraw diagrams in VitePress, wrapped in `<FullscreenDiagram>` for pan/zoom. Rejected iframe embedding (excalidraw.com blocks it) and full React component (too heavy).

**Why:** Excalidraw diagrams created during sessions are ephemeral. Persisting them in docs requires inline rendering — a link to excalidraw.com isn't good enough.

**How it works:**
1. Save `.excalidraw.json` files in `public/diagrams/`
2. `<ExcalidrawEmbed src="/diagrams/name.excalidraw.json" />` fetches and renders SVG
3. Wrapped in `<FullscreenDiagram>` for consistent pan/zoom UX

**Tradeoffs:**
- Adds `@excalidraw/utils` dependency to indusk-docs
- Browser-only rendering (dynamic import in `onMounted`)
- JSON files don't diff as cleanly as Mermaid text
- Text labels need proper `boundElements` bindings to render inside shapes

Full ADR: `planning/archive/vitepress-extension/adr.md`
