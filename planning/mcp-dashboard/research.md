---
title: "MCP Dashboard — Real-time Agent Activity UI"
date: 2026-03-23
status: complete
---

# MCP Dashboard — Research

## Question
How can we give developers visibility into what an MCP-powered agent is doing in real time? Long-running operations (indexing, builds) leave both the user and agent staring at nothing. There's no progress feedback, no activity log, no way to see what's happening across multiple tool calls.

## Findings

### The Problem
- MCP tools return once — they can't stream progress
- Long operations (CGC indexing: 60-120s, builds, tests) block with no feedback
- When the agent runs multiple background tasks, there's no central view
- tmux panes work but are terminal-native and fragile
- The agent can't tell the user "it's 40% done" because it doesn't know either

### What Exists Today
- **CGC** has job IDs and `check_job_status` — async pattern works but no UI
- **tmux MCP** can create panes and pipe output — terminal-native, no web UI
- **VitePress docs site** — wrong tool, it's for documentation not live status
- **Portainer** — container monitoring, not agent activity
- **FalkorDB browser** at `falkordb.orb.local:3000` — graph visualization only

### Architecture Options

#### Option A: Lightweight Next.js app bundled with indusk-mcp
- Ships as part of the package
- Starts alongside the MCP server (or on demand via `npx @infinitedusky/indusk-mcp dashboard`)
- WebSocket connection between MCP server and dashboard
- Agent writes events via the MCP server's event bus
- User opens `localhost:PORT` or `indusk-dashboard.orb.local`

#### Option B: Static HTML + SSE (no framework)
- Single HTML file with vanilla JS
- MCP server exposes an SSE endpoint
- No build step, no dependencies
- Limited interactivity but zero overhead

#### Option C: Electron/Tauri app
- Desktop app with system tray
- Overkill for the problem, complex distribution

### What the Dashboard Should Show
1. **Live activity feed** — tool calls as they happen, with status (running/done/error)
2. **Progress bars** — for long operations (indexing, builds, test runs)
3. **Background tasks** — list of async jobs with status
4. **Health overview** — extension health, FalkorDB status, CGC connection
5. **Code graph** — embed CGC's visualization (or link to it)
6. **Plan progress** — current plan/phase/item being worked on
7. **Catchup status** — which boxes are checked

### Broader Opportunity
This isn't just an indusk-mcp feature — every MCP server could benefit from a standardized dashboard. The MCP protocol itself should support progress events. Until it does, this is the workaround.

A generic `@modelcontextprotocol/dashboard` package that any MCP server can plug into would be valuable to the ecosystem. indusk-mcp could be the first implementation and reference.

## Open Questions
- Should the dashboard be always-on (starts with MCP server) or on-demand?
- How does the MCP server communicate with the dashboard? WebSocket? Shared file? In-memory?
- Should it run in Docker (consistent port via OrbStack) or directly on the host?
- Could this become an upstream contribution to the MCP protocol/SDK?

## Sources
- MCP protocol spec — no native progress/streaming support for tool responses
- CGC job system — async pattern with job IDs
- indusk-mcp extension system — health checks, extension status already available
