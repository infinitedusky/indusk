# Handoff

**Date:** 2026-04-07
**Session:** Closed out `graphiti-infrastructure` plan end-to-end (13 phases, 227 items, 4 npm publishes v1.10.0→v1.10.3, retrospective written, plan archived). Created `cgc-graphiti-evaluation` spike. chitin-sportsbook scaffold-bootstrap ran end-to-end as the Phase 6 substrate. The system functionally works.

## What Was Being Worked On

Final closeout of `graphiti-infrastructure`. All 13 phases (Phases 0–9 plus inserted 1.5, 5.25, 5.5) marked complete. Retrospective skill ran the full 9-step audit. Plan moved to `.indusk/planning/archive/graphiti-infrastructure/`.

The actual work this session, in order:
1. v1.10.0 publish (Phase 5.5 implementation: graphiti MCP registration, capture/recall triggers in 5 skills)
2. Phase 5.25 inserted mid-session: optional `otel.role` field, role-aware OTel gate, swept all OTel sections from indusk-mcp's plans, indusk-mcp set to `otel.role: library`
3. v1.10.1 publish (Phase 5.5 verification work)
4. v1.10.2 publish (dash0 traces-first restored to source — `indusk update` had reverted local-only edits)
5. chitin-sportsbook created from scratch as the Phase 6 substrate
6. Phase 6 hyphen bug discovered (`RediSearch: Syntax error at offset 18 near chitin`)
7. v1.10.3 publish (`sanitizeGroupId` helper + 10 unit tests)
8. chitin-sportsbook ran `scaffold-bootstrap` end-to-end (brief→impl→retro→archive) with full capture/recall
9. The validation moment: agent in infinitedusky answered "find indusk-mcp problems from chitin-sportsbook" entirely from Graphiti without reading any retrospective files
10. `cgc-graphiti-evaluation` spike plan created (replaces abstract Phase 6 evaluation with real experimental program)
11. `graphiti-infrastructure` retrospective written, 7 lessons captured to Graphiti, decisions/graphiti-infrastructure.md added to docs site, plan archived

## Where It Stopped

`graphiti-infrastructure` is **completed and archived**. CLAUDE.md updated. VitePress sidebar updated. Retrospective skill ran clean.

The system is in a clean closing state. No mid-item work in progress.

## What's Next

In priority order — pick whichever feels right:

1. **`/planner cgc-graphiti-bridge`** — promote the draft brief to a real plan. The current brief is scoped too small ("two graphs talking"); rewrite it with the **unified-graph "files as anchors"** vision (CGC nodes projected into the Graphiti project graph, file paths as join key, `describe_file` MCP tool, eventual Dash0 log/trace projection). Then ADR, then impl. **This is the next major infrastructure work and the natural successor to graphiti-infrastructure.**

2. **`/retrospective local-init-mode`** — quick win, completed impl that never went through the retrospective skill. One focused session.

3. **Continue chitin-sportsbook work** — start the next plan there (`db-schema` is the natural next step per `sportsbook-bootstrap/research.md`). Each plan adds substrate for the cgc-graphiti-evaluation spike.

4. **Decide on `react-native-support`** — its OTel substance should fold into dusk-v2's OTel-as-extension work. Either explicitly archive it or roll the OTel content into a future plan.

5. **`/planner` something for `dusk-v2`** — still parked at decision #1 (built-in extension storage). Pick back up after CGC + Graphiti experiment yields more lessons.

## Open Issues

- **8 polluted Graphiti episodes in `main` group** from two malformed `add_memory` parameter syntax errors (one earlier this session, one in this very retrospective). The bug: closing `<parameter name="episode_body">` with `</episode_body>` and using `<parameter name="group_id">` (without `antml:` prefix). Fallback group is `main`. `delete_episode` requires UUIDs that `get_episodes` doesn't reliably return. Tracked as a follow-up in `cgc-graphiti-evaluation` research doc.
- **Duplicate `vision-unified-knowledge-graph-files-as-anchors` episode in `shared`** from the same parameter-syntax bug earlier in the session. Same cleanup category.
- **`get_episodes` API returns empty for groups that clearly have episodes** (verified by `search_nodes` returning their entities). Some kind of API/semantics mismatch worth investigating.
- **Phase 5.25's gate sub-headings use `### Verification` (level 3) instead of `#### Phase 5.25 Verification` (level 4)** — cosmetic, the validate-impl-structure hook doesn't see them as gate sections, but the impl is closed so it doesn't matter unless any future tooling does depth-aware parsing.
- **`apps/otel-test*/biome.json` nested config still blocks root `pnpm check`** — pre-existing, scoped check works. Pre-existing footnote, not from this work.

