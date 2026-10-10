# vscode-extension — rules for working in this app

Loaded by Claude Code when a file under `apps/vscode-extension/` is read.

- **The core is pure, and every editor rule is tested there.** `src/core/`
  takes a file's text, a `promises health --json` line and a clock, and
  returns markers, hovers, problems, notifications and the fix action.
  `src/extension.ts` only applies what the core returns. A rule written in
  `extension.ts` has no test that can reach it. — see `/decisions/vscode-extension`
- **The editor only shows.** Nothing here writes to the project; it reads one
  child process's lines and opens a terminal. (`the-editor-only-shows`)
- **Health comes from the line, never computed here.** The package's
  `promises/health` is the one rule, the CLI streams it (`promises health --json`);
  this app maps its states to words.
  (`promise-health-single-definition.test.ts`)
- **Names and dates come from the line** (`title`, `planTitle`, `planDates`),
  never made here: the editor words a date, it never turns a handle into words.
  The handle stays on the marker, the click and the fix. (`display-names-single-definition.test.ts`)
- **Tokens come from the package's grammar** (`@infinitedusky/indusk-mcp/tokens`),
  never a second pattern.
- **Text from spans is untrusted.** A symptom, trace id or source reason was
  written by whatever sent the span. Before a terminal it goes through
  `cleanFacts` (one line, no control characters: a control character there is
  a keystroke); before a hover, through `asText` (Markdown escaped). (A20, A21)
- **The panel's model and HTML are core** (`core/panel.ts`, `core/panel-html.ts`,
  `core/activity.ts`); `panel-view.ts` only reads the listed files, posts the
  body and opens what is clicked. The page loads once and takes a new body on
  each line, so open cards and the activity's scroll survive a refresh.
- **Spell no promise token in prose or test text here**: `indusk promises check`
  reads `promise: <word>` after a comment opener as a claim. Build sample lines
  with the fixture's `site()`; word comments so no "promise:" is followed by a name.
