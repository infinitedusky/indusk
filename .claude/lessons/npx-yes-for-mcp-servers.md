# Use npx --yes for MCP server commands

When configuring MCP servers via `claude mcp add`, always use `npx --yes` instead of bare `npx`. Without `--yes`, npx prompts "Ok to proceed?" to install packages, which blocks silently in MCP stdio mode — the server never starts and Claude Code shows "Connection closed."

Example: `claude mcp add -t stdio -s project -- indusk npx --yes @infinitedusky/indusk-mcp serve`
