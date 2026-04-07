---
title: "Graphiti Infrastructure"
date: 2026-04-07
---

# Graphiti Infrastructure — Retrospective

## What We Set Out to Do

Bundle FalkorDB + Graphiti into a single persistent Docker container (`indusk-infra`), managed by the `indusk` CLI. Replace the broken model of standalone FalkorDB containers with infrastructure that starts with one command, persists data, and supports a future hosted upgrade path. Then surface Graphiti to the agent so the temporal knowledge graph can actually be used during sessions: capture decisions automatically at planner/work/retrospective trigger points, recall them at session start via catchup, and prove the whole loop works on a real project.

The original plan (10 phases — 0 through 9) covered: CGC graph naming convention, the bundled Docker container, CLI commands (`indusk infra start/stop/status`), an MCP client wrapper, the Graphiti extension (manifest, skill, health checks), `init` integration, end-to-end validation, GHCR publishing, an `indusk update` command, and extension versioning. Phase 5.5 was added mid-plan after a gap was discovered. Phase 5.25 was added later mid-plan when OTel gate noise became unworkable for indusk-mcp itself.

See [brief.md](brief.md), [adr.md](adr.md), [research.md](research.md), and [impl.md](impl.md).

## What Actually Happened

**Built end-to-end across multiple sessions over ~12 days, ending 2026-04-07.** Final shape:

- **13 phases** (the original 10 + Phase 1.5, Phase 5.25, Phase 5.5 inserted mid-plan as gaps were discovered)
- **227 items checked off** across implementation, verification, context, and document gates
- **Phases 0-5 landed roughly as planned.** The bundled container, CLI commands, MCP wrapper, extension, init integration, and Getting Started rewrite all happened in the original sequence with minor scope adjustments.
- **Phase 5.5 (Surface Graphiti to the Agent) was inserted as a new phase** mid-plan after discovering that Graphiti was running and reachable but had no MCP tool registration anywhere — meaning Phase 6's "validation" tests were unrunnable as written. This was the single biggest gap in the original plan.
- **Phase 5.25 (OTel Gate Role-Awareness) was inserted mid-Phase-5.5** after the OTel gate started generating skip-reason noise on every indusk-mcp impl edit. The fix added an optional `otel.role` field to `.indusk/config.json` and made the gate conditional, so libraries/tools/none-role projects skip the gate entirely. indusk-mcp itself was set to `otel.role: library` and all OTel sections were swept from this repo's plans.
- **Phase 6 (End-to-End Validation) was originally drafted as 15 abstract test items.** Most were satisfied implicitly when chitin-sportsbook (a sibling sandbox project created during this session as the substrate) ran the full planner→work→retrospective lifecycle on its first plan (`scaffold-bootstrap`) end-to-end. The handful of items not satisfied implicitly were either covered by existing graphiti-client.test.ts cases or superseded by the new `cgc-graphiti-evaluation` spike plan.
- **Phases 7-9 deferred or done in a simpler shape than planned.** Phase 7 (GHCR publishing) deferred — local builds work for the only consumer. Phase 8 (`indusk update` command) substantively done in a simpler shape than originally planned (no `--check`/`--component` flags, but the basic command exists, works, and got used multiple times this session). Phase 9 (extension versioning) deferred — premature without third-party extensions, belongs in dusk-v2.

**Code graph after the plan:** 118 files indexed (infinitedusky monorepo), 19,821 functions, 20 classes, 81 modules. Most of the growth from this plan came from `apps/indusk-mcp/src/lib/graphiti-client.ts` (~250 lines + tests), `apps/indusk-mcp/src/bin/commands/infra.ts`, `apps/indusk-mcp/src/bin/commands/update.ts`, the otel.role schema additions in `apps/indusk-mcp/src/lib/config.ts`, the two updated hooks (`validate-impl-structure.js`, `check-gates.js`), and the Graphiti extension manifest + skill.

