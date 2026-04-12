---
title: "Agent Roles — Define and Enforce Role Boundaries"
date: 2026-04-15
status: draft
gate_policy: ask
---

# Agent Roles

## Goal

Establish clean role boundaries between the working agent, eval agent, and infrastructure layer. Replace the working agent's direct Graphiti writes with a highlights queue that the eval agent processes into structured knowledge. Document the role definitions in CLAUDE.md.

## Scope

### In Scope
- Highlights queue (write utility, processed tracking, file format)
- Replace `graph_capture` calls in planner/work/retro skills with highlight writes
- Update eval agent prompt to read and process highlights
- `/highlight` command for manual user-triggered highlights
- Document role definitions in CLAUDE.md
- Session-end eval trigger from handoff skill

### Out of Scope
- Changing eval agent scoring rubric (graph-knowledge-architecture)
- Transcript indexing (hermes-inspired-improvements)
- MCP orchestration (mcp-orchestration-layer)
- LSP structural indexing (lsp-structural-indexing)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `writeHighlight()` utility, highlights file format, `readUnprocessedHighlights()`, `markProcessed()` | `.indusk/` directory structure |
| Phase 2 | Updated planner/work/retro skills using highlights instead of `graph_capture` | Phase 1 utilities |
| Phase 3 | Updated eval agent prompt reading highlights + writing weighted Graphiti episodes | Phase 1 utilities, Phase 2 highlight output |
| Phase 4 | `/highlight` slash command, session-end eval trigger, CLAUDE.md role docs | Phases 1-3 |

## Checklist

### Phase 1: Highlights Queue Infrastructure
- [ ] Create `apps/indusk-mcp/src/lib/highlights.ts` with:
  - `writeHighlight(tag: string, note: string, level: 'critical' | 'important' | 'note')` — appends to `.indusk/highlights.jsonl` with auto-generated ID and timestamp
  - `readUnprocessedHighlights()` — reads `highlights.jsonl`, reads `highlights-processed.jsonl`, returns unprocessed entries
  - `markProcessed(id: string, action: 'wrote-episode' | 'skipped', detail?: string)` — appends to `highlights-processed.jsonl`
  - ID format: `h-{YYYYMMDD}-{seq}` where seq is a 3-digit counter reset daily
- [ ] Create `highlight` MCP tool in `apps/indusk-mcp/src/tools/` that calls `writeHighlight()` — exposed so the eval agent and skills can write highlights programmatically
- [ ] Create `highlights_unprocessed` MCP tool that calls `readUnprocessedHighlights()` — exposed so the eval agent can query what needs processing
- [ ] Create `highlight_mark_processed` MCP tool that calls `markProcessed()` — exposed so the eval agent can mark highlights done

#### Phase 1 Verification
- [ ] `pnpm check` passes with no errors
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] Manual test: call `highlight` MCP tool, verify `.indusk/highlights.jsonl` has the entry
- [ ] Manual test: call `highlights_unprocessed`, verify it returns the entry
- [ ] Manual test: call `highlight_mark_processed`, verify `highlights-processed.jsonl` has the entry and `highlights_unprocessed` no longer returns it

#### Phase 1 Context
- [ ] Add to CLAUDE.md Conventions: "Working agent writes highlights via the `highlight` MCP tool instead of calling `graph_capture` directly. Highlights are processed by the eval agent into structured Graphiti episodes."

#### Phase 1 Document
- [ ] Write reference page at `apps/indusk-docs/src/reference/tools/highlights.md` documenting the highlight system, levels, and MCP tools

