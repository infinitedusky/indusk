# Handoff

**Date:** 2026-04-09
**Session:** cgc-graphiti-bridge Phases 5–6 built + ce networking cleanup + semantic graph overview docs with Mermaid diagrams

## What Was Being Worked On

`cgc-graphiti-bridge` — continuing from Phase 4 (completed last session). This session built Phases 5 and 6, plus pulled forward the overview documentation from Phase 9.

Also cleaned up vestigial composable.env networking config (`networking.env`, `platform-base.vars.json`) and migrated to `${service.*}` auto-generated vars from `ce.json` profiles.

## Where It Stopped

**Phase 6 complete — all implementation, verification, context, and document gates done.** 66 tests across 8 files, all passing. Full sync against real cgc-infinitedusky: 10,156 anchors + 155 import edges.

Phase 5 adapter.ts was extended with `AdapterEdge` type and optional `edges()` method on the interface to support edge projection generically. sync-engine.ts projects edges after anchor diffing — tracks identity→UUID mappings during the diff pass so edges can reference anchors by identity string.

**No jj commits were made this session.** All work sits on jj change `mylvxovm` (which already had the Phase 5 description from last session). The ce cleanup is also uncommitted. These should be split into separate commits:
1. ce networking cleanup (delete networking.env, delete platform-base.vars.json, update components + contracts)
2. Phase 5: adapter interface + sync engine + 12 unit tests
3. Phase 6: CGC adapter + 5 integration tests + runtime-client queryAnchors method
4. Docs: semantic graph overview page with Mermaid diagrams + sidebar config

## What's Next

1. **Commit the work.** Split `mylvxovm` into the 4 logical commits above using `jj split`.

2. **Phase 7: Graphiti capture wrapper.** `graphiti-log-wrapper.ts` that dual-writes to Graphiti and the event log. Update planner/work/retrospective skills to route captures through it. Unit test with fake GraphitiClient and fake log writer.

3. **Phase 8: MCP tools + CLI.** `graph_sync`, `graph_rebuild`, `graph_status` — both MCP tools and `indusk graph` CLI commands.

4. **Phase 9: Init plumbing + work skill gate + smoke tests.** Verify init modes, add phase-end sync trigger to work skill, smoke test on infinitedusky and chitin-sportsbook.

5. **Testing strategy.** User wants to develop a testing approach that grows over time to validate the system as it's built. Discuss after the bridge is complete (or alongside remaining phases).

## Open Issues

- **Biome nested root config error.** `pnpm check` fails with "Found a nested root configuration." Pre-existing, not caused by this session. Needs `biome migrate --write` or manual config fix.

- **First sync is slow.** 73 seconds for ~10k anchors + 155 edges on infinitedusky. Acceptable for v1 but worth noting. The bottleneck is `git hash-object` called once per file (118 sequential shell invocations). Could batch with `git hash-object --stdin-paths` in the future.

- **Anchor count is ~10k, not ~20k as the impl predicted.** CGC reports 19,821 functions but the adapter snapshot returned fewer. Likely because CGC indexes build artifacts (`.js` chunks) that have functions but the adapter queries `File -[:CONTAINS]-> Function` which may not cover all function nodes. Not a bug — the impl estimate was based on raw CGC counts, not the join query.

- **`.indusk/graph/semantic-graph.log` now has real data.** The manual sync test wrote 10,312 events (3.3MB) to the log. This is live data in the working copy. It's gitignored via `.indusk/` exclusion in local mode. Don't delete it — it's the first real semantic graph for infinitedusky.

## Decisions Made This Session

- **`AdapterEdge` type added to the adapter interface.** Edges are identity-string-based (not UUID-based) so the sync engine can resolve them after the anchor diff pass. The `edges()` method is optional on the interface — adapters that don't discover relationships just omit it.

- **Internal imports only for v1.** CGC adapter filters IMPORTS to relative specifiers (`./`, `../`) only. npm packages, `node:*` builtins, and all external dependencies are excluded. The user explicitly requested this.

- **Composable.env `networking.env` component is dead.** Replaced by `${service.<name>.address}`, `${service.<name>.suffix}`, `${service.<name>.domain}` auto-generated from `ce.json` profiles. `platform-base.vars.json` also deleted — its vars moved to nowhere (portfolio contract can add `NEXT_PUBLIC_*` vars directly if needed later). Contracts have `includeVars: []` (empty array, user preference over removing the key entirely).

- **Overview docs pulled forward from Phase 9.** User wanted the system documented with diagrams for presentation and thinking. The overview page has 7 Mermaid diagrams covering architecture, data flow, concepts, and adapter extensibility. All 7 semantic-graph reference pages are now in the VitePress sidebar.

## Watch Out For

- **No commits made.** Everything is on the working copy of `mylvxovm`. First thing next session should be splitting and committing, or at least describing the change.

- **`semantic-graph.log` has real data.** Don't clear it unless you also clear the FalkorDB `semantic-infinitedusky` runtime. They should stay in sync. `indusk graph rebuild` (Phase 8) will formalize this.

- **The `queryAnchors` method was added to `runtime-client.ts`.** This is consumed by the sync engine. If the runtime-client tests break, check that the new method's Cypher is correct — it returns all anchor properties including `kind`, `name`, and `blob_hash`.

- **SyncResult has an `edges_attached` field now.** Any code that destructures SyncResult needs to account for this.

- **`adapter.ts` has two exports: `AdapterRecord` and `AdapterEdge`.** The barrel `index.ts` re-exports both. The `AdapterEdge` type is used by sync-engine and the CGC adapter.

- **Ce contracts have `includeVars: []`.** The user manually edited these after I removed the key entirely. They prefer the empty array over omitting the key.

## Catchup Status

- [x] mcp-ready (session 2026-04-09)
- [x] handoff
- [x] lessons
- [x] health
- [x] context
- [x] graphiti
- [x] plans
- [x] skills
- [x] extensions
- [x] graph
