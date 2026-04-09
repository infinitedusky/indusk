# Context System Evaluation

> ADR — accepted 2026-04-09

## Y-Statement

In the context of **measuring whether InDusk's context system makes agents better at real development tasks**, facing **no way to know which context layers matter, which have gaps, and whether the system is improving over time**, we decided for **a commit-triggered evaluator that runs on its own worktree, does a full project catchup, reads the session transcript and diff, answers evaluation questions, writes derived insights to Graphiti, and logs structured scorecards — with a baseline mode that pits a stripped-down vanilla agent against the same rubric to measure the context system's delta** and against pre-assembled context packages, inline self-evaluation, A/B replays, and RAG evaluation frameworks, to achieve **continuous, zero-friction quality measurement with actionable findings and trend data**, accepting the cost of one Opus agent per commit (~2 minutes compute), because **evaluation is inherently easier than creation — a judge that knows the outcome audits backward from certainty**.

## Key Decisions

1. **Two modes** — eval (always on, learning loop) and baseline (controlled experiment with vanilla agent)
2. **Worktree architecture** — eval runs in-place, baseline gets its own stripped worktree
3. **Judge is a full agent** — does real catchup, has full MCP access, produces scorecards + Graphiti writes
4. **Questions are the rubric** — adding a question is adding a line, no infrastructure change
5. **Two measurement dimensions** — absolute quality per commit + system improvement over time

## Links

- [Full ADR](../../.indusk/planning/semantic-graph-eval/adr.md)
- [Eval Reference](../reference/eval/overview.md)
- [Getting Started Guide](../guide/eval.md)
