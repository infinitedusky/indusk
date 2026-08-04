---
title: "Dawn Hook Parity — invariants and the eval rail in the thin lane"
date: 2026-08-03
status: accepted
---

# Dawn Hook Parity — invariants and the eval rail in the thin lane

## Goal

**A thin-lane run leaves the same footprint a Claude Code session does — every invariant enforced, one commit per item, the eval queue fed — with zero Claude Code installed in the lane.**

Today an `atdawn run` produces no commits, no scorecards, and no lessons, and runs under the weakest gate policy by contract. Concretely: all three acceptance-matrix quality cells (C5–C7) left uncommitted working trees, and the lane has never fired the evaluator once. When this ADR ships, the control-group lane teaches the system the same way the primary lane does.

## Y-Statement

**In the context of:**
the Dawn thin lane (`atdawn run`) serving as both the control group for harness comparisons and the cheap mechanical execution lane, where InDusk's discipline currently enforces only 2 of 5 hooks (see [research.md](research.md) — the master's 6-hook count included one deleted in context-beam), makes zero git commits, never fires the eval agent, and is contractually `gate_policy: auto`.

**Facing:**
the constraint that the evaluator spawn requires the `claude` CLI (absent on remote cells, and a Claude Code dependency inside the lane whose whole point is decoupling), that commit behavior left to model discretion is demonstrably variable across drivers, and that `ask`-mode gate skips require a conversation with a human who isn't watching a headless run.

**We decided for:**
invariants-and-rail parity in four moves: (1) wire `claude-md-budget.js` into the existing edit-gate chain (it self-filters to CLAUDE.md writes by basename, so chain membership is sufficient); (2) loop-owned per-item commits — the loop itself commits at each verified checkoff with an intent-derived message, not the model via bash; (3) a durable pending-eval queue (`.indusk/eval/pending.jsonl`, append-only, one record per successful commit, markProcessed-style dedup at drain) drained by the existing `eval-trigger` CLI mode from any `claude`-capable environment, with `/rail-check` as the drain home and the pending count surfaced by health checks; (4) headless `ask` = pause — the loop recognizes `check-gates`' proof-less-skip refusal class and exits 3 with the gate question printed, making `ask` the default policy in both lanes with `auto` an explicit opt-in. `gate-reminder.js` is deliberately shed, recorded as the first entry of the invariant/procedure keep-shed audit.

**And against:**
literal hook-for-hook parity (porting advisory nudges as injected tool results — spends the scarce step budget on advice the boundary gates already enforce; the C3/C4 starvation finding is the cautionary tale); in-lane evaluator spawning (reintroduces the `claude` CLI dependency and breaks on remote cells); model-prompted commits (nondeterministic across drivers, and the queue append would ride on model compliance); one session-end eval over the final diff (loses per-item granularity, bisectability, and eval-while-fresh); and declaring headless runs `auto`-only (accepts the weakest policy exactly where no one is watching).

**To achieve:**
a thin lane whose runs are historied (per-item commits), taught-from (the eval→lessons rail flows), and maximally gated by default (`ask` everywhere), while every assertion in [test-plan.md](test-plan.md) — including A9's "no `claude` CLI anywhere in the lane" — holds on a bare remote cell.

**Accepting:**
eval latency (scorecards materialize at drain time, not commit time — the rail's value is durability, not immediacy); pause-and-rerun friction for `ask` plans headless (a human edit plus a re-invoke, made cheap by the loop's already-complete-phase skipping); commit noise in target repos from machine-authored commits (bounded by worktree-per-plan); one more queue file with its own dedup ledger to maintain; and nudge-less runs.

**Because:**
gates exist to enforce invariants and the reminder isn't one; deterministic loop-owned commits turn the queue append into our code instead of model behavior; the refusal plumbing for `ask` already exists — the loop only needs to classify it; and the drain design's hardest problems (idempotence, exit-code skip, backlog draining) were already solved by the eval rail — this plan reuses those invariants rather than re-learning them.

## Context

