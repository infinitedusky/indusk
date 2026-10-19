# hooks — rules for the PreToolUse / PostToolUse hooks

Loaded by Claude Code when a file under `apps/indusk-mcp/hooks/` is read. The
hooks are plain JS ports that cannot import the TS library, so these rules
are about keeping the two lanes in step.

- **Dawn's thin lane keeps the invariants and the eval rail**; a headless
  `ask` is a pause, and `ask` is the default in both lanes — see
  `/decisions/dawn-hook-parity`.
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
  `_hook-paths.js`, `_inbox.js` ← `lib/promises/inbox.ts`, `_clause-verdicts.js` ←
  `lib/promises/clause-verdicts.ts`), pinned by count — "change the TS and every port together"
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
  the TS and the port together. `STEPS` must name every step `TIER_STEPS`
  names; the parity test builds a case from `TIER_STEPS`, so a step added to
  one and not the other fails.
- **`_phase-summary.js` holds the `phase_summary: required` rule** (`phaseSummaryProblems`)
  and the row-label pattern (`ROW_LABEL`), one module per rule like `_phase-tier.js`;
  `validate-impl-structure.js` reads labels through `ROW_LABEL` in its cross-reference
  rule too. `TEST_ID_PATTERN` in `lib/trajectory/validator.ts` stays its TypeScript
  mirror. — guarded by `phase-summary-module.test.ts` (`promise: an-impl-phase-explains-itself`)
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
- **An amendment, not an impl edit, is what stops a build**: `check-gates.js`
  refuses a build-phase checkoff while `indusk plans amendments` lists a
  change to the brief's expectations, promises or looks, or to an owned
  promise's statement, since approval (`lesson: a-plan-builds-only-after-approval`);
  an item, a note or a Shape finding changed waits for nobody. It runs only
  for an impl that records `approved_brief` — one approved before the field
  has none, and no command runs. The refusal runs before any skip marker, and
  `approved_brief` changes only through `plans reapprove` (a CLI write; an
  edit that removes or changes it is refused, or deleting it would end the
  gate). Guarded by `amendments.test.ts` (A11, A12, A14) and
  `check-gates-amendments.test.ts` (A35). — see `/reference/cli/plans`
- The budget hook judges growth, not size; a root is the state root, a
  declared repo's dir (`declaredRepoDirsAt`), or any checkout's top (`.git`
  present — plan worktrees), never a depth. Every hook that refuses names its
  lesson on its own line (`lesson: <name>`): its own string, or directly after
  a `\n` — the scan reads nothing else, and `context-tiers-register.test.ts`
  fails any register enforcer row whose file it cannot read.
- **`looks-approval-guard.js` refuses an agent's write to any
  `.indusk/mockups/<app>/approved.json`** — Write/Edit by path, and on Bash
  (its second registration, as trunk-guard's) a redirect onto it, a writer
  (`tee`, `cp`, `mv`, `sed -i`, an interpreter, `git checkout|restore …`) or a
  call to `/api/looks/…/approve`. It holds every person-only act — a look's
  approval and a brief's re-approval (a Bash `plans reapprove`, a call to
  `/api/plans/…/reapprove`, an interpreter segment naming `reapprovePlan`). A
  person-only act is refused by its function's name as well as its command and
  route, and the reader exemption (`echo`, `cat`, `git` …) never covers a
  segment holding a substitution (`$(…)`, a backtick, `<(…)`, `>(…)`). A mockup is approved only by a person,
  through the cockpit's Approve. It reads command text, never the file, and
  has no off switch: a **tripwire for an agent's ordinary attempt, not a
  boundary** against a process running as the person — a script that builds
  the path passes it; the hashes bound to what was shown hold there. Guarded
  by `looks-approval-guard.test.ts`.
- **`plan-write-guard.js` refuses a shell command that writes, moves or deletes
  a plan document** (`.indusk/planning/[archive/]<plan>/…`). It is registered
  under Bash only — one matcher is the whole gate, since Edit/Write already
  pass the plan's checks — and, like `looks-approval-guard.js`, reads command
  text, never a script (a tripwire, not a boundary). It allows reads, text
  mentions, fd redirects, `indusk` commands and the git commands that move
  between committed states, and allows anything it cannot parse. It records
  decisions, never verdicts, through `_clause-verdicts.js`; `plan-write-witness.js`
  (PostToolUse) snapshots the root the guard recorded, never the after payload's
  `cwd`, and records Edit/Write writes under plan folders, which the drain
  (disk + `shell-quote`) leaves out of a shell command's changes. A hook test
  sets `INDUSK_HOME`. Guarded by `plan-write-guard.test.ts`,
  `plan-write-guard.contract.test.ts` (A99), `clause-verdicts.test.ts` (A100).
- **`break-inbox.js` runs on every prompt** (`UserPromptSubmit`, no matcher):
  it reads two small files in the project's home (`projectHome` from
  `_hook-paths.js`) and exits; it never blocks and never grows a second read.
  Nothing to say is exit 0 with no output.
