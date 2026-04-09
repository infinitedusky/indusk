# Handoff

**Date:** 2026-04-09
**Session:** cgc-graphiti-bridge Phases 5–9 completed + retro + local-init-mode retro + two follow-up fixes + context-eval plan (brief accepted, ADR accepted)

## What Was Being Worked On

Three major threads this session:

1. **`cgc-graphiti-bridge`** — completed Phases 5–9, retrospective, archived. The semantic graph bridge is live.
2. **`local-init-mode`** — retrospective run, archived.
3. **`semantic-graph-eval`** — new plan. Brief accepted, ADR accepted. Ready for impl.

## Where It Stopped

**`semantic-graph-eval` ADR accepted.** Next step is writing the impl. The plan is a commit-triggered judge agent that evaluates agent work quality at every jj commit.

All bridge work is committed on jj change `wmuylqvw` (graph_capture tool + batch hash-object). The retros, plan archival, ce cleanup, and eval plan docs are uncommitted on the working copy.

## What's Next

1. **Commit the current working copy.** Contains: local-init-mode retro + archival, cgc-graphiti-bridge retro + archival, plan-parser test fix, eval plan (brief + ADR), CLAUDE.md updates, sidebar additions. Split or commit as one.

2. **Write `semantic-graph-eval` impl.** The plan:
   - Commit-triggered jj hook that spawns a background judge agent
   - Judge does: read transcript → catchup → read diff → answer evaluation questions → log results
   - Read-only, auto-approve, Opus, full MCP access
   - Structured eval log at `.indusk/eval/results.log`
   - `/eval review` skill for manual trigger
   - `indusk eval summary` CLI for aggregations
   - v1 questions: conventions followed? steps skipped? better approaches? missing graph data?

3. **Update CLAUDE.md active plans table** — cgc-graphiti-bridge and local-init-mode removed (archived), semantic-graph-eval added.

## Open Issues

- **Biome nested root config error.** `pnpm check` fails with "Found a nested root configuration." Pre-existing. Needs `biome migrate --write` or manual config fix.

- **Plan-parser test uses `dusk-v2` as fixture.** Changed twice this session — first from `local-init-mode` to `cgc-graphiti-bridge`, then to `dusk-v2` after archiving both. If `dusk-v2` gets archived, the test breaks again. Should use a more stable fixture or create a dedicated test plan.

- **`graph_capture` MCP tool is registered but not tested end-to-end.** The tool wraps `captureWithLog` and is in `graph-tools.ts`. Build passes, but no manual verification that it works when called via MCP.

- **CGC index is stale.** Some files in the CGC graph no longer exist on disk (e.g., `logger.ts`). The batch `git hash-object` filters these via `existsSync`, but the stale nodes produce tombstones on every sync. Re-indexing (`mcp__indusk__index_project`) would clean this up.

- **`.indusk/graph/semantic-graph.log` has ~11k events (3.5MB).** Growing. Log compaction is future work.

## Decisions Made This Session

All captured in ADRs and CLAUDE.md:

- **`AdapterEdge` type + optional `edges()` on the adapter interface** — edges are identity-string-based, resolved to UUIDs during the diff pass. Internal imports only (relative specifiers), externals excluded.
- **Batch `git hash-object --stdin-paths`** — single subprocess for all file hashes. Filters stale CGC paths via `existsSync`. Snapshot test dropped from ~4.6s to ~0.9s.
- **`graph_capture` MCP tool** — wraps `captureWithLog`, skills updated from "when available" to "prefer."
- **Context eval: commit-triggered judge agent** — separate Opus agent, read-only, does catchup, reads transcript + diff, answers questions. Evaluation is verification — easier than creation because the judge knows the outcome.
- **Composable.env cleanup** — deleted `networking.env`, `platform-base.vars.json`. Migrated to `${service.*}` auto-generated vars from `ce.json` profiles. Contracts have `includeVars: []` (Sandy's preference for empty array over omitting key).

## Watch Out For

- **No jj commits for retros/archival/eval plan.** All of that is on the working copy. Commit before starting new work.

- **`semantic-graph-eval` is the plan name but the brief/ADR are about evaluating the entire context system, not just the semantic graph.** The name stuck from when it started as a graph eval. Consider renaming if it causes confusion.

- **The eval judge needs `claude --print` or similar for background spawning.** Research confirmed `transcript_path` is available in hook input. But the exact mechanism for spawning a read-only background Claude Code session needs implementation work — the impl should investigate `claude --print`, `claude` with flags, or API calls.

- **Skills say "prefer `mcp__indusk__graph_capture`" but the working agent may not have it if indusk MCP server hasn't restarted.** After the next publish/restart, the tool will be available.

- **Sidebar has 2 new entries** (local-init-mode decision, semantic-graph-bridge decision) + local-mode guide. Not committed yet.

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

<!-- Session 2026-04-10 catchup complete -->
