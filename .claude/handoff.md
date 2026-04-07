# Handoff

**Date:** 2026-04-07
**Session:** Phase 5.5 of graphiti-infrastructure — surface Graphiti to the agent. Built and published v1.10.0. Discovered the gap that would have made Phase 6 unrunnable, closed it, fixed pre-existing test failures along the way.

## What Was Being Worked On

Inserted **Phase 5.5: Surface Graphiti to the Agent** into `.indusk/planning/graphiti-infrastructure/impl.md` between Phase 5 and Phase 6. Discovered while preparing Phase 6 that the `indusk-infra` container runs a working Graphiti MCP server on `localhost:8100/mcp`, and `GraphitiClient` (a typed wrapper) exists in `apps/indusk-mcp/src/lib/graphiti-client.ts` — but **nothing exposed Graphiti tools to the agent**. `.mcp.json` registered indusk/cgc/dash0/excalidraw, not graphiti. The graphiti skill showed pseudocode that didn't correspond to any callable tool. Phase 6's manual tests ("add episode with group_id `infinitedusky`", "verify cross-group search", etc.) were unrunnable.

**Strategy: Option C** — register Graphiti directly in `.mcp.json` (like dash0), keep the `GraphitiClient` wrapper for internal use only, add capture triggers across 5 skills, add recall trigger to catchup. No double-wrapping.

## Where It Stopped

**v1.10.0 PUBLISHED** by Sandy. Implementation work in Phase 5.5 is **complete**:

- `apps/indusk-mcp/src/bin/commands/init.ts:354-368` — registers `claude mcp add -t http -s project graphiti http://localhost:8100/mcp` after CGC
- `apps/indusk-mcp/src/bin/commands/update.ts:309-339` — generalised: re-adds any extension's MCP server if `manifest.mcp_server.add_command` is set and the server is missing from `.mcp.json`
- `apps/indusk-mcp/src/lib/extension-loader.ts:46-56` — added `add_command` to `ExtensionManifest.mcp_server` schema
- `apps/indusk-mcp/extensions/graphiti/manifest.json` — top-level `mcp_server` declaring url, type, add_command, setup_instructions
- `apps/indusk-mcp/src/lib/config.ts:43-58` — added `getProjectGroupId(projectRoot)` helper, defaults to `basename(projectRoot)`, overridable via `.indusk/config.json` `graphiti.groupId`
- `apps/indusk-mcp/extensions/graphiti/skill.md` — full rewrite with real `mcp__graphiti__*` tool calls, 9-tool reference table, "Capture Triggers" section listing where episodes come from, graceful degradation guidance
- `apps/indusk-mcp/skills/planner.md` — capture triggers in step 4 (brief acceptance → `brief-accepted-{plan}` episode) and step 5 (ADR acceptance → `adr-{plan}` Y-statement episode)
- `apps/indusk-mcp/skills/work.md` — extended Corrections section with `correction-{slug}` capture, `shared` vs project-group rule
- `apps/indusk-mcp/skills/retrospective.md` — Step 6 (Lesson Capture) extended with `retro-{plan}-{n}` and `retro-{plan}-wdid-{n}` episodes, contradiction-capture pattern
- `apps/indusk-mcp/skills/catchup.md` — new Step 4.5 (Recall from Graphiti) using `search_nodes` for "recent decisions and lessons", added "Graphiti recall" line to summary template
- All four installed `.claude/skills/{planner,work,retrospective,catchup}/SKILL.md` synced from source
- `.claude/skills/graphiti/SKILL.md` and `.indusk/extensions/graphiti/manifest.json` were missing from this project (bug — graphiti was "enabled" via dir presence but skill never installed). Manually copied. Worth a follow-up to make `update` install missing extension skills.

**Build/test/lint at v1.10.0**: tsc clean, biome check clean (scoped to indusk-mcp), all 36 vitest tests pass including 7 in `graphiti-client.test.ts`. Fixed pre-existing 6 failing tests in `plan-parser.test.ts` and `impl-parser.test.ts` that referenced legacy `planning/archive/` path instead of `.indusk/planning/archive/` (collateral fix from earlier planning migration).

**`.mcp.json` in this repo now has graphiti registered** — manually added during this session via `claude mcp add` to confirm the endpoint works. Tools won't be available until **Claude Code restart**.

## What's Next

1. **RESTART CLAUDE CODE** in infinitedusky to pick up the registered `mcp__graphiti__*` tools (from `.mcp.json`). Without this, all the capture triggers and recall calls will fail.
2. **Run Phase 5.5 Verification items** — exercise the actual tools end-to-end:
   - `mcp__graphiti__add_memory` with `group_id: "infinitedusky"` test episode
   - `mcp__graphiti__search_nodes` round-trip
   - Cross-group search with `group_ids: ["infinitedusky", "shared"]`
   - `mcp__graphiti__get_status` for health
   - Test capture triggers by accepting a brief somewhere (test plan, or accept dusk-v2 research → brief)
   - Test recall trigger by running `/catchup` again — should now show Graphiti recall
   - Test graceful degradation: `indusk infra stop`, try `add_memory`, expect clean error; `indusk infra start`, retry, succeeds
