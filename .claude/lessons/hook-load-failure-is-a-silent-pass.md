# A Claude Code hook that fails to load is a gate that passes — register with $CLAUDE_PROJECT_DIR and never read hook silence as approval

## The pattern

Claude Code runs hook commands in the session's *current* working directory, which drifts with every `cd` inside a Bash tool call. A hook registered with a cwd-relative command (`node .claude/hooks/check-gates.js`) resolves to a file that does not exist as soon as the session sits in a subdirectory. Node exits 1 with MODULE_NOT_FOUND. Only exit 2 blocks a tool call; every other exit code is a non-blocking error that the tool call survives and the model is not shown. The gate is off and nothing says so.

Observed in dusk on 2026-09-10 (workbench-trust-fixes retrospective): two trajectory rows stayed non-terminal through eight phase closes that the `check-gates` hook exists to refuse. Replaying the checkoffs through the hook blocks them; in the session they were made minutes after a Bash call that ended in `apps/indusk-mcp`. The three refusals that did fire each came seconds after a `cd` back to the repo root.

## Why it matters

A gate whose absence is indistinguishable from its approval is not a gate. Silence from a hook is the same signal as no hook installed. Everything downstream (phase discipline, test-first, budget, eval scoring) inherits the hole, and a session that reads "the hook did not complain" as "the hook approved" will never notice.

## What to do instead

- Register hooks as `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/<name>.js` (quoted), never a cwd-relative path. `$CLAUDE_PROJECT_DIR` is the host's own variable for exactly this.
- Pin it: a test that no generated `settings.json` contains a cwd-relative hook command, and one that spawns the hook via its registered command from a subdirectory cwd and asserts the refusal still fires.
- Until fixed: `cd` back to the repository root before any edit or commit a hook is supposed to gate.
- At plan close, replay the gate over the final document (every row, every phase). Do not trust that it fired during the work.
- Treat any "this enforcement never complained" as a hypothesis to falsify, not evidence. The same shape as a hook that writes to stderr at exit 0 (routed to the debug log, never the model): the enforcement existed, the delivery did not.
