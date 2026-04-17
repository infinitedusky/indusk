# Falsification Log — bug-fix-eval-agent

Append-only record of the /falsify bounty hunt for this plan. Never edit in place; entries are appended via `appendHypothesis` and `markTerminated` from `apps/indusk-mcp/src/lib/falsification/log.ts`.

## Hypothesis 2026-04-18T01:38:44.810Z

**Hypothesis:** The regression regex at falsification-hook-esm-require.test.ts line 116-117 is `/require\("fs"\)/` and `/require\("path"\)/` — catches only the exact pre-fix double-quoted pattern. Someone reintroducing the CJS-in-ESM bug via single quotes `require('fs')`, backticks, whitespace variants, or aliasing (`const r = require; r('fs')`) would evade the regression guard. The plan claims T3 'proves the test would catch the original' — true for THAT original, but the guard is narrower than the invariant it protects (the invariant is 'no CJS require calls in the ESM-spawned script', broader than the specific pre-fix shape).
**Test:** apps/indusk-mcp/src/__tests__/falsification-regression-regex-coverage.test.ts
**Outcome:** fix
**Note:** Fix-in-scope: broaden the regex in falsification-hook-esm-require.test.ts to catch all CJS require() shapes. Specifically: /require\s*\(\s*['"`]fs['"`]\s*\)/ and similar for path. Covers single/double/backtick quotes, optional whitespace, and rejects the 6 variants the current test can't catch. Reopen impl.md Phase 2 to land this as a small hardening item.

## Terminated 2026-04-18T01:42:18.399Z

**Reason:** One confirmed hypothesis (regression regex too narrow — only caught exact double-quoted form) fixed in-scope via Phase 4: broadened the regex to handle single/double/backtick quotes + optional node: prefix + whitespace; bounty test at falsification-regression-regex-coverage.test.ts now passes. Additional vectors investigated without finding concrete attacks: writeErrorResult disk-full silence (edge-case, try/catch by design), appendFileSync + process.exit flush ordering (correct — sync), concurrent results.log writes (atomic under PIPE_BUF), evaluator-silent-exits audit regex proximity check (test-quality nit, not code bug), aliased require indirection (intentionally out-of-regex-scope). Regions not investigated: upstream OTel SDK internals, Dash0 ingestion, Claude Code subprocess handling.

