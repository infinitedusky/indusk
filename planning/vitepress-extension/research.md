---
title: "VitePress Excalidraw Embed"
date: 2026-03-26
status: complete
---

# VitePress Excalidraw Embed — Research

## Question
How should we embed Excalidraw diagrams in VitePress docs so they're persistent, interactive, and version-friendly?

## What Already Exists

### VitePress Extension
A VitePress extension already exists at `apps/indusk-mcp/extensions/vitepress/` with manifest + skill. It teaches Mermaid patterns, sidebar config, frontmatter, and the FullscreenDiagram component. Auto-detects via `vitepress` dependency.

### FullscreenDiagram Component
`apps/indusk-docs/src/.vitepress/components/FullscreenDiagram.vue` (280 lines). Wraps Mermaid diagrams with inline display + expand-to-fullscreen modal with pan/zoom via `panzoom`. Registered globally in the theme.

### Document Skill
Already has Mermaid vs Excalidraw guidance: "If it goes in the docs site, use Mermaid. If it's for in-session communication, use Excalidraw."

## Findings

### Excalidraw MCP Export
The `export_to_excalidraw` tool uploads a diagram to excalidraw.com and returns a shareable URL. This URL can be embedded as an iframe.

### Embedding Options

**Option A: iframe embed with shareable URL**
```html
<iframe src="https://excalidraw.com/#json=..." width="100%" height="500" style="border:none" />
```
- Pros: interactive (pan, zoom, edit), auto-updates if Excalidraw link is updated
- Cons: depends on excalidraw.com availability, URL contains the full diagram data (long URLs), not version-controlled

**Option B: Save `.excalidraw` files, use @excalidraw/utils to render SVG**
```
npm install @excalidraw/utils
```
Build-time render `.excalidraw` JSON → SVG, embed as image. Like Mermaid's text→diagram pipeline.
- Pros: version-controlled, no external dependency at runtime, diffs in git (JSON)
- Cons: requires build-time rendering, loses interactivity, adds a dependency

**Option C: Hybrid — `.excalidraw` file + iframe viewer**
Save the `.excalidraw` JSON file in the repo. A VitePress component loads it and renders via the Excalidraw React component or a lightweight viewer.
- Pros: version-controlled AND interactive
- Cons: heavy dependency (@excalidraw/excalidraw is ~2MB), SSR complications with Vue/React mix

**Option D: iframe embed with `.excalidraw` file URL (simplest)**
Save `.excalidraw` files in the repo. The embed component generates an excalidraw.com URL from the file content at build time.
- Pros: version-controlled source, interactive viewer, no heavy runtime dep
- Cons: still depends on excalidraw.com for rendering

### Recommendation
**Option A for now** (iframe with shareable URL). It's the simplest, requires only a Vue component, and leverages `export_to_excalidraw` directly. If we later want version control, we move to Option D by saving the JSON files and generating URLs at build time.

### ExcalidrawEmbed Component Design
Similar to FullscreenDiagram but for iframes:

```vue
<ExcalidrawEmbed url="https://excalidraw.com/#json=..." title="Architecture Overview" />
```

Features:
- Responsive iframe with configurable height
- Loading state while iframe loads
- Fullscreen toggle (like FullscreenDiagram)
- Dark mode support (Excalidraw has a dark theme URL param)
- Fallback message if iframe fails to load

### Integration with Document Skill
Update the rule from "If it goes in docs, use Mermaid" to:
- **Structured diagrams** (sequence, flowchart, class, ER) → Mermaid
- **Conceptual/architecture sketches** → Excalidraw embed
- **Quick session diagrams** → Excalidraw (no embed, ephemeral)

The agent workflow for a persistent Excalidraw diagram:
1. Create with `create_view` during session
2. Export with `export_to_excalidraw` → get URL
3. Add `<ExcalidrawEmbed url="..." />` to the docs page

## Open Questions
- Does excalidraw.com have rate limits on embed URLs?
- Can we pass `&theme=dark` to match VitePress dark mode?
- Should we save excalidraw JSON files alongside the docs for backup/version control?

## Sources
- Excalidraw MCP: https://github.com/excalidraw/excalidraw-mcp
- FullscreenDiagram: apps/indusk-docs/src/.vitepress/components/FullscreenDiagram.vue
- VitePress extension: apps/indusk-mcp/extensions/vitepress/
