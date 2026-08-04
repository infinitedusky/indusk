# Dawn Hook Parity — invariants and the eval rail in the thin lane

**Decision (2026-08-03):** give `atdawn run` the same footprint a Claude Code session leaves — every *invariant* hook enforced, one commit per checklist item, the eval→lessons rail fed — with **zero Claude Code installed in the lane**. Deliberately shed the one hook that isn't an invariant.

Full ADR in the archive: `.indusk/planning/archive/dawn-hook-parity/adr.md`. CLI reference: [`indusk run`](/reference/cli/run). Component 2 of the [Dawn master plan](/dawn/).

## The four moves

1. **`claude-md-budget.js` joins the gate chain.** Chain membership is the whole wiring — the script self-filters to CLAUDE.md writes by basename, and its own stderr is the block message, so both lanes refuse an over-budget write identically.
2. **Loop-owned per-item commits.** The loop, not the model, commits at each verified checkoff. Deterministic across drivers (model commit behavior demonstrably varies), and it puts the eval-queue append in our code rather than in model compliance.
3. **A durable pending-eval queue with an external drain.** Each commit appends to `.indusk/eval/pending.jsonl`; `eval-trigger.js --drain-pending` evaluates each record exactly once from any `claude`-capable machine. `/rail-check` owns the drain; `check_health` surfaces the backlog.
4. **Headless `ask` = pause.** `check-gates` already refuses proof-less gate skips under `ask`; the loop now recognizes that refusal and exits 3 with the question and the exact proof format, instead of red-stopping. `ask` becomes the default in both lanes; `auto` is an explicit per-plan opt-in.

**And one shed:** `gate-reminder.js` is deliberately not wired — an advisory nudge is not an invariant, and an unattended loop would spend scarce steps on advice the boundary gates already enforce. Recorded as the first entry of the invariant/procedure keep-shed audit, because a silent omission and a considered shed look identical six months later.

## Tradeoffs accepted

- **Eval latency.** Scorecards materialize at drain time, not commit time — the rail's value here is durability, not immediacy.
- **Pause-and-rerun friction** for `ask` plans run headless: a human edit plus a re-invoke, made cheap by the loop skipping already-complete phases.
- **Machine-authored commit volume** in plan branches, bounded by worktree-per-plan.
- **One more queue file** with its own dedup ledger to maintain.

## Rejected

- **Literal hook-for-hook parity** (porting the nudge as injected tool results) — spends the scarce step budget on advice the gates already enforce.
- **In-lane evaluator spawning** — reintroduces the `claude` CLI dependency into the lane whose whole point is decoupling, and breaks on remote cells.
- **Model-prompted commits** — closest to literal parity, but rides on model compliance.
- **One session-end eval over the final diff** — loses per-item granularity and bisectability.
- **Declaring headless runs `auto`-only** — accepts the weakest policy precisely where nobody is watching.

## What falsification changed

Four hypotheses, all confirmed as real defects, all fixed — and one of them refuted its own proposed remedy:

- A batched checkoff named one item of four; commit messages now account for every item they contain.
- A failed commit left work staged that the next commit absorbed. The obvious fix (unstage) is **impossible** — `git reset` cannot un-write the working tree, and destroying the work would be worse. The remedy is **carry-forward attribution**: the commit that actually carries the work names it.
- A drain whose evaluator couldn't run marked every record drained and destroyed the backlog. The ledger entry is now **provisional** — a failed evaluator un-drains its record, and the drain reports the failures.
- A landed commit whose queue append failed was reported as a commit failure. Queue-append failure now has its own channel; a commit that lands is reported as landed.
