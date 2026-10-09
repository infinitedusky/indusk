# vscode-extension — rules for working in this app

Loaded by Claude Code when a file under `apps/vscode-extension/` is read.

- **The core is pure, and every editor rule is tested there.** `src/core/`
  takes a file's text, a `promises health --json` line and a clock, and
  returns markers, hovers, problems, notifications and the fix action.
  `src/extension.ts` only applies what the core returns. A rule written in
  `extension.ts` has no test that can reach it. — see `.indusk/planning/vscode-extension/adr.md`
- **The editor only shows.** Nothing here writes to the project; it reads one
  child process's lines and opens a terminal. (`the-editor-only-shows`)
- **Health comes from the line, never computed here.** The package's
  `promises/health` is the one rule; this app maps its states to words.
  (`promise-health-single-definition.test.ts`)
- **Tokens come from the package's grammar** (`@infinitedusky/indusk-mcp/tokens`),
  never a second pattern.
