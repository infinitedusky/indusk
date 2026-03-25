---
name: Use claude mcp add for MCP servers
description: Never edit .mcp.json directly — use claude mcp add CLI command
type: feedback
---

Use `claude mcp add` for MCP server setup, never edit `.mcp.json` directly.

**Why:** `.mcp.json` should be gitignored (contains auth tokens). The `claude mcp add` command handles the format correctly and supports transport types like `http` that manual editing can get wrong.

**How to apply:** When adding MCP servers during init or extension enable, either run `claude mcp add` directly or print the command for the user to run (if secrets are involved).
