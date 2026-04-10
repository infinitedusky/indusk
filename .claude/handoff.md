# Handoff

**Date:** 2026-04-11
**Session:** semantic-graph-eval — all 8 phases implemented, published at v1.13.0

## What Was Being Worked On

`semantic-graph-eval` plan — full implementation across 8 phases. Started with brief/ADR updates (two modes, knowledge distillation, worktree model), then built all code, then iterated through integration testing and bug fixes.

## Where It Stopped

All 8 phases complete. Published at v1.13.0. Working on both infinitedusky and Numero (confirmed scorecards produced on both). Ready for retrospective.

## What's Next

1. **Retrospective** on semantic-graph-eval — `/retrospective semantic-graph-eval`
2. **Commit all work via jj** — massive working copy with everything from this session. Should be split into logical commits (eval system, MCP migration fixes, planner skill fix, install command, server logging, persistent judge).
3. **Verify persistent judge on Numero** — first `jj describe` should do catchup, second should resume cheaply. Compare usage data in scorecards.
4. **Token usage measurement** — Phase 8 item deferred: compare persistent vs one-shot cost using the `usage` field in scorecards.

## Open Issues

- **Biome nested root config error** — pre-existing. `pnpm check` fails.
- **Docs build broken** — pre-existing error in `infrastructure.md` line 190.
- **indusk-portfolio container restarting** — exit code 254, unrelated.
- **Transcript path unavailable** — eval hook can't reliably find Claude Code transcript. Judge gets `"(transcript unavailable)"` and still works (evaluates diff + codebase).
- **`persistent-judge.ts` uses `require()` in one spot** — `clearSession` uses `require("node:fs")` instead of top-level import because it's in a conditional path. Works but inconsistent.
- **Stale judge processes** — kill with `ps aux | grep "node.*input-type=module" | grep -v grep` and `kill` PIDs.

## Decisions Made This Session

- **Brief/ADR expanded**: two modes (eval + baseline), evaluator as knowledge distillation layer (user-side + outcome-side capture), worktree model (eval in-place, baseline gets own worktree), two dimensions of measurement (absolute quality + system improvement), opt-in telemetry POST
- **Claude Code PostToolUse hook** — jj 0.39.0 has no native hooks. Eval trigger is PostToolUse on Bash, detects `jj describe`.
- **Judge reads diff via tool calls** — not embedded in prompt. Prompt was 170KB+ with inline diff.
- **`runJudgeSync` not `runJudgeBackground`** — detached+unref caused close handler to never fire. The hook's inline node script stays alive.
- **`claude mcp add` requires `remove` first** — doesn't overwrite existing entries. Both init and update now remove-then-add.
- **CGC graph name enforced as `cgc-{project}`** — migration no longer preserves wrong values.
- **Hook registration checks per-entry** — old code skipped entire batch if any existing hook found. Now adds missing hooks individually by matcher.
- **Package resolution via `which indusk`** — eval hook finds compiled code via global install path, not hardcoded monorepo path.
- **`indusk install` shorthand** — delegates to extensions enable/add.
- **Persistent judge sessions** — `claude --print --resume <sessionId>` works. First commit = full catchup, subsequent = resume with minimal prompt. Session stored in `.indusk/eval/judge-session.json`.
- **Findings feedback loop** — findings persist as unresolved until fixed/ignored. Surfaced on every `jj describe`. CLI commands: `indusk eval findings/fix/ignore`.
- **MCP server stderr logging** — `[indusk] v{version} starting`, tool registration, connection status, fatal errors. Plus global uncaught exception handlers.
- **Adapter abstraction for eval triggers** — discussed but not built. Extract `EvalTrigger` interface when second consumer exists (Cursor, etc.).

## Watch Out For

- **v1.13.0 is minimum** — earlier versions have various broken eval features.
- **Eval hook fires on EVERY `jj describe` via Bash** — including during work sessions.
- **`eval-trigger.js` must be in both `apps/indusk-mcp/hooks/` and `.claude/hooks/`** — `indusk update` syncs it now.
- **Session limits** — eval judge spawns Opus agents. Persistent sessions reduce cost but first eval per session is still expensive.
- **`validate-impl-structure.js` bug fix** — `findProjectRoot` now derives from file path. Source in `apps/indusk-mcp/hooks/` may need syncing.
- **Planner skill fixed** — `research/` → `.indusk/research/` in 7 places.
- **`isScorecard` made defensive** — checks for `questions` array, not just absence of `error` field. Handles malformed judge output.

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] health
- [x] context
- [x] graphiti
- [x] plans
- [x] skills
- [x] extensions
- [x] graph

<!-- Session 2026-04-11 continued -->
