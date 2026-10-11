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

In a checkout with no `.mcp.json`, one `indusk` command writes one that names the `indusk` server, and never overwrites a `.mcp.json` that exists.

## History
- 2026-10-11 — declared (untrack-mcp-json), from its planning conversation.
- 2026-10-11 — changed by untrack-mcp-json: measured in Test Phase 1: no built-in extension declares an MCP server for update to add, so update can honestly write only the indusk server; the other servers arrive with their extensions' own setup. It read: "In a checkout with no `.mcp.json`, one `indusk` command writes one containing the project's declared MCP servers, and never overwrites a `.mcp.json` that exists."
