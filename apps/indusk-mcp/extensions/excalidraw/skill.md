# Excalidraw — Hand-Drawn Diagrams

Excalidraw creates hand-drawn style diagrams directly in chat. Use it for quick visual communication — architecture sketches, debug illustrations, conceptual overviews.

## When to Use Excalidraw vs Mermaid

| Need | Tool | Why |
|------|------|-----|
| Architecture overview for a brief or ADR | **Excalidraw** | Conceptual, hand-drawn feel |
| Sequence diagram in VitePress docs | **Mermaid** | Text-based, diffs in git, renders natively |
| Quick sketch during debugging | **Excalidraw** | Fast, visual, natural language |
| Flowchart in a docs page | **Mermaid** | Version-controlled, embedded in markdown |
| Conceptual diagram during teach mode | **Excalidraw** | Approachable, not overly formal |
| Class/entity relationship for reference docs | **Mermaid** | Precise, structured, text-diffable |

**Rule of thumb:** If it goes in the docs site, use Mermaid. If it's for in-session communication, use Excalidraw.

## How to Describe Diagrams

Be specific about components, connections, and layout. The more concrete the description, the better the result.

**Good descriptions:**
- "Draw an architecture diagram showing game-server connected to postgres and redis, with poker-app and dealer-app connecting to game-server via WebSocket, and admin-app connecting via HTTP REST"
- "Sketch the data flow: user action → WebSocket → game-server → advanceHand → broadcast state → all connected clients"
- "Draw a box diagram showing the three layers: Next.js apps on top, game-server in the middle, database + redis at the bottom, with arrows showing the communication patterns"

**Bad descriptions:**
- "Draw the architecture" (too vague)
- "Make a diagram" (no context)
- "Show how it works" (which part?)

## Setup

The Excalidraw MCP server is a **remote hosted service** — no npm package, no install, no auth.

```bash
claude mcp add -t http -- excalidraw https://mcp.excalidraw.com
```

That's it. No tokens, no config files, no environment variables.

## When to Create Diagrams

- **During `/plan` research or brief**: sketch the proposed architecture to make it concrete
- **During `/work` teach mode**: visualize what a phase is building before and after
- **During debugging**: draw the request flow to identify where things break
- **During retrospective**: before/after architecture comparison
- **When the user asks**: "draw this", "sketch that", "visualize the flow"

## Limitations

- Diagrams are in-session only — they don't persist to files automatically
- No version control (unlike Mermaid text)
- Depends on remote server availability
- Quality depends on description specificity
