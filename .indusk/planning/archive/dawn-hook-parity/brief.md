---
title: "Dawn Hook Parity"
date: 2026-08-03
status: accepted
---

# Dawn Hook Parity — Brief

## Problem

The thin lane (`atdawn run`) enforces only 2 of the 5 InDusk hooks, runs `gate_policy: auto` (the weakest policy) by contract, makes **zero git commits**, and never fires the eval agent — so the lane that exists to be the control group and the cheap mechanical lane produces no history, no scorecards, and no lessons. A lane that never fires the eval agent cannot teach you anything, which destroys its one remaining job. (Component 2 of the [Dawn master](../indusk-v2-dawn/master.md); the honest inventory is in [research.md](research.md) — the master's "6 hooks" counted one deleted in the context-beam cleanup.)

## Proposed Direction

**Parity for invariants and the eval rail; a recorded shed for the advisory nudge.** Four moves, from smallest to largest:

1. **Wire `claude-md-budget.js` into the edit-gate chain** — it's envelope-compatible already; extend `GATE_SCRIPT_NAMES` and route CLAUDE.md-targeting edits through it.
2. **Shed `gate-reminder.js` deliberately** — advisory nudges are for a watching human; in an unattended loop they'd spend scarce steps on advice the gates already enforce at the boundary. Recorded as the first entry of the invariant/procedure keep-shed audit, not silently omitted.
3. **Port the commit cadence, then the eval rail on top of it.** The loop commits per checklist item at checkoff (loop-owned and deterministic, not model-prompted — settled in the ADR), and each commit appends a pending-eval record to a durable queue (`.indusk/eval/pending.jsonl`, append-only, markProcessed-style dedup). The queue is drained by the existing `eval-trigger` CLI mode from any `claude`-capable environment — `/rail-check` is the natural drain home. No `claude` CLI dependency inside the lane; works unchanged on remote cells.
4. **Headless `ask` = pause.** `check-gates` already refuses proof-less gate skips in `ask` mode; the loop learns to recognize that refusal class and exits 3 with the question surfaced (exactly like the human-gate pause) instead of red-stopping. `ask` becomes the default policy in both lanes; `auto` returns to being an explicit opt-in. This resolves the master's open decision assigned to this component.

## Context

- The gate-resolution machinery (`resolveGateScripts` walking up to `.claude/hooks/`, loud failure) and the refusal plumbing already exist; see [research.md](research.md) for per-hook mechanics.
- The eval rail invariants (anchored commit regex, exit-code skip, markProcessed dedup, resume-prompt rules) are hard-won — `.indusk/planning/archive/eval-agent-mcp-access/` — and the queue design must not re-learn them.
- Acceptance framing from the master: "a fresh plan executes identically under both lanes, hook for hook" — amended by this brief to "…hook for hook, for every hook that is an invariant; sheds are recorded."

## Scope

### In Scope
- `claude-md-budget` in the thin lane's gate chain.
- Loop-owned per-item commits with intent-derived messages.
- The pending-eval queue + drain wiring through the existing eval-trigger CLI mode + `/rail-check`.
- Headless `ask` pause (exit 3 + surfaced question); `auto` demoted to opt-in.
- Recording the gate-reminder shed; correcting the master's hook count.

### Out of Scope
- Tier-2 judgment checking (Horizon; component 6's natural upgrade).
- The full keep-shed audit of every gate (Horizon) — this plan contributes one entry, not the audit.
- Worktree kickoff in `atdawn run` (roadmap item, separate wiring).
- Matrix-grade telemetry (F4 carry-forward, separate).
- `gpt`/`grok` driver factories (component 1 close-out leftovers).

## Success Criteria

- A guinea-pig run in the thin lane produces per-item commits, and a CLAUDE.md write past budget is blocked identically in both lanes.
- After a thin-lane run, `.indusk/eval/pending.jsonl` holds one record per commit; a subsequent `/rail-check` (or manual eval-trigger CLI invocation) drains them into scorecards in `results.log`, each exactly once.
- An `ask`-policy plan with a gate the model wants to skip pauses the run (exit 3) with the question printed, instead of red-stopping or silently proceeding.
- The Dawn master's Component 2 row flips to Done with the amended acceptance wording; the shed is recorded.

## Depends On

- Nothing open — components 1+3 (the loop itself) are archived. Builds directly on `.indusk/planning/archive/dawn-external-orchestrator/`.

## Blocks

- Component 6 (`dawn-verify`) benefits: per-item commits give phase-boundary verification a real git substrate (before-snapshots per item, not per run).
- The thin lane's ability to feed lessons back (the whole eval→lessons rail) — currently severed.
