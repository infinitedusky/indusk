---
name: a-clone-without-an-mcp-config-gets-the-keep-list
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: untrack-mcp-json
sites: []
tests: []
incidents: []
---

In a checkout with no `.mcp.json`, one `indusk` command writes one containing the project's declared MCP servers, and never overwrites a `.mcp.json` that exists.

## History
- 2026-10-11 — declared (untrack-mcp-json), from its planning conversation.