### Phase 2: Migrate Skills from graph_capture to Highlights
- [ ] Update planner skill (`apps/indusk-mcp/skills/planner/SKILL.md`): replace `graph_capture` call on brief acceptance with `highlight` call — level `critical`, tag `brief-accepted`
- [ ] Update planner skill: replace `graph_capture` call on ADR acceptance with `highlight` call — level `critical`, tag `adr-accepted`
- [ ] Update work skill (`apps/indusk-mcp/skills/work/SKILL.md`): replace `graph_capture` on corrections with `highlight` call — level `important`, tag `correction`
- [ ] Update retrospective skill (`apps/indusk-mcp/skills/retrospective/SKILL.md`): replace `graph_capture` on lessons with `highlight` call — level `important`, tag `retro-lesson`
- [ ] Verify no other skills call `graph_capture` or `mcp__graphiti__add_memory` directly — grep the skills directory
- [ ] Keep `graph_capture` MCP tool available (don't remove it — the eval agent will use it for structured writes)

#### Phase 2 Verification
- [ ] `grep -r "graph_capture\|add_memory" apps/indusk-mcp/skills/` returns only the eval-review skill (if any) and no process skills (planner, work, retro)
- [ ] Manual test: accept a brief using `/planner`, verify highlight is written to `.indusk/highlights.jsonl` with level `critical` and tag `brief-accepted`
- [ ] Manual test: simulate a correction during `/work`, verify highlight is written with level `important` and tag `correction`

#### Phase 2 Context
- [ ] Update CLAUDE.md Conventions: change "Graphiti capture is automatic at trigger points" to explain the highlights flow — working agent writes highlights, eval agent processes them into Graphiti

#### Phase 2 Document
- (none needed — the reference page from Phase 1 covers the system)

### Phase 3: Eval Agent Reads Highlights
- [ ] Update eval agent prompt builder (`apps/indusk-mcp/src/lib/eval/prompt-builder.ts`) to include instruction: "Read unprocessed highlights via `highlights_unprocessed` tool. For each highlight, use the level to determine effort: critical = extract full context from transcript and write structured Graphiti episode with high weight (1.0), important = extract and write with medium weight (0.6), note = consider and write with low weight (0.3) or skip if already captured."
- [ ] Update eval agent prompt to include instruction: "After processing each highlight, call `highlight_mark_processed` with the highlight ID and action taken."
- [ ] Update eval agent prompt to include instruction: "Highlights are additive context, not a constraint. Continue reading the full transcript and inferring knowledge independently. Highlights ensure important moments aren't missed."
- [ ] Update eval agent prompt to map highlight levels to Graphiti edge weights when writing episodes

#### Phase 3 Verification
- [ ] Write a highlight manually, then run `jj describe` to trigger eval agent
- [ ] Check `.indusk/highlights-processed.jsonl` — the highlight should be marked processed
- [ ] Check Graphiti via `mcp__graphiti__search_nodes` — the structured episode should exist
- [ ] Check `.indusk/eval/results.log` — the eval scorecard should mention highlights processed

#### Phase 3 Context
- (none needed — Phase 2 context update covers the full flow)

#### Phase 3 Document
- [ ] Update `apps/indusk-docs/src/reference/tools/highlights.md` with eval agent processing details

### Phase 4: User-Facing Highlight Command + Session-End Trigger + Role Documentation
- [ ] Create `/highlight` slash command skill at `apps/indusk-mcp/skills/highlight/SKILL.md` — user says `/highlight this decision about X` and the skill writes a highlight with appropriate level (default `important`, user can specify `critical` or `note`)
- [ ] Update handoff skill (`apps/indusk-mcp/skills/handoff/SKILL.md`): at the end of handoff, trigger the eval agent to process any remaining highlights that weren't followed by a `jj describe`. Implementation: the handoff hook fires the same eval trigger that `jj describe` fires.
- [ ] Update eval trigger hook (`apps/indusk-mcp/hooks/eval-trigger.js`): accept a `--source handoff` flag so the eval agent knows it was triggered by session end, not a commit. The eval agent should still process highlights but may skip the diff-based scoring (there's no new commit to score).
- [ ] Document role definitions in CLAUDE.md Key Decisions section:
  ```
  - Three-tier agent roles: working agent (code + highlights), eval agent (quality + structured knowledge), infrastructure (maintenance + enforcement) — see .indusk/planning/agent-roles/adr.md
  ```
- [ ] Document roles in CLAUDE.md Architecture section — add a "Roles" subsection describing the three tiers, the highlights queue, and the principle that the eval agent is the sole structured writer to Graphiti

#### Phase 4 Verification
- [ ] Manual test: run `/highlight this is a test decision` — verify highlight written
- [ ] Manual test: run `/handoff` — verify eval agent fires and processes unprocessed highlights
- [ ] `pnpm check` passes
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] CLAUDE.md has role definitions in both Architecture and Key Decisions sections

#### Phase 4 Context
- [ ] Update CLAUDE.md Current State: "Agent roles formalized — working agent writes highlights, eval agent processes them into structured Graphiti knowledge with weighted edges. `/highlight` command available for explicit user-flagged moments."

#### Phase 4 Document
- [ ] Add sidebar entry for highlights reference page in `apps/indusk-docs/src/.vitepress/config.ts`
- [ ] Update changelog at `apps/indusk-docs/src/changelog.md`

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/highlights.ts` | New — highlight queue read/write utilities |
| `apps/indusk-mcp/src/tools/highlight-tools.ts` | New — MCP tools for highlight operations |
| `apps/indusk-mcp/skills/planner/SKILL.md` | Replace `graph_capture` with `highlight` calls |
| `apps/indusk-mcp/skills/work/SKILL.md` | Replace `graph_capture` with `highlight` calls |
| `apps/indusk-mcp/skills/retrospective/SKILL.md` | Replace `graph_capture` with `highlight` calls |
| `apps/indusk-mcp/skills/highlight/SKILL.md` | New — `/highlight` slash command |
| `apps/indusk-mcp/skills/handoff/SKILL.md` | Add eval trigger at session end |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Add highlights processing instructions |
| `apps/indusk-mcp/hooks/eval-trigger.js` | Accept `--source handoff` flag |
| `CLAUDE.md` | Role definitions in Architecture + Key Decisions + Conventions + Current State |
| `apps/indusk-docs/src/reference/tools/highlights.md` | New — highlights reference page |
| `apps/indusk-docs/src/.vitepress/config.ts` | Add sidebar entry |
| `apps/indusk-docs/src/changelog.md` | Changelog entry |

## Dependencies
- None — this is the foundational plan

## Notes
- `graph_capture` MCP tool is NOT removed — the eval agent uses it for its structured writes to Graphiti. Only the working agent stops calling it.
- The highlights file lives in `.indusk/` (project-scoped), not `~/.indusk/` (global). Each project has its own highlights queue.
- Highlight IDs include the date to make manual inspection easy and prevent collisions across sessions.
- The eval agent processes highlights as the first step of its work (before transcript analysis and scoring) so that highlighted moments inform the broader analysis.