## Decisions Made This Session

All formalized in CLAUDE.md or the archived plan, but worth flagging:

- **Option C for Graphiti exposure**: register Graphiti directly in `.mcp.json` as a top-level MCP server (like dash0), keep `GraphitiClient` wrapper for internal use only, no double-wrapping. (Now in CLAUDE.md Key Decisions.)
- **`otel.role` field is the template for cross-cutting gate opt-outs**: optional field, backwards-compatible default, hooks read inlined helpers because they can't import the TS one. Pattern should be reused for any future cross-cutting gate (security, accessibility, performance). (Now in CLAUDE.md Key Decisions and Conventions.)
- **`shared` Graphiti is for cross-project conventions AND meta-information about the project landscape** — not for in-project implementation discussions. The rule: "could this be codified in a skill, lesson, CLAUDE.md, or shipped source code? If yes, codify there. If no AND it's cross-project AND has no other home, then `shared`." (Captured as `correction-shared-vs-codified-channels` in `shared` Graphiti.)
- **Unified-graph "files as anchors" vision**: CGC structural data and Graphiti episodic data both attaching to the same file/symbol nodes is the architectural endpoint. cgc-graphiti-bridge plan needs to be rewritten with this scope. (Captured in `infinitedusky` Graphiti as `vision-unified-knowledge-graph-files-as-anchors`; meta version in `shared`.)
- **chitin-sportsbook is a Numero module candidate**, not a permanent standalone project. Stack consistency with Numero matters (Fastify, pnpm, Turborepo, Drizzle). The previous codename "chitin" still appears in chitin-sportsbook's name and is intentional. (Captured in `shared` Graphiti as `meta-chitin-sportsbook-numero-relationship`.)
- **Phase 6 evaluation moves to the cgc-graphiti-evaluation spike**, which is a real experimental program (two-arm comparative study, pre-registered hypotheses, falsifiability, iterative methodology). NOT a one-shot validation. (Spike plan exists at `.indusk/planning/cgc-graphiti-evaluation/research.md`.)

## Watch Out For

- **Don't manually call `mcp__graphiti__add_memory` from any project unless you've verified the rule**: if the knowledge could be codified in a skill, lesson, CLAUDE.md, or source code, codify it there. `shared` Graphiti is the third option, not the first. The `correction-shared-vs-codified-channels` episode in `shared` has the full rule.
- **`mcp__graphiti__add_memory` parameter syntax requires `<parameter name="...">` not `<parameter name="...">`** — using the wrong opening tag silently sends the call without the parameter, which falls back to default group `main`. Verify the response says the right group, not `'main'`.
- **chitin-sportsbook still uses the workaround override** `graphiti.groupId: chitin_sportsbook` in `.indusk/config.json`. With v1.10.3 the auto-sanitization makes this redundant — `basename("chitin-sportsbook")` → `chitin_sportsbook` automatically. Either way works; explicit override always wins.
- **5 indusk-mcp bugs were captured in `chitin_sportsbook` Graphiti** during scaffold-bootstrap retro. Real, actionable, queryable: index_project not idempotent, no `--force` flag, graph_ensure doesn't detect staleness, OTel health checks not monorepo-aware, init scaffolds single-app layout. None filed as bugfix plans yet — they live in Graphiti, queryable on demand.
- **graphiti container has been up 40+ hours**, persistent volume `indusk-data` is fine. No need to restart unless you want to test graceful degradation.
- **jj has many stacked changes from this session** (Phase 5.5 + 5.25 + dash0 + v1.10.x bumps + retrospective + spike). Sandy may want to review the log before pushing. Detached HEAD is normal for this repo.
- **The `archive/` directory is a special name in `list_plans`** — it shows up as a "plan" with stage `unknown`. That's a quirk of the parser; harmless. Don't `/work archive`.
- **CGC graph is current after `index_project` calls today** — 118 files, 19821 functions in `cgc-infinitedusky`. chitin-sportsbook also indexed. Both should still be valid next session.

## Catchup Status

- [x] mcp-ready
- [x] handoff
- [x] lessons
- [x] skills
- [x] health
- [x] context
- [x] plans
- [x] extensions
- [x] graph
- [x] graphiti
