# indusk-makeover — Phase 0 Baseline (2026-07-23, dusk repo)

Red-first measurements from `scripts/makeover-gates.sh` + `scripts/check-pointers.sh`.
All gates FAIL by design; they flip green at their `Passes at` phases.

| Gate | Baseline (red) | Target (green) |
|------|----------------|----------------|
| A1 CLAUDE.md size | **142,653 bytes** (~35k tokens) | ≤ 61,440 bytes (Phase 6) |
| A3 pointer integrity | **38 dead / 142 scanned** | 0 dead (Phase 6) |
| A7 graphiti/CGC presence | present in `.mcp.json` + `.indusk/extensions/{graphiti,cgc}` | absent (Phase 3) |
| A11 active plan dirs | **23** | ≤ 15, dead drafts archived (Phase 6) |
| A12 MCP keep-lists | project extra=[chrome-devtools, codegraphcontext, excalidraw, graphiti], missing=[posthog]; global extra=[chrome-devtools, context7, supabase, tmux, vibe_kanban] | project = indusk/dash0/posthog/jaeger; global = playwright (Phase 6) |
| A5 catchup token cost | **~55k (provisional — research.md measurement, 2026-07-23)** | ≤ ~15k (Phase 6) |
| A6 catchup read-set | Graphiti query present, duplicate CLAUDE.md fetch present (per research.md observation) | 0 Graphiti calls, single CLAUDE.md ingestion (Phase 4) |

## Notes

- **Divergence from research.md**: the research's headline 488 KB CLAUDE.md / 109 active
  plans were measured on the **numero workbench**. dusk's own numbers (above) are smaller —
  142.6 KB and 23 plan dirs — but still 2.3× over budget and well past the plan threshold.
  The upstream mechanisms built here apply to both; numero's migration runs from its own
  plan copy.
- **A5/A6 provisional**: a dusk-specific fresh-session catchup measurement requires a cold
  session (procedure at `scripts/catchup-measurement.md`). Running one from inside this
  session would under-count (warm context). The research.md ~55k measurement stands as the
  red baseline; capture dusk's exact number at the next natural fresh session and append here.
- **A3 scanner artifacts**: 3 of the 38 "dead" pointers are prose-prefix artifacts
  (`apps/indusk-mcp/src/__tests__/telemetry-`, `packages/telemetry-binaries-` — truncated
  family references — and `.indusk/agents/` which CLAUDE.md itself describes as no longer
  used). The remaining ~35 are genuinely dead: archived plans referenced without
  `archive/`, the pre-rename `apps/indusk-docs` paths, and deleted files (`skills/jj.md`).
  Compression at Phase 6 must fix these as it rewrites entries; refine the walker only if
  artifacts persist post-compression.

## Measurement log

| Date | Phase | A5 ~tokens | A6 graphiti calls | A6 dup CLAUDE.md read |
|------|-------|-----------|-------------------|----------------------|
| 2026-07-23 | 0 | ~55k (provisional, research.md) | ≥1 | yes |
| 2026-07-23 | 4 (post-diet, pre-backfill) | **~8,221** (cold `claude --print` session 6dd91742) | **0** | **no** |
