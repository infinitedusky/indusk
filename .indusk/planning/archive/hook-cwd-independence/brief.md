---
title: "Hook cwd independence"
date: 2026-09-10
updated: 2026-09-15
status: accepted
workflow: bugfix
---

# Hook cwd independence — Brief

**Cut 2026-09-15 (Sandy):** this brief once carried four things — the cwd fix,
row-level terminality at close, a gate ledger, and a test-helper migration.
Only the first is the bug. The other three are carried to the plans that own
them (see *Carried elsewhere* at the end), so this ships as the half-day
bugfix it is and Dawn 6.5 starts next.

## The story

Every gate InDusk installs into a project is a Claude Code hook, and every
one of them is registered the same way: `node .claude/hooks/<name>.js`. That
path is relative to the current directory. Claude Code runs hook commands in
the session's current working directory ("Handlers run in the current
directory with Claude Code's environment" — the hooks reference), and that
directory moves every time a Bash call ends with a `cd` somewhere else, which
in this repository is most test runs, because they start with
`cd apps/indusk-mcp`.

From `apps/indusk-mcp`, the path `.claude/hooks/check-gates.js` names a file
that does not exist. Node exits 1. To Claude Code, an exit code other than 2
is a non-blocking error: the tool call proceeds, and the error is not shown
to the model. The gate is off, and nothing in the session says so.

This was observed, not inferred. The retrospective for
`workbench-trust-fixes` found two trajectory rows still `written` after eight
phase closes that Gate B of `check-gates` exists to refuse. Replaying the
first Build Phase 2 checkoff through the hook blocks it, naming both rows. The
transcript shows that checkoff made two minutes after a Bash call that ended
inside `apps/indusk-mcp`, and the three refusals that did fire in that
session each came seconds after a `cd` back to the worktree root.

Nothing prevents the same for the other five hooks, and this part is a
scenario, not an observation. `validate-impl-structure` and
`claude-md-budget` are PreToolUse gates registered the same way, so an impl
written from a subdirectory is not validated and a CLAUDE.md edit from one is
not budgeted. `eval-trigger` is PostToolUse on `git commit`, so a commit made
while the cwd sits in a subdirectory would never be scored. `workbench-sync`
would not sync. `gate-reminder` would not remind.

The principle is the one `workbench-trust-fixes` applied five times: a guard
that works by coincidence is not a guard, and a gate whose absence is
indistinguishable from its approval is not a gate.

## Proposed Direction

Register every hook as `node "${CLAUDE_PROJECT_DIR}"/.claude/hooks/<name>.js`
— in `init` (fresh projects), in `update` (the targeted settings-ensure
blocks for pre-existing projects, which today write the relative form), and
in this repository's own `.claude/settings.json`. `update` also rewrites any
existing command exactly equal to the old relative form, so a project that
already has them gets the fix without re-initializing.

<details>
<summary>Technical (ground-truthed 2026-09-15)</summary>

- The literal `node .claude/hooks/...` appears six times in
  `apps/indusk-mcp/src/bin/commands/init.ts:1071-1091` (the `hookConfig`
  block) and four times in `update.ts` (eval-trigger ensure at 275,
  workbench-sync at 295, claude-md-budget at 360 and 365). This repository's
  `.claude/settings.json:258-290` registers the same six relative commands.
- `${CLAUDE_PROJECT_DIR}` is the host's own variable: "the project root
  where the session started", set in every hook command's environment and
  documented for exactly this purpose (reference scripts by path). It is
  quoted because paths carry spaces.
- One function, `hookCommand(name)`, in a new `src/lib/hook-command.ts`,
  which `init.ts` and `update.ts` both import; alongside it,
  `absolutizeHookCommands(projectRoot)` walks `settings.hooks` the way
  `hook-migration.ts`'s `removeLegacyHooks` does and replaces a command
  matching `^node \.claude/hooks/([\w.-]+\.js)$` — nothing else, so a
  hand-customized command is left alone. `update` calls it after the
  ensure blocks. Absent or unparseable settings is nothing to do, never a
  throw, because it runs inside `update`.
- A test spawns the *registered* command (read from the settings file
  `init` wrote) through `sh -c` with a subdirectory cwd and
  `CLAUDE_PROJECT_DIR` set to the fixture root, and expects the same
  refusal the root gives. A grep test pins that `init.ts`, `update.ts` and
  this repository's settings carry no relative hook command.
- The hooks themselves already resolve the *state* path from `event.cwd`
  via `_hook-paths.js` (walk up to `.indusk/`), so once the script loads,
  a subdirectory cwd is already handled. The load is the whole defect.

</details>

## Scope

### In Scope
- Absolute hook commands in `init`, `update` (ensure + migration), and this
  repository's settings; a parity test
- The hooks table in `guide/index.md` says where hooks run from and what a
  load failure means; the CLAUDE.md gotcha becomes the rule; a changelog line

### Out of Scope
- `indusk run`'s thin lane invokes the three gate scripts directly, not via
  settings; it is unaffected and untouched
- A session *launched* from a subdirectory: `${CLAUDE_PROJECT_DIR}` is then
  that subdirectory, and the hooks are not found — the same failure as today,
  not a worse one. Launch at the project root, as every other InDusk surface
  already assumes
- Making a hook that *does* load fail closed on its own internal errors (a
  separate question; today's failure is the load, not the logic)
- Whether the eval rail lost commits during the affected sessions (no log
  evidence was collected; `rail-check` can enumerate commits without
  scorecards if it matters)

## Success Criteria

- From any subdirectory of a project, an impl checkoff that Gate A or Gate B
  should refuse is refused, with the same message as from the root. Proven by
  a test that spawns the hook through the registered command with a
  subdirectory cwd.
- `indusk init` writes only absolute hook commands.
- `indusk update` on a project carrying the six relative commands leaves it
  with six absolute ones and touches nothing else in `settings.json`; a
  second `update` changes nothing; a customized command is not rewritten.
- A grep across `init.ts`, `update.ts` and `.claude/settings.json` for
  `node .claude/hooks/` finds nothing.

## Depends On
- Nothing. The evidence is in
  `.indusk/planning/archive/workbench-trust-fixes/retrospective.md`.

## Blocks
- Every plan executed under these gates, soft. `dawn-workbench-execution`
  (Dawn 6.5) is next in the sequence and would otherwise run under gates that
  are one `cd` away from off.

## Carried elsewhere (2026-09-15)

Each was in this brief's scope until the cut. Their new homes:

- **Row-level terminality at close** (the retrospective gate checks every
  trajectory row is terminal, not only the ritual phases' checkboxes; the
  audit reports non-terminal rows) and **the seven-day
  `completed`-without-retrospective health error** →
  `dawn-workbench-execution/brief.md`, Context (carried).
- **The gate ledger** (`.indusk/gates.jsonl`, one line per hook invocation,
  read by the PR shape's Process record) → `indusk-v4-day/master.md`,
  component 10, whose bundle is the reader.
- **Migrating the three private `runHook` test helpers** to
  `helpers/hook-runner.ts` → `dawn-workbench-execution/brief.md`, Context
  (carried), for whichever phase there next opens the hook tests.
