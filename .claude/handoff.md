# Handoff

**Date:** 2026-04-15
**Session:** Agent roles ADR + impl, MCP orchestration layer brief, master plan, plan ordering enforcement, code-level weighting research

## What Was Being Worked On
`agent-roles` plan — completed brief (accepted previous session), ADR (accepted this session), impl (written this session, status: draft). Also created `mcp-orchestration-layer` brief and `master.md` pipeline document.

## Where It Stopped
`agent-roles` impl is written and ready for `/work`. Four phases:
1. Highlights queue infrastructure (utilities + MCP tools)
2. Migrate planner/work/retro skills from `graph_capture` to highlights
3. Eval agent prompt update to read highlights with weighted processing
4. `/highlight` command, session-end trigger, CLAUDE.md role docs

No code has been written yet — only planning documents.

## What's Next
1. **`/work agent-roles`** — start Phase 1, build the highlights queue infrastructure
2. After agent-roles completes: pick up `hermes-inspired-improvements` ADR (transcript search over existing Claude Code session JSONL files)
3. After that: `mcp-orchestration-layer` needs brief review and acceptance
4. `graph-knowledge-architecture` has an impl draft that needs review in light of the agent-roles decisions (eval agent as sole structured writer, highlights as input)

## Open Issues
- Biome nested root config error (pre-existing)
- Docs build broken (pre-existing, infrastructure.md)
- indusk-portfolio container restarting (exit code 254)
- Beam Graphiti query slow (~1048ms)
- 5 rapid describes = 5 parallel judges (race condition)
- OTel health checks fail (expected — dusk has otel.role: library)
- `graph-knowledge-architecture` impl was drafted before agent-roles ADR — it may need adjustments to align with the highlights queue pattern

## Decisions Made This Session
- **Agent roles ADR accepted** — three-tier model (working agent, eval agent, infrastructure) with highlights queue as interface. Working agent writes highlights, eval agent processes into structured Graphiti knowledge. Captured in `.indusk/planning/agent-roles/adr.md` and Graphiti.
- **Highlight levels map to graph edge weights** — critical=1.0, important=0.6, note=0.3. Levels guide eval agent effort AND become edge weights in Graphiti.
- **Structural connections inferred through shared nodes, semantic connections get explicit weighted edges.** If A and B both import from C, infer A↔B through C. Don't create direct A→B edges for structural relationships.
- **Code-level weighting added to lsp-structural-indexing brief** — co-change frequency, fan-in, churn, coupling depth, bug density. All derivable from jj history + LSP + eval findings.
- **Master plan enforcement** — `check-plan-order.js` hook reads `blocked_by` from brief frontmatter, checks if dependencies are archived. Exit code 2 (ask approval, not hard block).
- **MCP orchestration layer** is its own plan — intent translation (Claude says what it wants, InDusk fills in correct syntax/config), compound operations (multi-MCP-server sequences), and request logging.

## Watch Out For
- `check-plan-order.js` hook is installed in `.claude/settings.json` and `.claude/hooks/` — it reads `blocked_by` from brief frontmatter. All downstream briefs have been updated with `blocked_by` fields.
- `master.md` at `.indusk/planning/master.md` defines the pipeline order. Keep it updated as plan statuses change.
- Hermes repos at `/tmp/hermes-agent` and `/tmp/hermes-CCC` are ephemeral — key findings captured in `.indusk/planning/hermes-inspired-improvements/research.md`.
- Two new research notes in `.indusk/research/`: `visual-planning.md` (diagrams as source of truth) and `indusk-interface.md` (VS Code fork / non-code-forward interface).
- `graph-knowledge-architecture` already has a full impl draft but it was written before agent-roles. The "eval agent as sole writer" concept is confirmed but the mechanism changed (highlights queue, not transcript-only inference). The impl may need Phase adjustments.

## Catchup Status
- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] health
- [x] context
- [x] graphiti
- [x] plans
- [x] skills
- [x] extensions
- [x] graph
