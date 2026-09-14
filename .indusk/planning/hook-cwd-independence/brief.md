---
title: "Hook cwd independence"
date: 2026-09-10
status: draft
workflow: bugfix
---

# Hook cwd independence — Brief

## The story

Every gate InDusk installs into a project is a Claude Code hook, and every
one of them is registered the same way: `node .claude/hooks/<name>.js`. That
path is relative to the current directory. Claude Code runs hook commands in
the session's current working directory, and that directory moves every time
a Bash call ends with a `cd` somewhere else, which in this repository is most
test runs, because they start with `cd apps/indusk-mcp`.

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
session each came seconds after a `cd` back to the worktree root. Every
Cleanup Phase checkoff was made from the same subdirectory while the phase's
own pin still read `planned`.

Nothing prevents the same for the other five hooks, and this part is a
scenario, not an observation. `validate-impl-structure` and
`claude-md-budget` are PreToolUse gates registered the same way, so an impl
written from a subdirectory is not validated and a CLAUDE.md edit from one is
not budgeted. `eval-trigger` is PostToolUse on `git commit`, so a commit made
while the cwd sits in a subdirectory would never be scored. `workbench-sync`
would not sync. `gate-reminder` would not remind, which is the reminder this
plan's predecessor spent its first phase making audible.

Two close-out checks could have caught the stale rows and did not, for a
related reason: they ask about phases, not rows. `checkRetrospectiveReadiness`
passes when the falsification and cleanup phases have every checkbox ticked,
and the retrospective skill text promises a stronger condition (every row
terminal) than the code performs. `auditPlanAtClose` reports `blocked` and
deferred rows only. A row left `written` is invisible to both.

The principle is the one `workbench-trust-fixes` applied five times: a guard
that works by coincidence is not a guard, and a gate whose absence is
indistinguishable from its approval is not a gate.

## Proposed Direction

### 1. Hook commands resolve independently of cwd

Register every hook as `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.js`,
in `init` (fresh projects), in `update` (the targeted settings-ensure blocks
for pre-existing projects, which today write the relative form), and in this
repository's own `.claude/settings.json`. `update` also rewrites the six
existing relative commands in place, so a project that already has them gets
the fix without re-initializing.

<details>
<summary>Technical</summary>

`apps/indusk-mcp/src/bin/commands/init.ts` (the `hooks:` block near line
1071) and `update.ts` (eval-trigger ensure near 261, workbench-sync near 281,
claude-md-budget near 346) all carry the literal `node .claude/hooks/...`. One
constant, `hookCommand(name)`, in whichever module both import, and a
migration in `update` that replaces a command exactly equal to the old
relative form. `$CLAUDE_PROJECT_DIR` is the host's own variable for this
purpose; it is set for hook commands and is the documented way to make a hook
"work regardless of Claude's current directory". Quote it: paths with spaces.
A parity test pins that no `settings.json` written by `init`/`update`
contains a cwd-relative hook command, and that this repository's own
settings file does not either.

</details>

### 2. Close-out asks whether every row is terminal

The retrospective ritual gate gains the check its skill text already claims:
every trajectory row whose `Passes at` phase exists in the document is
`passing`, `skipped` or `blocked`. The trajectory audit reports non-terminal
rows as findings alongside `blocked` ones. The two rows this plan's
predecessor left `written` become the regression fixture.

<details>
<summary>Technical</summary>

`lib/cleanup/gate.ts` `checkRetrospectiveReadiness` composes
`isFalsificationPhaseTerminal` and `isCleanupPhaseTerminal`, both of which
walk checklist items only. Add a `rowsNonTerminal(implContent)` over the
parsed trajectory and include its result in `missing`. `lib/trajectory/audit.ts`
`auditPlanAtClose` returns `{ deferred, blocked }`; add `nonTerminal`. The
retrospective skill's Step 0 and Step 4a text describe the new behavior
rather than the old promise.

</details>

