# Falsification Log — agent-roles

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-18T02:09:28.658Z

**Hypothesis:** The eval agent — described in agent-roles' architectural split as 'the sole structured writer to Graphiti at trigger points' — is not calling any MCP tools when spawned by the hook. Every evaluator scorecard in results.log shows graphitiWrites: 0, including a full-catchup run that had the explicit Step 4 + Step 5 prompt instructions to call mcp__indusk__highlights_unprocessed / graph_capture / highlight_mark_processed. .indusk/highlights.jsonl has 3 queued entries; .indusk/highlights-processed.jsonl doesn't exist after any run. Likely cause: the claude --print subprocess doesn't discover .mcp.json (or session-resume doesn't restore tool inventory). The architectural split ships its working-agent half correctly (highlight tool works from interactive session) but the eval-agent half is currently a no-op.
**Test:** .indusk/eval/results.log (empirical: 5 runs, graphitiWrites=0 each; highlights-processed.jsonl absent despite 3 queued highlights)
**Outcome:** spawn
**Note:** Spawned eval-agent-mcp-access plan (.indusk/planning/eval-agent-mcp-access/brief.md) to diagnose + fix the MCP tool access gap in the spawned claude --print subprocess. agent-roles' architectural contract (working agent → highlights queue → eval agent → Graphiti episodes) is satisfied on the working-agent side; the eval-agent side is blocked on MCP access which is downstream infrastructure. Pattern matches bug-fix-eval-agent — agent-roles documents the right architecture, downstream plan makes it operational.

## Terminated 2026-04-18T02:09:28.659Z

**Reason:** One confirmed hypothesis: eval agent is not writing Graphiti despite the architectural split requiring it; cause is MCP tool inaccessibility in the spawned subprocess. Spawned eval-agent-mcp-access plan to fix. agent-roles' in-scope contract (highlights queue + roles documentation + eval agent prompt asks to process highlights) is shipped; the 'eval agent actually processes' operational claim is deferred to the downstream plan. No other in-scope hypotheses surfaced — the other potential vectors (highlights.jsonl schema, ID sequence, level-to-weight mapping) are all covered by passing unit tests (T1-T10).

