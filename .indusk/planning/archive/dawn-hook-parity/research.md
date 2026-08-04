---
title: "Dawn Hook Parity — Research"
date: 2026-08-03
status: complete
---

# Dawn Hook Parity — Research

## Question

Component 2 of the [Dawn master](../indusk-v2-dawn/master.md): what does it take for InDusk's hooks to enforce identically in the thin lane (`atdawn run`) as they do in Claude Code — and what is the honest inventory of what's unwired?

## Findings

### The hook inventory is 5, not 6 — the master was stale

`apps/indusk-mcp/hooks/` ships five hooks plus the `_hook-paths.js` helper. `check-plan-order.js` — which the master counted among the unwired four — **was deleted in the context-beam cleanup** (`62186774`, "cleanup dead apps"). The true ledger:

| Hook | Kind | Thin-lane status |
|------|------|-----------------|
| `validate-impl-structure.js` | PreToolUse blocker (impl shape + trajectory rules) | **Wired** — in `GATE_SCRIPT_NAMES` (`src/lib/run/gate.ts:128`) |
| `check-gates.js` | PreToolUse blocker (phase gates, checkoff order) | **Wired** — same chain + the phase-close probe |
| `claude-md-budget.js` | PreToolUse blocker (CLAUDE.md 60 KB budget) | Unwired |
| `gate-reminder.js` | Advisory nudge (stdin reader, non-blocking) | Unwired |
| `eval-trigger.js` | PostToolUse observer on `git commit` → spawns evaluator | Unwired |

### How the wired chain discovers scripts

`resolveGateScripts` walks up from the worktree root looking for `.claude/hooks/` containing every name in `GATE_SCRIPT_NAMES` (hard-capped walk, loud failure telling the user to run `indusk init`/`update`). Extending coverage = extending that const plus routing the new script into the edit-gate chain — mechanical.

### `claude-md-budget.js` is envelope-compatible already

Same stdin `{ tool_input, cwd }` shape as the wired pair, resolves state via `resolveStateAndGitPaths` (workbench-aware), budget from `context.claude_md_budget_bytes` (default 61440), warns at 90%. Nothing about it is Claude-Code-specific. Wiring it is the smallest item in this plan.

### `eval-trigger.js` — the CC dependency is in the *spawn*, and a manual mode already exists

The hook: anchored-regex commit detection (`/\bgit commit(?=$|\s|;|&|\|)/`, left+right edges — the community lesson), skips when the commit's `exit_code` ≠ 0 (a failed commit must not trigger an eval against the previous SHA), reads `eval.enabled` from config, workbench-aware path resolution, then spawns the evaluator via `claude --resume` — **that spawn is the only Claude-Code-tied step**, and it also breaks on remote cells (no `claude` CLI on a Fly box).

Load-bearing discovery: the hook has a **CLI mode** ("no stdin, no git commit filter", `cliSource` tag) — the same file can be invoked manually against the current state. `/rail-check` already uses exactly this to drain highlight backlogs. So a queue-then-drain design needs: (a) a durable pending-evals record written at commit time from the thin lane, and (b) a drain that invokes the existing CLI mode from an environment that has `claude`. Half the machinery exists.

Existing queue-shaped primitives to model on: the highlights queue (`highlights.jsonl` + `markProcessed` write-time dedup — the "already_processed → STOP" invariant), `results.log` (append-only jsonl), `indusk eval findings/fix/ignore`.

### The loop makes zero commits today

`grep commit src/lib/run/{loop,tools}.ts` → nothing. The per-phase contract (`phasePrompt`, `loop.ts:141`) instructs test-first + checkoffs but never commits; all three quality-read cells (C5–C7) produced uncommitted working trees. Consequences: no per-item history, no bisectability, nothing for an eval rail to fire on, and a divergence from the `/work` convention (one commit per checklist item). **Eval parity is therefore downstream of porting the commit cadence into the loop** — commits happen through the model's `bash` tool (already gated post-hoc), or as a loop-owned step at item/phase close.

### `gate_policy: ask` headless — where the pause hook fits

`loop.ts:125` records today's contract: "headless runs are `gate_policy: auto` by contract (there is no user to give conversation-proof skips to)." In `ask` mode, `check-gates` refuses a bare `(none needed)` / `skip-reason:` checkoff and demands conversation proof (`(none needed — asked: "…" — user: "…")` — both quoted parts validated). So a headless `ask` doesn't need a new enforcement mechanism: the refusal already happens. What's missing is the loop *interpreting* that specific refusal class as "pause and surface the question" (exit 3, like the human-gate pause) instead of letting it surface as a generic red stop. The run resumes after the human amends the impl with the conversation proof (or flips policy) and re-invokes — the loop's existing already-complete-phase skipping makes re-entry cheap.

### `gate-reminder.js` — what shedding it forgoes

It's a stdin-reading advisory nudge (non-blocking by design — exit 0 always). In Claude Code it surfaces as hook output the human sees. In an unattended loop there is no human mid-phase; injecting nudge text as synthetic tool results would spend steps (the C3/C4 starvation lesson: steps are the scarce resource for read-heavy models) for advice the gates already enforce at the boundary. Shedding is a *decision to record*, not silent omission — it's the first concrete entry of the Horizon's "hook invariant/procedure keep-shed audit."

## Open Questions

- Should loop-owned commits (deterministic, per item at checkoff) be preferred over prompting the model to commit via `bash`? Loop-owned is reproducible and lands the eval-queue append in our code, not model behavior — leaning that way, to be settled in the ADR.
- Queue file location and shape: `.indusk/eval/pending.jsonl` (append-only, SHA + source + timestamp, markProcessed-style dedup at drain) vs reusing the highlights file. New file leans cleaner — different consumer, different lifecycle.
- Who drains, and when: `/catchup` (adds cost to the dieted flow — likely no), `/rail-check` (already the backlog-drain skill — natural home), and/or the eval-trigger firing at the *end* of a `claude`-capable session.

## Sources

- `apps/indusk-mcp/src/lib/run/gate.ts` (`GATE_SCRIPT_NAMES`, `resolveGateScripts`), `loop.ts` (phase contract, auto-only comment)
- `apps/indusk-mcp/hooks/{eval-trigger,claude-md-budget,gate-reminder,check-gates}.js`
- Deletion of `check-plan-order.js`: commit `62186774` (context-beam cleanup)
- `.indusk/planning/archive/dawn-external-orchestrator/` — matrix F-findings; `.indusk/planning/archive/eval-agent-mcp-access/` — eval rail invariants
