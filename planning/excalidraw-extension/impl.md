---
title: "Excalidraw Extension"
date: 2026-03-26
status: completed
gate_policy: ask
---

# Excalidraw Extension

## Goal
Add Excalidraw as a built-in extension so agents can create hand-drawn diagrams during planning, debugging, and teach mode.

## Scope
### In Scope
- Built-in extension (manifest + skill)
- `extensions enable excalidraw` adds MCP server via `claude mcp add`
- Skill: when to use Excalidraw vs Mermaid, how to describe diagrams
- Document skill update: reference Excalidraw for informal visuals
- Plan skill update: suggest sketches during research/brief

### Out of Scope
- Local/offline setup
- SVG export to VitePress
- Replacing Mermaid

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Extension manifest, skill, MCP server config | Extension system |
| Phase 2 | Updated document + plan skills | Existing skill files |

## Checklist

### Phase 1: Extension + Skill

- [x] Create `apps/indusk-mcp/extensions/excalidraw/manifest.json`:
  ```json
  {
    "name": "excalidraw",
    "description": "Hand-drawn diagrams via Excalidraw MCP — conceptual sketches, architecture visuals, debug illustrations",
    "provides": {
      "skill": true
    },
    "mcp_server": {
      "type": "http",
      "url": "https://mcp.excalidraw.com",
      "setup_instructions": [
        "claude mcp add -t http -- excalidraw https://mcp.excalidraw.com"
      ]
    }
  }
  ```
- [x] Create `apps/indusk-mcp/extensions/excalidraw/skill.md` with:
  - Two tools: Excalidraw (informal/conceptual) vs Mermaid (formal/docs)
  - Decision guide table (from ADR)
  - How to describe diagrams effectively (be specific about components, connections, layout)
  - Examples: "Draw an architecture diagram showing game-server connecting to postgres and redis"
  - Note: no auth needed, remote server, no npm
- [x] Verify `extensions enable excalidraw` copies manifest + installs skill
- [x] Verify the printed `claude mcp add` command works

#### Phase 1 Verification
- [x] `npx @infinitedusky/indusk-mcp extensions enable excalidraw` outputs the setup command
- [x] `claude mcp add -t http -- excalidraw https://mcp.excalidraw.com` succeeds
- [x] `.claude/skills/excalidraw/SKILL.md` exists after enable
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes

#### Phase 1 Context
- [x] Add to CLAUDE.md Key Decisions: Excalidraw extension for hand-drawn diagrams, complements Mermaid — see `planning/excalidraw-extension/adr.md`

#### Phase 1 Document
- [x] Add changelog entry: Added — Excalidraw extension for hand-drawn diagrams during planning and debugging

### Phase 2: Skill Integration

- [x] Update `apps/indusk-mcp/skills/document.md`: add Excalidraw section under diagram guidance — "For conceptual/informal diagrams (architecture overviews, debug sketches, teach mode visuals), use Excalidraw. For formal docs-site diagrams (sequence, flowchart, class), use Mermaid."
- [x] Update `apps/indusk-mcp/skills/plan.md`: in the research and brief templates, add optional suggestion — "Consider creating a visual sketch of the proposed architecture with Excalidraw"

#### Phase 2 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes (pre-existing lint issue in init-docs.ts, not related to this change)

#### Phase 2 Context
(none needed — skill updates are internal, no project-level context change)

#### Phase 2 Document
(none needed — skill files are self-documenting)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/extensions/excalidraw/manifest.json` | New — extension manifest |
| `apps/indusk-mcp/extensions/excalidraw/skill.md` | New — Excalidraw usage skill |
| `apps/indusk-mcp/skills/document.md` | Add Excalidraw diagram guidance |
| `apps/indusk-mcp/skills/plan.md` | Add visual sketch suggestion |

## Dependencies
- Extension system (completed)

## Notes
- No auth, no env config — simplest possible extension
- If Excalidraw adds auth in the future, update manifest with `headers` field
