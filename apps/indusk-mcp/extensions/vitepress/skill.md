# VitePress

You are working with a VitePress documentation site. Follow these patterns.

## Content

- Use frontmatter for page metadata: `title`, `description`, `outline`
- Use `[[toc]]` for auto-generated table of contents
- Use code blocks with language hints for syntax highlighting
- Use containers (`::: tip`, `::: warning`, `::: danger`) for callouts

## Mermaid Diagrams

- Use Mermaid for architecture diagrams, flowcharts, and sequence diagrams
- Wrap in ` ```mermaid ` code blocks
- Keep diagrams focused — one concept per diagram
- Use `flowchart TD` for top-down flows, `flowchart LR` for left-right
- Use `classDiagram` for type relationships, `sequenceDiagram` for interactions
- **Set `securityLevel: "strict"` in the mermaid config.** Using `"loose"` causes Mermaid v10+ to scan the entire page DOM, producing "Syntax error in text" errors on every page.
- **Do not use `style`, `classDef`, or `themeVariables` with hardcoded colors.** The `vitepress-plugin-mermaid` auto-switches between `default` (light) and `dark` themes. Hardcoded colors break in the opposite mode. Use `subgraph` for visual grouping instead.
- **Set `theme: "default"` in the mermaid config.** The plugin overrides to `"dark"` automatically when VitePress dark mode is active. Do not set `theme: "dark"` or `theme: "base"` — they interfere with the auto-switching.

## Sidebar & Navigation

- Configure sidebar in `.vitepress/config.ts` under `themeConfig.sidebar`
- Group pages by section: guide, reference, decisions, lessons
- Use `cleanUrls: true` for `/guide/getting-started` instead of `/guide/getting-started.html`

## Structure

- `src/guide/` — how-to guides for working with the project
- `src/reference/` — API and tool reference
- `src/decisions/` — architecture decision records (distilled from ADRs)
- `src/lessons/` — lessons learned (distilled from retrospectives)

## Excalidraw Diagrams

For conceptual and architecture diagrams that should persist in docs, use the `<ExcalidrawEmbed>` component:

```vue
<ExcalidrawEmbed
  src="/diagrams/architecture.excalidraw.json"
  title="System Architecture"
/>
```

**Props:**
- `src` (required) — path to `.excalidraw.json` file in `public/diagrams/`
- `title` (optional, default "Excalidraw Diagram") — for accessibility

**Agent workflow for persistent diagrams:**
1. Create the diagram with `create_view`
2. Read the checkpoint with `read_checkpoint` to get the element JSON
3. Save the JSON to `apps/indusk-docs/src/public/diagrams/{name}.excalidraw.json`
4. Add `<ExcalidrawEmbed src="/diagrams/{name}.excalidraw.json" title="..." />` to the docs page
5. Add the page to sidebar in `.vitepress/config.ts` if new

The component uses `@excalidraw/utils` to render SVG client-side, wrapped in `<FullscreenDiagram>` for pan/zoom.

**When to use which:**
- **Mermaid + FullscreenDiagram** — structured diagrams (sequence, flowchart, class, ER) that need git diffs
- **Excalidraw + ExcalidrawEmbed** — conceptual architecture, system overviews, hand-drawn style
- **Excalidraw (no embed)** — ephemeral session sketches that don't need to persist

## Common Gotchas

- VitePress expects `.md` files in the `src/` directory (configured via `srcDir`)
- Dead links cause build failures — use `ignoreDeadLinks: true` during development
- Mermaid diagrams need `vitepress-plugin-mermaid` — import and wrap config with `withMermaid()`
- Custom components go in `.vitepress/theme/` — register in `index.ts`
- Hot reload sometimes misses sidebar config changes — restart the dev server
