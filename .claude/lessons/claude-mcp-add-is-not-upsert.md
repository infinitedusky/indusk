# claude mcp add is append-only — remove first to update

# claude mcp add is append-only — remove first to update

`claude mcp add` silently does nothing if the server name already exists in `.mcp.json`. It doesn't update, overwrite, or error — it just exits successfully with the old config unchanged.

Any migration that needs to change MCP server config must call `claude mcp remove -s project <name>` before `claude mcp add`. This applies to both `indusk init` and `indusk update` migration code.
