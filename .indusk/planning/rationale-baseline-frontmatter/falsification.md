# Falsification Log — rationale-baseline-frontmatter

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-19T21:37:07.160Z

**Hypothesis:** JS hook port frontmatter regex /rationale_baseline:\s*(\d+)/ is not line-anchored, so a substring inside a quoted YAML value (e.g., a title mentioning the key) silently sets the baseline.
**Test:** apps/indusk-mcp/src/__tests__/rationale-baseline-falsify-substring.test.ts
**Outcome:** fix-in-scope
**Note:** Confirmed: fixture with title 'Documenting rationale_baseline: 1 semantics' exits 0 (passes) when default baseline=0 should require rationale for T1 (Writable at: Phase 1). Fix-in-scope: anchor regex to line start with /^rationale_baseline:\s*(\d+)/m and mirror to .claude/ port. ~5 line change. Same flaw exists for sibling regexes (gate_policy, rationale, trajectory, workflow) but those predate this plan and are intentionally out of scope.