**Version cadence during this plan:** v1.7.x → v1.8.0 → v1.9.x → v1.10.0 → v1.10.1 → v1.10.2 → v1.10.3, with v1.10.0 and v1.10.3 being the most consequential (Phase 5.5 capture/recall, hyphen sanitization fix discovered in chitin-sportsbook).

**Plans created in parallel that this plan unblocks or is unblocked by:**
- `cgc-graphiti-evaluation` (created during this session as a spike, replaces the abstract Phase 6 evaluation idea with a real experimental program)
- `cgc-graphiti-bridge` (still draft brief, currently scoped too small per Sandy's unified-graph-files-as-anchors vision; should be rewritten before any work)
- `dusk-v2` (research, parked at decision #1 — informed by what this plan revealed about extension storage, OTel gate handling, and config schema)
- `react-native-support` (parked — its OTel substance should fold into dusk-v2's OTel-as-extension work)

## Getting to Done

The unplanned work clustered into three buckets:

### 1. The Phase 5.5 gap (the biggest single learning of the plan)

Phase 5 finished with Graphiti running and the `init` command auto-installing the Graphiti extension. Everything looked done. **Then preparing for Phase 6 revealed that nothing in `.mcp.json` registered Graphiti as a server, no skill file showed real tool calls, and the agent had no way to call `add_memory` or `search_nodes` from a session.** The infrastructure was complete and the agent had no access to it. Phase 5.5 was inserted to close that gap: register Graphiti directly in `.mcp.json` via init, keep `GraphitiClient` wrapper as an internal helper (Option C — no double-wrapping), rewrite the graphiti skill with real `mcp__graphiti__*` tool calls, add capture triggers to planner/work/retrospective skills, add a recall trigger to catchup. Generalised the manifest schema (`mcp_server.add_command`) so the same auto-registration mechanism works for any future extension. This is the work that took the system from "the plumbing exists" to "the agent can actually use it." Without it Phase 6 would have been a no-op.

### 2. The OTel gate noise (Phase 5.25 insertion)

While doing Phase 5.5 implementation, every impl edit hit the OTel gate that fires by default on every phase. indusk-mcp is a library — it ships to other people's machines and doesn't produce telemetry — so every Phase N OTel section ended up as a `skip-reason: ...` line written to satisfy the hook. Recurring nag with no value. Sandy correctly identified this as a structural problem (the OTel gate is treating "produce telemetry" as a universal good when it isn't), and Phase 5.25 was inserted mid-Phase-5.5 to fix it: optional `otel.role` field in `.indusk/config.json`, conditional gate firing in the planner skill and both gate-enforcement hooks, sweep of all existing OTel sections from this repo's plans, indusk-mcp set to `otel.role: library`. Backwards compatible — projects without the field still get the gate. From this point forward no plan in indusk-mcp will have an OTel section unless explicitly opted back in.

### 3. The chitin-sportsbook hyphen bug (v1.10.3 patch)

Created chitin-sportsbook as the Phase 6 substrate. First catchup query against `chitin-sportsbook` Graphiti group failed with `RediSearch: Syntax error at offset 18 near chitin`. RediSearch treats `-` as a token separator, so `chitin-sportsbook` parses as "chitin AND NOT sportsbook" or similar. Workaround was a manual `graphiti.groupId: chitin_sportsbook` override in `.indusk/config.json`. Real fix landed as v1.10.3: `getProjectGroupId()` now sanitizes the basename via a new `sanitizeGroupId()` helper that replaces non-`[A-Za-z0-9_]` characters with `_`. Explicit overrides still trusted as-is. Added 10 unit tests covering edge cases (hyphens, dots, slashes, scoped npm packages, multiple separators, leading/trailing). This was the kind of bug that only shows up on a real project with a hyphen in its name — synthetic tests on `infinitedusky` (no hyphen) never would have caught it.

### Smaller surprises

- **`indusk update` re-installed the dash0 skill from npm and reverted local edits** that were never synced back to the source. The session-1 traces-first dash0 skill rewrite only existed in `.claude/skills/dash0/SKILL.md`, never in `apps/indusk-mcp/extensions/dash0/skill.md`. After `indusk update` ran, the published version overwrote the local edits. Fixed by re-applying the edits to BOTH source and installed, then bumping to v1.10.2 so the next publish ships them.
- **The `pre_tool_use` snake_case key in global `~/.claude/settings.json`** broke Claude Code's settings parser ("Invalid key in record") with no path or line number in the error. Took 10 minutes of digging to find. The fix was a one-line delete; the diagnostic experience was the actual cost.
- **`get_episodes` API returns empty for groups that clearly have episodes** (verified by `search_nodes` returning extracted entities from those same episodes). Some kind of API/semantics mismatch. Tracked as a follow-up in the cgc-graphiti-evaluation spike.
- **The graphiti skill and `.indusk/extensions/graphiti/manifest.json` were missing entirely from this project before this session** because graphiti was "enabled" by directory presence but the install logic only ran on first init or `--force`. Caught and fixed during Phase 5.5.
- **Phase 5.25 was structured with `### Verification`/`### Context`/`### Document` headings (level 3) instead of `#### Phase 5.25 Verification` (level 4)** which means the validate-impl-structure hook can't see them as gate sections. The hook was already happy with the existing impl content so this was cosmetic, but worth noting if Phase 5.25 is ever re-validated.

### Test failures we found and fixed along the way

`plan-parser.test.ts` and `impl-parser.test.ts` had 6 pre-existing failing tests caused by stale path references (`planning/archive/` vs `.indusk/planning/archive/` after the planning migration earlier). The previous handoff said "1 failing test (pre-existing)" — turned out to be 6, all path-related, all fixed by sed. Test suite went from 36 passing/6 failing to 46 passing/0 failing (+10 from the new `config.test.ts` for `sanitizeGroupId` and `getProjectGroupId`).

## What We Learned

1. **"The plumbing is done" is not the same as "the agent can use the plumbing."** Phase 5.5 only existed because we discovered, during preparation for Phase 6, that the entire stack was wired up except the one piece that exposes it to the agent. The lesson: when an infrastructure plan claims completion, ask explicitly "can a Claude Code session call this thing right now from a tool?" If the answer requires manual `claude mcp add` or manual file copies, the plan is not done.

2. **Cross-cutting gates need an opt-out mechanism per project.** The OTel gate firing on every plan in every project is correct as a default but wrong for libraries, CLIs, and tools that don't produce telemetry. The Phase 5.25 fix (optional `otel.role` field with backwards-compatible default) is the right shape and should be the template for any future cross-cutting gate. Future cross-cutting gates (security, accessibility, performance) should ship with the same role-aware pattern from day one rather than being retrofitted.

3. **Real projects discover real bugs.** The hyphen-in-group-id bug was invisible on `infinitedusky` (no hyphen). The five indusk-mcp issues that the chitin-sportsbook scaffold-bootstrap retrospective surfaced (index_project not idempotent, no `--force` flag, graph_ensure doesn't detect staleness, OTel health checks not monorepo-aware, init scaffolds single-app layout) were similarly invisible on a single-app project. **Stand up at least one real project per major release that's structurally different from the dev system's own monorepo**, or you'll miss this entire category of bugs.

4. **Phase insertions are not failures, they're feedback.** Phase 1.5, Phase 5.25, and Phase 5.5 were all inserted mid-plan as gaps were discovered. The temptation is to treat this as a planning failure ("we should have known"). The honest read is that some gaps are only visible after you've done the surrounding work. The plan structure is flexible enough to accommodate this — the impl parser handled `5.25` and `5.5` numbering without issue, the boundary map was updated, the gates fired correctly. Insertions are a feature, not a bug.

5. **The capture/recall loop only proves itself on cross-session work.** Within a single session, Graphiti is duplicate data — the agent already knows what just happened. The actual value of capture is when a future session retrieves something the agent would otherwise have forgotten. We saw this concretely at the very end of this session: I (the agent in infinitedusky) was asked "find any indusk-mcp problems from chitin-sportsbook" and answered from Graphiti without reading any retrospective files, because the chitin-sportsbook agent had captured them as episodes. **That was the moment the experiment validated itself in real time.** Multi-session validation belongs in the cgc-graphiti-evaluation spike, not in this plan.

6. **Skill markdown files DO change agent behavior, not just describe it.** The `community-one-concern-per-change.md` lesson was loaded by the chitin-sportsbook agent during its catchup, then explicitly applied during scaffold-bootstrap impl execution (the agent split unrelated biome auto-fixes into a separate `chore(hooks)` commit between phases). Lesson files travel via `indusk update` and become real behavior. This validates the entire "lessons + skills + capture + recall" stack as an information-flow architecture.

7. **The retrospective skill discipline is real.** chitin-sportsbook's first retrospective (scaffold-bootstrap) explicitly considered adding a Biome rule under Quality Ratchet and decided not to, with reasoning. That's discipline at the right moment — most retrospectives would reflexively add a rule to feel productive. The skill is asking the right question and the agent gave the right answer.

8. **Graphiti's entity extraction is much better than expected.** Episodes get processed in 5-15 seconds and the extracted entities are accurate, contextual, and queryable. From a single 86-line retrospective the system extracted ~15 named entities with ~25 facts attached, including typed relationships like `REQUIRES_UPSTREAM_PATCH_IN`, `LIMITATION_OBSERVED_DURING`, `SERVES_AS_WORKAROUND_FOR_ISSUE_WITH`. This is where the value comes from — not from the prose itself (which is in the file) but from the structured fact representation that lets you ask precise questions.

## What We'd Do Differently

1. **Run the "can the agent actually use this?" check at the end of every infrastructure phase.** Phase 5 was marked complete, then Phase 5.5 had to be inserted because the agent couldn't actually use the thing Phase 5 built. A simple per-phase question — "if I started a fresh Claude Code session right now in this project, what new MCP tools/skills/features would actually be callable?" — would have caught this at the end of Phase 5 instead of mid-Phase-6 prep.

2. **Add `otel.role` (or any "this project's relationship to a cross-cutting concern" field) to the config schema BEFORE writing any plans against the project that needs it.** Phase 5.25 retrofitted this. Anyone starting a library project from scratch in InDusk after dusk-v2 should be able to set `otel.role: library` during init and never see an OTel section.

3. **Check `pnpm test` passes BEFORE marking earlier phases done, not at retrospective time.** The 6 pre-existing test failures from the planning-directory migration would have been caught immediately if Phase 0 / Phase 1 verification had run the full test suite. They were carried for weeks across multiple plans before getting noticed.

4. **Sync source-skill edits to source location, not just the installed copy.** The dash0 traces-first revert happened because the original edits only touched `.claude/skills/dash0/SKILL.md` and not `apps/indusk-mcp/extensions/dash0/skill.md`. The skill source files in the npm package are the canonical source — installed copies are derived. Always edit source, then sync to installed. Any "edit installed only" path should be considered a smell.

5. **Insertion phases need their own gate section levels right.** Phase 5.25 used `### Verification` (level 3) instead of `#### Phase 5.25 Verification` (level 4). Cosmetic, but if any future tooling does depth-aware parsing it'll miss those sections. The planner skill's impl template should be the source of truth for heading levels even when inserting a phase manually.

6. **Stop trying to delete polluted Graphiti episodes by name when the API doesn't support it.** During this session a malformed `add_memory` call landed an episode in the wrong group (`main` instead of `shared`), and the corrected re-write created a duplicate in `shared` that pollutes catchup recall. There's no clean way to delete by name (`get_episodes` doesn't reliably return the UUIDs that `delete_episode` requires). The right move is to either fix the get_episodes API or build a cleanup tool — not to keep retrying. Tracked as a Phase 6 finding for the cgc-graphiti-evaluation spike.

## Insights Worth Carrying Forward

The biggest takeaway is that **the system has reached a meaningful inflection point**. Before this plan, InDusk was the planner/work/verify/retrospective lifecycle plus skills and lessons — a discipline layer on top of Claude Code. After this plan, InDusk also has a temporal knowledge graph that captures decisions automatically, recalls them at session start, and surfaces them as queryable structured facts. The bet now is whether that capture/recall loop materially improves the agent over time. The `cgc-graphiti-evaluation` spike is the right vehicle to measure that, and the next major plan (`cgc-graphiti-bridge`, currently draft) is the right vehicle to make it materially better.

The second takeaway is that **the unified-graph-files-as-anchors vision** (articulated by Sandy mid-session and captured in `infinitedusky` Graphiti as `vision-unified-knowledge-graph-files-as-anchors`, plus the meta version in `shared`) is the natural evolution of this work. CGC's structural data and Graphiti's episodic data both attaching to the same file/symbol nodes, with Dash0 logs/traces eventually projecting the same way, is the architecture that makes "describe this file" return everything in one query. cgc-graphiti-bridge needs to be rewritten with that scope.

The third takeaway is that **chitin-sportsbook is the right kind of substrate**. A real project, a real domain (peer-to-peer baseball moneyline sportsbook on Base Sepolia), built using the dev system as both the test bed and the product. Every plan run there is both real work and an evaluation data point. The cgc-graphiti-evaluation spike will use it as the substrate for ongoing experiments. Don't merge it back into Numero until the evaluation work has produced enough signal to know whether the dev system is paying for itself.

## Quality Ratchet

**No new Biome rules added.** The mistakes during this plan (test fixture path drift, dash0 source/installed sync gap, malformed graphiti tool call) were all process issues, not lint-catchable issues. No rule would have prevented them — they're "remember to do X in two places" or "use the right parameter syntax" mistakes that can't be encoded as code patterns.

The closest candidate for a new rule would have been "ban console.info in tools/ that doesn't go through the structured logger" — but that's a project-specific stylistic call, not a universal correctness rule, and the existing `noConsole: error` setting already covers it where it matters. No ratchet needed.

## Metrics

- **Sessions spent:** ~10 across 12 days (2026-03-27 to 2026-04-07)
- **Phases:** 13 (10 original + 3 inserted: 1.5, 5.25, 5.5)
- **Total impl items:** 227 — all checked
- **Lines of code added/modified:** approximate, includes hooks/skills/source/tests/config — ~3,500 lines net additive in `apps/indusk-mcp/`
- **New TypeScript files:** ~12 (graphiti-client, infra-config, graphiti tools wiring, sanitizeGroupId, etc.)
- **New tests:** 10 added (`config.test.ts` for sanitization + getProjectGroupId), tests went from 36 passing to 46 passing
- **NPM publishes during this plan:** 7 (v1.7.x → v1.10.3, with v1.10.0/v1.10.1/v1.10.2/v1.10.3 all in this final session)
- **Code graph after plan:** 118 files indexed in `cgc-infinitedusky`, 19,821 functions, 20 classes, 81 modules
- **Graphiti episodes seeded by this plan's work:** 4 in `shared` (rule + 3 meta), 6 in `chitin_sportsbook` (1 brief + 5 retro), 1 in `infinitedusky` (vision capture, marked as eventually-redundant)
- **Plans unblocked or made concrete by this plan:** 4 (`cgc-graphiti-evaluation` newly created, `cgc-graphiti-bridge` ready to be rewritten, `dusk-v2` informed, `react-native-support` superseded)
- **Retrospective skill verification:** ✅ this very retrospective is the second one to run end-to-end (chitin-sportsbook's `scaffold-bootstrap` was the first)
