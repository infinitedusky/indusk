# Rail Check — Verifying the Eval Pipeline After an Update

> **Skill reference**: [`apps/indusk-mcp/skills/rail-check.md`](https://github.com/infinite-dusky/dusk/blob/main/apps/indusk-mcp/skills/rail-check.md) — what the agent reads.
>
> **Manual procedure**: [`apps/indusk-mcp/test-fixtures/numero-workbench-shape/README.md`](https://github.com/infinite-dusky/dusk/blob/main/apps/indusk-mcp/test-fixtures/numero-workbench-shape/README.md) — for operators driving without the agent.

After you update InDusk, the eval→Graphiti rail should "just work." But two structural patterns can leave it silently broken — and you should know how to verify, fix, and (if needed) backfill what the broken rail missed.

This page exists because workbench-shaped projects ([introduced in `indusk-worktree-extension`](/decisions/git-only-substrate)) had the eval pipeline structurally broken for two months between when the worktree extension shipped and when [`workbench-mode-rail-integrity`](https://github.com/infinite-dusky/dusk/tree/main/.indusk/planning/workbench-mode-rail-integrity) fixed it (1.31.7). The fix is in place; the procedure for verifying and backfilling is what this page documents.

## When you should run the rail check

After ANY of the following:

- You ran `indusk update` (especially if upgrading to 1.31.7+) and want to confirm the new hooks took
- `mcp__indusk__check_health` returned `workbench/stray-state-*` errors
- You haven't seen new scorecards in `.indusk/eval/results.log` for several commits
- `.indusk/highlights.jsonl` has grown without `.indusk/highlights-processed.jsonl` catching up
- Anyone says "the eval pipeline isn't writing anything" or "Graphiti seems empty"

## The easy path — ask the agent

In a Claude Code session at the project root, tell the agent:

> "I just updated to 1.31.8, run the rail check."

The agent's `/catchup` step loads the `/rail-check` skill summary; the skill description literally enumerates the trigger phrases including *"I just updated"*. The agent recognizes the prompt, runs the 6-step procedure, and walks you through any decisions.

You don't have to memorize the steps. The agent does.

## What the procedure does (so you know what to expect)

The agent's 6 steps:

### 1. Detect project shape

Reads `.indusk/config.json` and reports *"Detected workbench mode at /path/to/workbench"* or *"Detected single-repo mode at /path/to/project."*

### 2. Run check_health

Calls `mcp__indusk__check_health` and reports findings. As of 1.31.7, this includes a new `stray_state` array — `.indusk/` directories found inside the wrapped repo (which shouldn't exist on a clean workbench-mode install).

### 3. Stray-state cleanup — your decision per directory

For each stray finding, the agent presents:

```
Stray .indusk/ directory found at: /path/to/numero/.indusk
  Why: artifact of pre-1.31.7 init or operator running init from inside the
       wrapped repo. Confuses path resolution.
  Recommended cleanup: rm -rf "/path/to/numero/.indusk"
  Should I run this cleanup? (yes / no / inspect first)
```

The agent **never auto-deletes**. You confirm each one. If you're not sure, "inspect first" runs `ls -la` on the path so you can see what's in there before deciding.

### 4. Sanity-commit smoke test

The agent makes a tiny commit (e.g., a comment update in a docs file) and watches `.indusk/eval/system.log` for the lifecycle markers:

```
... hook fired — tool: Bash, command: git commit ...
... statePath: /workbench, gitPath: /workbench/numero, eval.enabled: true
... spawning evaluator — module: ..., changeId: <SHA>
... evaluator spawned — source: commit, pid: <PID>
```

**The load-bearing line is `evaluator spawned` with a real PID.** If you see `skip — no git commit ID available` or `skip — no git repo at cwd`, the workbench fix didn't take — the agent stops here and tells you to re-run `indusk update`.

### 4b. Drain the thin lane's pending evals

`atdawn run` (the Dawn thin lane) queues one record per loop-owned commit in `.indusk/eval/pending.jsonl` instead of spawning the evaluator itself — it may be running on a machine that has no `claude` CLI at all. The rail check is where those get evaluated:

```bash
node .claude/hooks/eval-trigger.js --drain-pending
```

Each record is marked drained **before** its evaluator spawns, so re-running a drain never double-evaluates a commit — a crashed spawn shows up as a gap in the log, not a duplicate scorecard. A backlog that keeps growing across rail checks means thin-lane runs are happening but nobody is draining; nothing is lost (the queue is durable), but that lane's lessons haven't reached the registry yet.

### 5. Count unprocessed highlights

Reads both jsonl files and reports:

```
Highlights queue:
  Total in highlights.jsonl: 86
  Already processed: 0
  Unprocessed: 86
```

If unprocessed ≤ 5, the rail is healthy and the agent skips to Step 6. If unprocessed > 5, the agent asks whether to backfill.

### 6. Backfill drain (if you say yes)

The agent invokes `node .claude/hooks/eval-trigger.js --source rail-check-backfill`. This puts the eval agent in CLI mode and drains the entire unprocessed queue in one pass.

For 86 highlights, expect 5-10 minutes wall-clock and ~$0.50-2 in Sonnet tokens.

After the drain, the agent queries Graphiti to confirm the episodes landed and gives you a structured summary:

```
Rail check complete (post-1.31.8).
  Mode: workbench
  check_health: 1 stray-state finding cleaned (with your confirmation)
  Sanity commit: evaluator spawned with PID 47213 — rail working
  Highlights backfill: drained 86 unprocessed → 84 Graphiti episodes
  Graphiti recall: episodes group `numero_workbench` now has 84 entries.
```

(The 86 → 84 delta is normal — Graphiti's contradiction detection may merge near-duplicate facts.)

## The manual path — driving without the agent

If for any reason the `/rail-check` skill isn't available or you want to drive directly, the [`numero-workbench-shape README`](https://github.com/infinite-dusky/dusk/blob/main/apps/indusk-mcp/test-fixtures/numero-workbench-shape/README.md) walks the same procedure as bash commands. The steps map 1:1.

## What "the rail being broken" actually looked like

For the `numero_workbench` project specifically, the rail was broken from when the worktree extension shipped (~April 2026) through 1.31.7 (2026-06-28). During those 2 months:

- 86 highlights accumulated in `.indusk/highlights.jsonl` — every brief acceptance, ADR acceptance, mid-session correction, retrospective lesson the working agent flagged
- 0 episodes landed in the `numero_workbench` Graphiti group
- `.indusk/eval/results.log` stayed empty
- `.indusk/eval/system.log` had `skip — no git commit ID available` on every commit
- The working agent's `/catchup` Step 7 (Graphiti recall) returned only `shared`-group entries from cross-project knowledge, with nothing specific to Numero's actual work history

This is the **dark queue** failure mode. The pipeline was silently broken for 2 months because the failure surface was a single log line in a file the operator didn't routinely read.

## What 1.31.7 changed

The 4 InDusk hooks (`eval-trigger.js`, `check-catchup.js`, `check-gates.js`, `validate-impl-structure.js`) used to walk up the filesystem looking for `.indusk/` and lock that directory as "the project root." In workbench mode that landed at the workbench root — which is **NOT a git repo**. Hook then ran `git rev-parse` against it, got nothing, and silently exited.

1.31.7 introduced a shared `apps/indusk-mcp/hooks/_hook-paths.js` that returns two distinct paths:

- **`statePath`** — where `.indusk/` lives (workbench root in workbench mode; project root in single-repo mode). For file operations: highlights, config, system.log, results.log.
- **`gitPath`** — where the git repo actually is (derived from `git rev-parse --show-toplevel` against the commit's cwd). For git operations: change-ID extraction, spawned `claude --print` cwd.

In single-repo mode they're the same. In workbench mode they differ — and the hooks now use the correct one for each operation.

Full architectural rationale lives in [`workbench-mode-rail-integrity` brief](https://github.com/infinite-dusky/dusk/tree/main/.indusk/planning/workbench-mode-rail-integrity).

## Detecting the broken rail early

Even with the 1.31.7 fix shipped, the dark-queue pattern can re-emerge from other causes (Graphiti container down for an extended period, `eval.enabled: false` in config, claude binary not on PATH, etc.). Two cheap signals to monitor:

| Signal | Where | Healthy | Concerning |
|---|---|---|---|
| Unprocessed highlights | `wc -l .indusk/highlights.jsonl .indusk/highlights-processed.jsonl` | Difference ≤ 5 | Difference > 20 |
| Recent scorecards | `tail .indusk/eval/results.log` | New entry within the last few commits | No new entries in days |
| Lifecycle markers | `tail .indusk/eval/system.log` | `evaluator spawned` after each commit | Only `skip — *` entries |

Add a daily / weekly `indusk check_health` to your routine — the 1.31.7 stray-state audit catches the workbench-specific failure mode automatically.

## Related

- [Agent Roles](/guide/agent-roles) — the three-tier architecture this rail implements
- [Highlights — Working Agent's Write Path](/reference/tools/highlights) — how highlights flow to Graphiti
- [Eval Overview](/reference/eval/overview) — the eval agent's pipeline including the rubric and findings
- Plan: [`workbench-mode-rail-integrity`](https://github.com/infinite-dusky/dusk/tree/main/.indusk/planning/workbench-mode-rail-integrity) — the full architectural rationale and trajectory
- Lesson: `community-hook-bypass-is-rail-integrity-not-pacing` — the discipline this fix illustrates
