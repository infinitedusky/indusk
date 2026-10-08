---
title: "Bookkeeping lives where it is read — Research"
date: 2026-10-07
status: complete
---

# Bookkeeping lives where it is read — Research

## Question

Where does each record InDusk writes at runtime belong, so that no checkout is
left dirty by it, no person has to decide whether it is theirs, and no
evaluation is done twice?

## Background

Opened at admin-plan-authoring's live check (2026-10-06): an unattended
release met InDusk's notes uncommitted on `main`, and two rules collided (a
session never commits work that is not its own; a plan does not land onto a
dirty trunk). admin-plan-authoring's Build Phase 10 treats the symptom:
`plans approve` and `plans land` commit the bookkeeping first
(`lib/plans/bookkeeping.ts:60`). On 2026-10-07 it blocked three more steps,
and the evaluator wrote each of three lessons three times: twice on `main`,
once in demo-app-template's worktree.

## Findings

Paths relative to `apps/indusk-mcp/` unless they start with `.`.

### Where each record is written, and why it lands where it does

| Record | Written by | Root chosen by | In git |
|---|---|---|---|
| `.indusk/current.md` (+ `.lock`) | `update_current_section` (src/tools/agent-tools.ts:67), the `agent` CLI, sweep, init, update | MCP: `PROJECT_ROOT ?? "."` (src/server/index.ts:51), set to `.` in `.mcp.json`, so the directory the session started in | tracked, `merge=union`; the `.lock` is not ignored here |
| `.indusk/highlights.jsonl` | `highlight` tool (src/lib/highlights/highlights.ts:150) | `PROJECT_ROOT` | tracked, `merge=union` |
| `.indusk/highlights-processed.jsonl` | `highlight_mark_processed` (highlights.ts:196), called by the evaluator | the evaluator's inner server's `PROJECT_ROOT`, which is the commit's git root | tracked, `merge=union` |
| `.indusk/eval/` | the eval-trigger hook, the persistent evaluator, the pending-eval queue | the hook's walk-up from the event's cwd | ignored |
| `.claude/lessons/` | `add_lesson` (src/tools/lesson-tools.ts:78), called by the evaluator | `PROJECT_ROOT`, the commit's git root for the evaluator | tracked |
| `.indusk/phase-boundary.jsonl`, `.indusk/verify/ledger.jsonl` | `/work` and `verify`, per plan | the caller's root | tracked, `merge=union` |

- **Nothing writes to the main checkout on purpose.** No writer uses the git
  common directory; `markProjectId` (src/lib/promises/config.ts:45) is the only
  function that finds the main checkout, and it only tags telemetry.
- **The duplicate lessons, explained.** The evaluator's inner `claude` runs
  with `cwd = gitRoot` (persistent-evaluator.ts:358) and a relative
  `--mcp-config .mcp.json`, so its indusk server's root is the commit's
  checkout. A commit in a plan worktree has that worktree's lessons and its
  own `highlights-processed.jsonl` (cut from `main`'s committed copy, without
  `main`'s uncommitted marks), so it materialised the same highlights again.
- **Nothing commits these records**, except approve and land's safety net.
- **`~/.indusk/` already holds per-machine state** (registry, telemetry,
  admin sessions, hub lessons) as flat files; no per-project directory exists.
  `induskHome()` is defined in seven files.
- **The trunk guard already allows** `.indusk/` and `.claude/lessons/` to be
  committed on `main` (hooks/trunk-guard.js:63).
- **Stray:** a `~/.indusk/eval/system.log` exists; the hook's walk-up stopped
  at the home directory because it contains `.claude/`.

## Decisions

- **Machine state lives in one home per project, outside every checkout**
  (Sandy, 2026-10-07): the highlights queue, the processed list and eval
  results under `~/.indusk/projects/<project>/`, keyed by the same project id
  `markProjectId` gives (the main checkout's name, so every worktree agrees).
  One queue and one processed list per project, so no checkout can process a
  highlight twice, and none of it is in git. A second machine starts its own
  queue.
- **Notes people read stay in git and are committed on `main` when written**
  (Sandy, 2026-10-07): `current.md` and lessons are written to the main
  checkout, whichever checkout the writer runs in, and committed in a commit
  of their own under the lock `current.md` already uses.
- **Per-plan records stay with the plan** (phase boundaries, the verify
  ledger): they describe the plan's own branch and travel with it.

## Open Questions

- Committing on `main` when the main checkout has another branch checked out,
  or a merge in progress: leave the note uncommitted and say so, or refuse?
- How to move today's tracked `highlights*.jsonl` out of git without losing
  the unprocessed ones.
