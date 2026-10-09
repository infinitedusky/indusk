# hooks — rules for the PreToolUse / PostToolUse hooks

Loaded by Claude Code when a file under `apps/indusk-mcp/hooks/` is read. The
hooks are plain JS ports that cannot import the TS library, so these rules
are about keeping the two lanes in step.

- **Hooks discovery is globSync on BOTH sides** (init + update) — a hardcoded
  list ships a registration without its file. A new hook also needs a row
  in `HOOK_REGISTRATIONS` (`lib/hook-command.ts`), the one table `init`
  builds settings from and `update` ensures through `ensureHookRegistered` —
  pinned by `hook-registration.test.ts` A24; `trunk-guard.js` has a row under
  TWO matchers (Edit/Write and Bash) — one is half a gate.
- **`_`-prefixed modules are imported, not registered**: no settings entry, but
  they must exist in `.claude/hooks/` or the importer dies at load
  (`globSync("*.js")` copies them). Each mirrors exactly ONE `src/lib` module
  (`_impl-headings.js`, `_trajectory-parser.js`, `_impl-phases.js`,
  `_hook-paths.js`, `_inbox.js` ← `lib/promises/inbox.ts`), pinned by count — "change the TS and every port together"
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
- **Where a commit lands is read once**: `_commit-anchor.js` (`COMMIT_RE`,
  `commitAnchor`), imported by trunk-guard and eval-trigger — a hook that
  takes the repo from the event's `cwd` misreads `cd <worktree> && git
  commit` (day-monitor A32).
- **trunk-guard's commit gate** reads `git [-C x] commit`, a preceding `cd`,
  `-c "…"`, `$(…)`/backticks, `\`-continuations, `-am` and pathspecs (other
  spellings are gaps); the `chore(release):` exemption reads this commit's own
  first `-m`/`-F`, never the surrounding command text, and a substituted
  message is refused *as unreadable*, never split into paths.
- **Never predict Edit results with `String.replace`** — its `$`-substitution
  diverges from the Edit tool's literal semantics and it stops at the first
  match; use an index-splice (split/join under `replace_all`) and guard an
  empty `old_string`.
- **`_phase-tier.js` mirrors `lib/models/tiers.ts`** (the tier line, the rule
  over it, the check over the tier config), held by `phase-tier-parity.test.ts`
  — the same inputs go to both copies and must get the same answers. Change
  the TS and the port together.
- **The validator's "no phase structure touched" fast path is a list of the
  edit shapes that carry structure** — a phase heading, an unchecked item, a
  `**Tier**:` line. A rule over a new line shape adds its marker there, or an
  Edit of that line alone is never checked (model-per-phase A13).
- **A rule that needs the registry or a brief runs through `indusk promises
  contract`, never a second reader in a hook.** `validate-impl-structure.js`
  hands it the impl as it would be written (`--impl-stdin`), before its own
  "no phase structure touched" exit, and passes the refusal on. A check that
  cannot be run refuses and says why: the command, how it failed, and that
  `INDUSK_BIN` names another build
  (`lesson: detectors-must-distinguish-could-not-check-from-checked-and-failed`).
  The row rules (shape, level, purpose) are the contract's too, so they hold
  for a file any tool wrote; the hook's own run of them, on an edit that adds
  a phase or an item, is the early word on a draft.
- The budget hook judges growth, not size; a root is the state root, a
  declared repo's dir (`declaredRepoDirsAt`), or any checkout's top (`.git`
  present — plan worktrees), never a depth. Every hook that refuses names its
  lesson on its own line (`lesson: <name>`): its own string, or directly after
  a `\n` — the scan reads nothing else, and `context-tiers-register.test.ts`
  fails any register enforcer row whose file it cannot read.
- **`break-inbox.js` runs on every prompt** (`UserPromptSubmit`, no matcher):
  it reads two small files in the project's home (`projectHome` from
  `_hook-paths.js`) and exits; it never blocks and never grows a second read.
  Nothing to say is exit 0 with no output.