The same gate file learns one more refusal, carried from the indusk-makeover
retrospective (2026-09-14): a plan whose impl has been `completed` for more
than seven days with no retrospective is reported by `check_health` as an
error, not a pending item. The makeover sat 53 days in a queue labelled "any
time"; every system that touched it was working as designed, and nothing
treated the wait as a fault. Health is read at every catchup, so an error
there is the one place visibility becomes a trigger.

### 3. The record

`guide/index.md`'s hooks table says what the hooks do; it should say where
they run from and what a load failure means. CLAUDE.md's gotcha for this
finding moves from "until this lands, `cd` back" to the rule.

### 4. A gate ledger

Every hook invocation appends one line to `.indusk/gates.jsonl`: which hook,
the file it judged, the verdict, the exit code, the time. Today a gate that
ran and approved is indistinguishable from a gate that never loaded, and
that is the finding this plan exists for. With the ledger, "the gates ran"
becomes something a reader can check rather than assume, and the PR shape's
Process record (artifact 10 in `indusk-v4-day/pr-shape.md`, amended
2026-09-14) reads it: the reviewer sees that every checkoff was gated before
reading a single verdict.

<details>
<summary>Technical</summary>

One shared writer in a `_`-prefixed hook module (`_gate-ledger.js`, port of a
`lib/gates/ledger.ts` twin, pinned by count like the other hook-side
modules), called from `check-gates`, `validate-impl-structure` and
`claude-md-budget` on every exit path including refusals. The record is
machine state: register it with every "what changed" detector and give it
`merge=union` in the commit that first writes it (the lifecycle-rebalance
rule). A missing ledger line for a checkoff is what `verify` and the
retrospective's replay look for.

</details>

## Scope

### In Scope
- Absolute hook commands in `init`, `update` (ensure + migration), and this
  repository's settings; a parity test
- Row-level terminality in the ritual gate and the trajectory audit; a
  `completed`-without-retrospective health error after seven days
- The gate ledger, written by every hook, read by the PR shape's Process record
- Migrate the three remaining private `runHook` copies
  (`claude-md-budget-hook`, `trajectory-a-prefix-ids`, `rationale-baseline-*`)
  to `helpers/hook-runner.ts` while the hook tests are open (carried from
  workbench-trust-fixes' cleanup phase)
- Docs: hooks table, retrospective skill text

### Out of Scope
- `indusk run`'s thin lane invokes the three gate scripts directly, not via
  settings; it is unaffected and untouched
- Making a hook that *does* load fail closed on its own internal errors (a
  separate question; today's failure is the load, not the logic)
- Whether the eval rail lost commits during the affected sessions (no log
  evidence was collected; if it matters, `rail-check` can enumerate commits
  without scorecards)

## Success Criteria

- From any subdirectory of a project, an impl checkoff that Gate A or Gate B
  should refuse is refused, with the same message as from the root. Proven by
  a test that spawns the hook through the registered command with a
  subdirectory cwd.
- `indusk update` on a project carrying the six relative commands leaves it
  with six absolute ones and touches nothing else in `settings.json`.
- `checkRetrospectiveReadiness` reports `missing: ["rows"]` (or equivalent)
  on an impl with a `written` row whose phase has closed, and passes on the
  same impl with the row `passing`.
- A grep across `init.ts`, `update.ts` and `.claude/settings.json` for
  `node .claude/hooks/` finds nothing.
- After a phase closes, `.indusk/gates.jsonl` holds one line per hook
  invocation for every checkoff in that phase, including the refused ones;
  a checkoff with no line is reported by the retrospective's replay.
- `check_health` on a fixture whose impl has been `completed` for eight days
  with no `retrospective.md` reports an error naming the plan; the same
  fixture at six days reports nothing.

## Depends On
- Nothing. The evidence is in
  `.indusk/planning/archive/workbench-trust-fixes/retrospective.md`.

## Blocks
- Every plan executed under these gates, soft. `dawn-workbench-execution`
  (Dawn 6.5) is next in the sequence and would otherwise run under gates that
  are one `cd` away from off.
