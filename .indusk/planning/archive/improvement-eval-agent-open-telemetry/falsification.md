# Falsification Log — improvement-eval-agent-open-telemetry

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-18T01:03:42.437Z

**Hypothesis:** Hook embedded evaluatorScript uses require() in ESM scope — every hook-spawned evaluator crashes at parse before reaching initEvalOtel; stdio:ignore swallows the error. Consequence: OTel plan Deferred Verification mitigation (jj describe → trace in Dash0) was satisfied only via direct invocations. Scorecards in results.log since 2026-04-11 all came from direct invocations, not jj describe.
**Test:** apps/indusk-mcp/src/__tests__/falsification-hook-esm-require.test.ts
**Outcome:** spawn
**Note:** Existing plan bug-fix-eval-agent already queued for this exact class. Its Phase 1 diagnosis + Phase 2 fix cover converting inline script to ESM-native imports OR switching spawn to CJS. This falsification confirms its premise and tightens scope. No new plan needed — bug-fix-eval-agent inherits the finding.

## Terminated 2026-04-18T01:05:22.765Z

**Reason:** One confirmed hypothesis (hook ESM-require crash) routed to existing bug-fix-eval-agent plan. Investigated additional vectors around env-header regex edge cases, concurrent init race, withSpan exception handling, shutdown ordering, and recurse-path status propagation — no further concrete attack vectors found. Regions not investigated: Dash0 ingestion internals (out-of-repo), OTel SDK internals (upstream), Claude CLI telemetry (separate surface).

