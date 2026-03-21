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

## Sidebar & Navigation

- Configure sidebar in `.vitepress/config.ts` under `themeConfig.sidebar`
- Group pages by section: guide, reference, decisions, lessons
- Use `cleanUrls: true` for `/guide/getting-started` instead of `/guide/getting-started.html`

## Structure

- `src/guide/` — how-to guides for working with the project
- `src/reference/` — API and tool reference
- `src/decisions/` — architecture decision records (distilled from ADRs)
- `src/lessons/` — lessons learned (distilled from retrospectives)

## Common Gotchas

- VitePress expects `.md` files in the `src/` directory (configured via `srcDir`)
- Dead links cause build failures — use `ignoreDeadLinks: true` during development
- Mermaid diagrams need `vitepress-plugin-mermaid` — import and wrap config with `withMermaid()`
- Custom components go in `.vitepress/theme/` — register in `index.ts`
- Hot reload sometimes misses sidebar config changes — restart the dev server
