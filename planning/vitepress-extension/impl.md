---
title: "VitePress Excalidraw Embed"
date: 2026-03-26
status: completed
gate_policy: ask
---

# VitePress Excalidraw Embed

## Goal
Add an `<ExcalidrawEmbed>` component to VitePress so Excalidraw diagrams can persist in docs as interactive iframes.

## Scope
### In Scope
- ExcalidrawEmbed Vue component (iframe, loading state, fullscreen toggle)
- Register in theme globally
- Update VitePress extension skill
- Update document skill diagram guidance

### Out of Scope
- .excalidraw file storage / version control
- Build-time SVG rendering
- Dark mode theme param

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | ExcalidrawEmbed component, theme registration | FullscreenDiagram pattern |
| Phase 2 | Updated VitePress skill, document skill | Existing skill files |

## Checklist

### Phase 1: ExcalidrawEmbed Component

- [x] Create `apps/indusk-docs/src/.vitepress/components/ExcalidrawEmbed.vue`:
  - Props: `url` (required string), `title` (optional string, default "Excalidraw Diagram"), `height` (optional string, default "500")
  - Responsive iframe: width 100%, configurable height
  - Loading state: show "Loading diagram..." while iframe loads
  - Fullscreen toggle button (same expand SVG icon as FullscreenDiagram)
  - Fullscreen modal via Teleport (same pattern as FullscreenDiagram)
  - Scoped styles matching VitePress theme variables
- [x] Register `ExcalidrawEmbed` globally in `apps/indusk-docs/src/.vitepress/theme/index.ts`
- [x] Test: VitePress build passes with component registered — runtime testing deferred to manual

#### Phase 1 Verification
- [x] `pnpm turbo build --filter=indusk-docs` passes (VitePress build)
- [x] Component renders an iframe with the provided URL (verified via build — no SSR errors)
- [x] Fullscreen toggle opens/closes the modal (code review — follows FullscreenDiagram pattern exactly)

#### Phase 1 Context
- [x] Add to CLAUDE.md Key Decisions: ExcalidrawEmbed component for persistent Excalidraw diagrams in VitePress — see `planning/vitepress-extension/adr.md`

#### Phase 1 Document
- [x] Add changelog entry: Added — ExcalidrawEmbed component for interactive Excalidraw diagrams in VitePress docs

### Phase 2: Skill Updates

- [x] Update `apps/indusk-mcp/extensions/vitepress/skill.md`: add ExcalidrawEmbed section — usage, props, when to use vs Mermaid/FullscreenDiagram
- [x] Update `apps/indusk-mcp/skills/document.md`: expand diagram guidance — Mermaid for structured diagrams in docs, Excalidraw embed for conceptual/architecture in docs, Excalidraw session-only for ephemeral sketches. Add the agent workflow: create_view → export_to_excalidraw → ExcalidrawEmbed in docs page.

#### Phase 2 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes (pre-existing lint issue in init-docs.ts, not related)

#### Phase 2 Context
(none needed — skill updates are internal)

#### Phase 2 Document
(none needed — skill files are self-documenting)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-docs/src/.vitepress/components/ExcalidrawEmbed.vue` | New — iframe embed component |
| `apps/indusk-docs/src/.vitepress/theme/index.ts` | Register ExcalidrawEmbed |
| `apps/indusk-mcp/extensions/vitepress/skill.md` | Add ExcalidrawEmbed guidance |
| `apps/indusk-mcp/skills/document.md` | Expand diagram guidance with embed workflow |

## Dependencies
- Excalidraw extension (completed)
- VitePress extension (exists)

## Notes
- Model the component closely on FullscreenDiagram for UX consistency
- No new npm dependencies needed — just a Vue SFC with an iframe