Component 2 of the [Dawn master](../../planning/indusk-v2-dawn/master.md). Research corrected the hook inventory (5 on disk; `check-plan-order.js` deleted in `62186774`) and found `eval-trigger.js`'s CLI mode — the manual-invocation path `/rail-check` already drains highlight backlogs through — meaning the drain half of the queue design exists. The loop's phase contract (`loop.ts:141`) currently never mentions commits; `loop.ts:125` records the `auto`-only contract this ADR retires.

## Decision

1. **Budget hook**: extend `GATE_SCRIPT_NAMES` in `src/lib/run/gate.ts` to include `claude-md-budget.js`; it runs in the same chain, self-filtering by target basename. Block messages pass through verbatim (A1 asserts on the shared script's text).
2. **Commit cadence**: after each checklist-item checkoff survives the gate chain, the loop stages the item's changed files and commits with a message derived from the item text (`item({plan} P{phase}): {item summary}`). Commit failure is surfaced, never silent; a failed commit enqueues nothing (A5).
3. **Pending-eval queue**: each successful commit appends `{ sha, plan, phase, source: "atdawn", timestamp }` to `.indusk/eval/pending.jsonl`. Drain = `eval-trigger` CLI mode iterating pending records from an environment with `claude`, marking each processed in a dedup ledger before spawn (the `already_processed → STOP` invariant). `/rail-check` gains the queue-drain step; `check_health` surfaces a growing pending backlog.
4. **Headless ask**: the loop classifies a `check-gates` refusal caused by a proof-less gate skip (distinct from a generic red) and exits 3, printing the gate item and the required conversation-proof format. Unset `gate_policy` resolves to `ask` in the thin lane (A8); `auto` remains available per-plan.
5. **Shed**: `gate-reminder.js` is not wired; the shed and its reasoning are recorded (this ADR + the master's component row + the keep-shed Horizon entry).

## Alternatives Considered

### Literal hook-for-hook parity
Rejected — see "And against": nudges spend steps for no invariant; the acceptance wording amended in the brief.

### In-lane evaluator spawn (`claude --resume` from the loop)
Rejected — CC dependency inside the decoupled lane; breaks on remote cells; violates A9.

### Model-prompted commits watched via the bash gate
Rejected — closest to literal CC parity but rides on model compliance (drivers demonstrably vary); the anchored-regex watch stays useful as defense-in-depth but is not the mechanism.

### Session-end single eval
Rejected — loses granularity and bisectability; the lane stays second-class.

### Declare headless auto-only
Rejected — accepts the weakest policy precisely where nobody is watching; the pause mechanism is cheap because the refusal plumbing exists.

## Consequences

### Positive
- The eval→lessons rail flows from every lane; the thin lane finally teaches the system.
- Per-item commits give component 6 (`dawn-verify`) a real git substrate — before-snapshots per item.
- `ask` as the universal default strengthens the weakest-link policy story.

### Negative
- Eval latency between commit and scorecard; drain cadence becomes a thing to own.
- Machine-authored commit volume in plan branches.

### Risks
- **Queue rot** (runs enqueue, nobody drains): mitigated by `check_health` surfacing pending count and `/rail-check` owning the drain.
- **Pause misclassification** (a generic red mistaken for a skip-question, or vice versa): mitigated by classifying on the refusal's structured message shape and A6/A7's paired tests.
- **Commit staging scope** (loop commits sweeping unrelated files): mitigated by staging only the item's changed files and asserting message↔item correspondence in A2.

## Documentation Plan

### Pages
- Update: `reference/cli/run.md` — commits, queue, exit-3 pause semantics, `ask` default, A9 promise.
- Update: the rail/eval reference (`/rail-check` drain step; queue file format).
- Update: `.indusk/planning/indusk-v2-dawn/master.md` — component 2 row, hook count correction, shed record.

### Diagrams
- Small sequence diagram (Mermaid) in `reference/cli/run.md`: checkoff → gate chain → commit → queue append → later drain → scorecard.

### Changelog
- "Thin lane: budget hook wired, per-item commits, pending-eval queue + drain, headless ask pause; gate-reminder shed recorded."

### ADR in Docs
- Yes: `decisions/dawn-hook-parity.md` at plan close.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/archive/dawn-external-orchestrator/` (loop, gate chain, matrix findings F1–F10)
- `.indusk/planning/archive/eval-agent-mcp-access/` (eval rail invariants this design reuses)
