---
title: "Excalidraw Extension"
date: 2026-03-26
status: complete
---

# Excalidraw Extension — Research

## Question
How should we integrate Excalidraw as an indusk-mcp extension? What does the MCP server provide, how does it work, and what value does it add to the dev workflow?

## Findings

### What Excalidraw MCP Does
The official Excalidraw MCP server lets AI agents create hand-drawn style diagrams directly in chat. It exposes drawing tools that accept natural language descriptions and produce Excalidraw diagrams.

Source: https://github.com/excalidraw/excalidraw-mcp

### Transport Options

| Method | Transport | Setup |
|--------|-----------|-------|
| **Remote** (recommended) | HTTP | URL: `https://mcp.excalidraw.com` — no install needed |
| **Local binary** | stdio | Download `.mcpb` from releases, double-click |
| **Local from source** | stdio | Clone, build, run `node dist/index.js --stdio` |

The remote option is simplest — no npm package, no binary, just a URL. Similar pattern to Dash0.

### Claude Code Setup

Remote (preferred — no install):
```bash
claude mcp add -t http -- excalidraw https://mcp.excalidraw.com
```

Local (if offline access needed):
```bash
claude mcp add -t stdio -- excalidraw node /path/to/excalidraw-mcp-app/dist/index.js --stdio
```

No auth token needed for the remote server (it's free/public).

### What Value It Adds to the Dev Workflow

1. **Architecture diagrams during planning** — when writing ADRs or briefs, the agent can create visual diagrams of the proposed architecture. Hand-drawn style makes them feel like whiteboard sketches, not formal diagrams.

2. **Sequence diagrams during debugging** — visualize request flows, WebSocket handshakes, agent lifecycles.

3. **Documentation diagrams** — complement Mermaid diagrams in VitePress with hand-drawn illustrations. Mermaid for formal/technical, Excalidraw for conceptual/informal.

4. **Context graph visualization** — could potentially visualize the context graph in a more accessible way than FalkorDB's raw graph viewer.

### Comparison to Mermaid (which we already have)

| | Mermaid | Excalidraw |
|---|---|---|
| Style | Formal, technical | Hand-drawn, approachable |
| Rendering | Text-based, renders in VitePress | Image-based, renders in chat |
| Editability | Edit the text | Edit in Excalidraw editor |
| In docs | Native VitePress support | Would need export as image |
| Agent creation | Agent writes Mermaid syntax | Agent describes in natural language |
| Version control | Text diffs cleanly | Binary files don't diff |

They're complementary, not competing. Mermaid for docs-site diagrams. Excalidraw for quick visual communication during sessions.

### Extension Design

- **Type**: Built-in extension (no auth, public server, broadly useful)
- **Detection**: None — this is opt-in, not project-specific
- **MCP server**: Remote HTTP at `https://mcp.excalidraw.com`
- **Skill**: Teach the agent when to use Excalidraw vs Mermaid, how to describe diagrams effectively
- **No `.env` config needed** — no auth, no dataset, no project-specific config

### Integration with Plan/Document Skills

The document skill already has Mermaid guidance. Excalidraw would add:
- During `/plan` research: "create a visual sketch of the proposed architecture"
- During `/work` teach mode: "draw a diagram showing what this phase builds"
- During retrospective: "visualize the before/after architecture"

These would be suggestions in the skill, not gates.

## Open Questions
- Does the remote server have rate limits?
- Can Excalidraw diagrams be exported as SVG/PNG for embedding in VitePress?
- Should we add Excalidraw as a diagram option in the document skill alongside Mermaid?

## Sources
- https://github.com/excalidraw/excalidraw-mcp
