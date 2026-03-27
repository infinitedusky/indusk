---
title: "VitePress Excalidraw Embed"
date: 2026-03-26
status: accepted
---

# VitePress Excalidraw Embed

## Y-Statement
In the context of **persisting Excalidraw diagrams in VitePress documentation**,
facing **session diagrams being ephemeral with no way to embed them in docs**,
we decided for **an `<ExcalidrawEmbed>` iframe component using `export_to_excalidraw` shareable URLs**
and against **build-time SVG rendering, saving .excalidraw files, or embedding the full Excalidraw React component**,
to achieve **persistent, interactive diagrams in docs with minimal complexity**,
accepting **dependency on excalidraw.com for iframe rendering**,
because **it's the simplest path, requires only a Vue component, and matches the FullscreenDiagram pattern already established**.

## Context
Excalidraw diagrams are created in-session and disappear after. The `export_to_excalidraw` MCP tool uploads to excalidraw.com and returns a shareable URL. We need a way to embed these URLs in VitePress pages.

The `FullscreenDiagram` component (280 lines) already handles interactive diagram display with pan/zoom and fullscreen. `ExcalidrawEmbed` follows the same UX pattern but wraps an iframe instead of cloned HTML.

See `research.md` for the four embedding options evaluated.

## Decision

1. **`<ExcalidrawEmbed>` component** — Vue 3 SFC in `.vitepress/components/`, registered globally in theme
2. **iframe-based** — embeds the excalidraw.com shareable URL, no heavy dependencies
3. **Fullscreen toggle** — consistent with FullscreenDiagram UX (expand button, modal, close)
4. **Loading state** — show placeholder while iframe loads
5. **Responsive** — 100% width, configurable height prop, max-width container

### Component API
```vue
<ExcalidrawEmbed
  url="https://excalidraw.com/#json=..."
  title="Architecture Overview"
  height="500"
/>
```

### Agent workflow for persistent diagrams
1. `create_view` — create the diagram in session
2. `export_to_excalidraw` — get shareable URL
3. Write `<ExcalidrawEmbed url="..." title="..." />` in the docs page
4. Add page to sidebar if new

### Updated diagram guidance
| Need | Tool | Where |
|------|------|-------|
| Sequence, flowchart, class, ER diagrams | Mermaid + FullscreenDiagram | Docs site |
| Conceptual architecture, system overview | Excalidraw + ExcalidrawEmbed | Docs site |
| Quick session sketch | Excalidraw (no embed) | Ephemeral |

## Alternatives Considered

### Build-time SVG rendering from .excalidraw files
Save JSON, render to SVG during build using `@excalidraw/utils`. Version-controlled and no runtime dependency.

**Rejected for now:** adds a build dependency, loses interactivity. Worth revisiting if we want diagram version control.

### Full Excalidraw React component
Embed the full editor for in-page editing. Maximum interactivity.

**Rejected:** ~2MB dependency, React/Vue mixing complexity, SSR issues. Overkill for read-only docs.

### No embed — keep Excalidraw session-only
Status quo. Only Mermaid in docs.

**Rejected:** loses valuable conceptual diagrams that don't translate well to Mermaid's formal style.

## Consequences

### Positive
- Conceptual diagrams persist in docs
- Interactive (pan, zoom in excalidraw.com viewer)
- Minimal code — one Vue component
- Consistent UX with FullscreenDiagram

### Negative
- Depends on excalidraw.com availability for rendering
- URLs contain encoded diagram data (long, not human-readable)
- No git diff for diagram changes (URL is opaque)

### Risks
- excalidraw.com URL format could change — mitigated by keeping URLs in component props (easy to find and update)
- iframe may be blocked by CSP in some deployments — mitigated by documenting the required CSP rule

## Documentation Plan
- **Changelog**: Added — ExcalidrawEmbed component for persistent diagrams in docs
- **VitePress extension skill**: add ExcalidrawEmbed usage and when to use it

## References
- Research: `planning/vitepress-extension/research.md`
- Brief: `planning/vitepress-extension/brief.md`
- FullscreenDiagram: `apps/indusk-docs/src/.vitepress/components/FullscreenDiagram.vue`
- Excalidraw extension ADR: `planning/excalidraw-extension/adr.md`
