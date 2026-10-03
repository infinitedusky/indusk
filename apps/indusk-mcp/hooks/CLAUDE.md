# hooks — rules for the PreToolUse / PostToolUse hooks

Loaded by Claude Code when a file under `apps/indusk-mcp/hooks/` is read. The
hooks are plain JS ports that cannot import the TS library, so these rules
are about keeping the two lanes in step.

- **Hooks discovery is globSync on BOTH sides** (init + update) — a hardcoded
  list ships a registration without its file. A new hook also needs an
  `ensureHookRegistered` call (`lib/hook-command.ts`, the ONE way init and
  update register a hook) from `update.ts`; `trunk-guard.js` needs it under
  TWO matchers (Edit/Write and Bash) — one is half a gate.
- **`_`-prefixed modules are imported, not registered**: no settings entry, but
  they must exist in `.claude/hooks/` or the importer dies at load
  (`globSync("*.js")` copies them). Each mirrors exactly ONE `src/lib` module
  (`_impl-headings.js`, `_trajectory-parser.js`, `_impl-phases.js`,
  `_hook-paths.js`), pinned by count — "change the TS and every port together"
  is checkable by reading two filenames. `check-gates.js` mirrors the terminal
  state set inline, deliberately.
- **Hook commands are registered by the project root, never relative to the
  cwd** — `hookCommand(name)` is the one definition,
  `node "${CLAUDE_PROJECT_DIR:-.}"/.claude/hooks/<name>.js`; Claude Code runs
  hooks in the session's cwd and treats a load failure as non-blocking, so the
  relative form was a gate that switched off silently after any `cd`.
- **PostToolUse: stderr at exit 0 goes to the debug log only.** A message for
  the model is a stdout JSON envelope carrying
  `hookSpecificOutput.additionalContext`, emitted via `console.info`.
- **trunk-guard's commit gate** reads `git [-C x] commit`, a preceding `cd`,
  `-c "…"`, `$(…)`/backticks, `\`-continuations, `-am` and pathspecs (other
  spellings are gaps); the `chore(release):` exemption reads this commit's own
  first `-m`/`-F`, never the surrounding command text, and a substituted
  message is refused *as unreadable*, never split into paths.
- **Never predict Edit results with `String.replace`** — its `$`-substitution
  diverges from the Edit tool's literal semantics; use an index-splice and
  guard an empty `old_string`.
- The budget hook judges growth, not size; a root is the state root, a
  declared repo's dir (`declaredRepoDirsAt`), or any checkout's top (`.git`
  present — plan worktrees), never a depth. Every hook that refuses names its
  lesson on its own line (`lesson: <name>`): its own string, or directly after
  a `\n` — the scan reads nothing else, and `context-tiers-register.test.ts`
  fails any register enforcer row whose file it cannot read.
