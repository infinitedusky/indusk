---
title: "Excalidraw Extension"
date: 2026-03-26
status: accepted
---

# Excalidraw Extension

## Y-Statement
In the context of **agents needing to create visual diagrams during planning, debugging, and teaching**,
facing **Mermaid being too formal for quick conceptual sketches and no visual tool being available in sessions**,
we decided for **a built-in extension using the official remote Excalidraw MCP server**
and against **local-only setup, replacing Mermaid, or building our own diagram tool**,
to achieve **quick visual communication alongside the existing formal Mermaid pipeline**,
accepting **dependency on the remote server's availability and no offline support**,
because **the remote server requires zero setup (no auth, no install) and Excalidraw's hand-drawn style fills a different niche than Mermaid's formal diagrams**.

## Context
Agents can produce Mermaid diagrams for VitePress documentation — formal, text-based, version-controlled. But during planning sessions, debugging, and teach mode, there's no way to quickly sketch a visual. "Draw me the architecture" requires a different tool than "add a sequence diagram to the docs."

The official Excalidraw MCP server at `https://mcp.excalidraw.com` provides this. It accepts natural language descriptions and produces hand-drawn style diagrams in-session. No auth, no npm package, no binary — just a URL.

See `research.md` for transport options, Mermaid comparison, and integration points.

## Decision

1. **Built-in extension** — ships with indusk-mcp, opt-in via `extensions enable excalidraw`
2. **Remote HTTP transport** — `claude mcp add -t http -- excalidraw https://mcp.excalidraw.com`
3. **No auth, no env config** — public server, nothing to configure
4. **Complementary to Mermaid** — Excalidraw for conceptual/informal, Mermaid for formal/docs. Neither replaces the other.
5. **Skill teaches usage** — when to use which, how to describe diagrams effectively
6. **Document and plan skill updates** — reference Excalidraw as an option for visual communication

### Diagram decision guide (added to skills)

| Need | Tool |
|------|------|
| Architecture overview for a brief or ADR | Excalidraw |
| Sequence diagram in VitePress docs | Mermaid |
| Quick sketch during debugging | Excalidraw |
| Flowchart in a docs page | Mermaid |
| Conceptual diagram during teach mode | Excalidraw |
| Class/entity relationship for reference docs | Mermaid |

## Alternatives Considered

### Local stdio server only
Requires cloning the repo, building, and pointing to the binary. More setup friction for no clear benefit — the remote server works and is maintained by Excalidraw.

**Rejected:** unnecessary complexity for local dev.

### Replace Mermaid with Excalidraw
Excalidraw produces images, not text. Can't diff in git, can't render natively in VitePress without export. Mermaid's text-based format is essential for versioned documentation.

**Rejected:** they solve different problems.

### No extension — just tell users to add the MCP server manually
Works, but the skill wouldn't be installed and the agent wouldn't know when to use it vs Mermaid. The extension bundles the skill with the server config.

**Rejected:** loses the skill integration.

## Consequences

### Positive
- Agents can create visual diagrams during any session
- Zero setup — no auth, no install beyond `extensions enable`
- Complements Mermaid without replacing it
- Teach mode gets a visual communication channel

### Negative
- Depends on remote server availability — no offline fallback
- Diagrams are ephemeral (in-session) unless exported
- No version control for Excalidraw diagrams (unlike Mermaid text)

### Risks
- Remote server could add rate limits or auth in the future — mitigated by also supporting local stdio setup in the manifest
- Diagram quality depends on how well the agent describes what it wants — mitigated by skill guidance on effective descriptions

## Documentation Plan
- **Changelog**: Added — Excalidraw extension for hand-drawn diagrams
- **Docs page**: Not needed — the skill covers usage. If demand grows, add a guide page for diagram best practices.

## References
- Research: `planning/excalidraw-extension/research.md`
- Brief: `planning/excalidraw-extension/brief.md`
- Excalidraw MCP: https://github.com/excalidraw/excalidraw-mcp
