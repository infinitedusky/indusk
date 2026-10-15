# Run the commands a promise names against a bare clone before accepting the brief

A promise that says "one command does X in a fresh checkout" must be measured by running that command in a bare clone before the brief is accepted; believing it because the pieces exist is not evidence.

**Why:** untrack-mcp-json's second promise ("one `indusk` command writes one containing the project's declared MCP servers") was accepted, then measured: `update` creates no `.mcp.json` (its MCP handling is guarded by the file existing), `init` writes only the `indusk` server, and no built-in extension declares an `add_command`. The promise had to be narrowed after approval and a test row (T4) retired.

**How to apply:** make "run the named commands in a throwaway clone and record the output in research.md" the first step of any plan whose promise names a command's effect on a clean checkout; narrow the sentence to what the measurement shows before status `accepted`. See `.indusk/planning/untrack-mcp-json/research.md` and `retrospective.md`.