3. **Phase 5.5 Context gate** — update CLAUDE.md (still pending):
   - Architecture: add Graphiti to MCP servers list with its 9 tools
   - Conventions: "After a brief or ADR is accepted, the planner skill captures the decision as a Graphiti episode. Corrections via `context learn` are also captured. Catchup recalls relevant episodes at session start."
   - Key Decisions: "Graphiti registered directly as MCP server (Option C) — see graphiti-infrastructure/impl.md Phase 5.5"
4. **Phase 5.5 Document gate** — update docs (still pending):
   - `apps/indusk-docs/src/reference/extensions/graphiti.md` (create or update) with new tool surface
   - "Capture and Recall" section in planner reference page
   - Getting Started: mention Graphiti as exposed MCP server
   - Mermaid sequence diagram: brief accepted → planner add_memory → next session catchup recall
5. **Then Phase 6: End-to-End Validation** — the real reason Phase 5.5 exists. Use chitin-sportsbook as the test substrate (project-specific episodes, shared knowledge, persistence over multiple days).
6. **Eventually**: dusk-v2 research is parked at decision #1 (built-in extension storage). Pick it back up after CGC + Graphiti experiment yields lessons.

## Open Issues

- **Pre-existing nested biome config** in `apps/otel-test/biome.json` and `apps/otel-test-v2/biome.json` blocks root `pnpm check`. Workaround: scoped check works. Real fix: run `biome migrate --write` from those project roots, or delete the nested configs. Not from Phase 5.5.
- **`.indusk/extensions/graphiti/manifest.json` was missing in this project before this session** — bug. Graphiti was "enabled" by directory presence (only `.env` file existed). Need a follow-up to make `update` (or `init` without `--force`) install missing extension files for previously-installed extensions. Not blocking — the manifest is now in place.
- **`.claude/skills/graphiti/SKILL.md` was missing in this project before this session** — same bug. Now in place.
- **chitin-sportsbook (`~/code/sandbox/chitin-sportsbook`)** was inited with v1.9.4. To pick up the v1.10.0 graphiti registration, run `indusk init --force` or `indusk update` there. The `.mcp.json` will gain a graphiti entry on next init.
- **Phase 5.5 capture triggers are documentation in skill files**, not enforced code. The agent reads the skill and is expected to follow it. There's no hook that fires "you accepted a brief, you must call add_memory now." If the agent forgets, the episode isn't captured. Worth considering whether to add a hook in a future plan.

## Decisions Made This Session

- **Option C (direct registration + keep wrapper)** — Graphiti registers in `.mcp.json` as a top-level MCP server. `GraphitiClient` wrapper class kept in `apps/indusk-mcp/src/lib/graphiti-client.ts` for internal use only (skills/catchup that want typed defaults). No double-wrapping.
- **Phase 5.5, not its own plan** — inserted into the existing graphiti-infrastructure impl as "the gap between 5 and 6", not split into a new plan. Plan parser handles `5.5` fine.
- **Generalised manifest schema, not graphiti-specific** — `mcp_server.add_command` is on the manifest type, available to any future extension that wants its MCP server auto-registered.
- **Capture is automatic at trigger points, not opt-in** — planner/work/retrospective/catchup write episodes as part of their flow. Manual `add_memory` is the exception, not the rule.
- **Skip silently on Graphiti unavailability** — every capture site degrades gracefully. Capture is best-effort, never fails the surrounding flow.
- **`shared` vs project group rule for corrections**: "Would this make sense to a different project?" Yes → `shared`. No → project group.
- **`getProjectGroupId(projectRoot)` is the canonical source** — defaults to `basename(projectRoot)`, overridable via `.indusk/config.json` `graphiti.groupId`. All capture/recall code should use it.
- **Pre-existing test fixtures referenced legacy `planning/` path** — fixed 6 test failures by updating to `.indusk/planning/`. Should have been part of the planning migration but wasn't.

## Watch Out For

- **`.mcp.json` graphiti entry was added manually this session** — it'll persist (it's in the file) but a future `indusk init` would re-add it idempotently. No harm.
- **The agent in this session never actually called `mcp__graphiti__*` tools** — the registration was added mid-session via `claude mcp add` but Claude Code only loads MCP servers at session start. Verification is genuinely the next session's job.
- **Capture/recall are documentation-driven for now** — if the agent doesn't read or follow the skill instructions, episodes aren't captured. Consider hook enforcement if it turns out to be too easy to forget.
- **dusk-v2 plan is parked**, not abandoned. Decision #1 (built-in extension storage) is the foundation. Don't restart it without finishing CGC + Graphiti experiment first — the answers will be informed by what Phase 6 validation reveals.
- **react-native-support plan is parked** — the intent is to roll its OTel substance into the dusk-v2 OTel-as-extension work. Don't `/work` it as-is.
- **6 jj changes stacked from this session** (yqontour parent → ykysopov → ytxwxutu → kuprowmz → lkoqswly → qrwqwpmp). All have descriptions. Not yet pushed (jj on detached HEAD). Sandy may want to rebase/squash or just leave as-is.
- **Tests now actually pass cleanly** — the "1 failing test (pre-existing)" note in the previous handoff was actually 6 failing tests, all path-related, all fixed. Don't bring that note forward.
- **chitin-sportsbook still uses v1.9.4** — needs `indusk update` (or `indusk init --force`) to pick up the v1.10.0 graphiti registration before it can be a Phase 6 test substrate.

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
- [x] graphiti (recall ran — empty baseline, as expected pre-capture)
