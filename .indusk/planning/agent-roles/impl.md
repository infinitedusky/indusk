---
title: "Agent Roles — Define and Enforce Role Boundaries"
date: 2026-04-15
status: in-progress
gate_policy: ask
trajectory: required
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

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `writeHighlight(tag, note, level)` appends a JSONL entry to `.indusk/highlights.jsonl` with auto-generated ID and ISO timestamp | Phase 1 | Phase 1 | passing |
| T2 | `readUnprocessedHighlights()` returns entries in highlights.jsonl that aren't yet in highlights-processed.jsonl | Phase 1 | Phase 1 | passing |
| T3 | `markProcessed(id, action)` appends to highlights-processed.jsonl; subsequent `readUnprocessedHighlights` excludes that id | Phase 1 | Phase 1 | passing |
| T4 | Highlight ID format `h-{YYYYMMDD}-{seq}` with 3-digit counter that resets daily | Phase 1 | Phase 1 | passing |
| T5 | `highlight` MCP tool registered in the server and calls `writeHighlight` with tag/note/level | Phase 1 | Phase 1 | passing |
| T6 | Planner skill `brief-accepted` and `adr-accepted` triggers call `highlight` (level: critical) — grep finds the calls and does NOT find raw `graph_capture`/`add_memory` | Phase 2 | Phase 2 | planned |
| T7 | Work skill `correction` trigger calls `highlight` (level: important) — grep finds the call | Phase 2 | Phase 2 | planned |
| T8 | Retrospective skill `retro-lesson` trigger calls `highlight` (level: important) — grep finds the call | Phase 2 | Phase 2 | planned |
| T9 | No process skill (planner/work/retro) references `graph_capture` or raw `mcp__graphiti__add_memory` — repo-wide grep returns zero matches in `apps/indusk-mcp/skills/{planner,work,retrospective}.md` | Phase 2 | Phase 2 | planned |
| T10 | Eval agent prompt builder output contains highlight-processing instructions with level→weight mapping (critical→1.0, important→0.6, note→0.3) | Phase 3 | Phase 3 | planned |
| T11 | `/highlight` slash command skill file exists at `apps/indusk-mcp/skills/highlight.md` with level arg parsing (defaults to `important`, accepts `critical` or `note`) | Phase 4 | Phase 4 | planned |
| T12 | Handoff skill at end of session fires the eval trigger (mentions `eval-trigger.js --source handoff` or equivalent) | Phase 4 | Phase 4 | planned |
| T13 | `eval-trigger.js` accepts `--source handoff` CLI flag and sets the source in the eval agent's environment | Phase 4 | Phase 4 | planned |
| T14 | `CLAUDE.md` Architecture contains the three-tier agent roles subsection, AND Key Decisions contains the agent-roles ADR bullet | Phase 4 | Phase 4 | planned |

### Deferred Verification

- **Eval agent end-to-end highlight processing on a real `jj describe`**
  - reason: requires a full Claude Code session + jj commit + async eval judge invocation; not deterministic from unit tests
  - would require: integration harness with a mock Claude CLI that captures the prompt and replays a scored response
  - mitigation: manual smoke test during Phase 3 (write a highlight → run `jj describe` → check `.indusk/highlights-processed.jsonl` for the mark + `.indusk/eval/results.log` for highlight acknowledgement); also tracked as a retrospective finding if the first 3 real commits after ship don't process highlights correctly.

## Checklist

### Phase 1: Highlights Queue Infrastructure
- [x] Create `apps/indusk-mcp/src/lib/highlights.ts` with:
  - `writeHighlight(tag: string, note: string, level: 'critical' | 'important' | 'note')` — appends to `.indusk/highlights.jsonl` with auto-generated ID and timestamp
  - `readUnprocessedHighlights()` — reads `highlights.jsonl`, reads `highlights-processed.jsonl`, returns unprocessed entries
  - `markProcessed(id: string, action: 'wrote-episode' | 'skipped', detail?: string)` — appends to `highlights-processed.jsonl`
  - ID format: `h-{YYYYMMDD}-{seq}` where seq is a 3-digit counter reset daily
- [x] Create `highlight` MCP tool in `apps/indusk-mcp/src/tools/` that calls `writeHighlight()` — exposed so the eval agent and skills can write highlights programmatically
- [x] Create `highlights_unprocessed` MCP tool that calls `readUnprocessedHighlights()` — exposed so the eval agent can query what needs processing
- [x] Create `highlight_mark_processed` MCP tool that calls `markProcessed()` — exposed so the eval agent can mark highlights done

#### Phase 1 Verification
- [x] T1 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- highlights`)
- [x] T2 passes (same command)
- [x] T3 passes (same command)
- [x] T4 passes (same command)
- [x] T5 passes — MCP tool registered; manual sanity via MCP inspector or call-through
- [x] `pnpm check` passes with no errors

#### Phase 1 Context
- [x] Add to CLAUDE.md Conventions: "Working agent writes highlights via the `highlight` MCP tool instead of calling `graph_capture` directly. Highlights are processed by the eval agent into structured Graphiti episodes."

#### Phase 1 Document
- [x] Write reference page at `apps/indusk-docs/src/reference/tools/highlights.md` documenting the highlight system, levels, and MCP tools

### Phase 2: Migrate Skills from graph_capture to Highlights
- [ ] Update planner skill (`apps/indusk-mcp/skills/planner/SKILL.md`): replace `graph_capture` call on brief acceptance with `highlight` call — level `critical`, tag `brief-accepted`
- [ ] Update planner skill: replace `graph_capture` call on ADR acceptance with `highlight` call — level `critical`, tag `adr-accepted`
- [ ] Update work skill (`apps/indusk-mcp/skills/work/SKILL.md`): replace `graph_capture` on corrections with `highlight` call — level `important`, tag `correction`
- [ ] Update retrospective skill (`apps/indusk-mcp/skills/retrospective/SKILL.md`): replace `graph_capture` on lessons with `highlight` call — level `important`, tag `retro-lesson`
- [ ] Verify no other skills call `graph_capture` or `mcp__graphiti__add_memory` directly — grep the skills directory
- [ ] Keep `graph_capture` MCP tool available (don't remove it — the eval agent will use it for structured writes)

#### Phase 2 Verification
- [ ] T6 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- skills`)
- [ ] T7 passes (same command)
- [ ] T8 passes (same command)
- [ ] T9 passes — `grep -r "graph_capture\|add_memory" apps/indusk-mcp/skills/{planner,work,retrospective}.md` returns zero matches

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
- [ ] T10 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- prompt-builder`)
- [ ] Manual smoke: write a highlight, run `jj describe`, confirm `.indusk/highlights-processed.jsonl` has the entry and `.indusk/eval/results.log` mentions highlights processed (this exercises the Deferred Verification mitigation for end-to-end eval agent behavior)

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
- [ ] T11 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- highlight-command`)
- [ ] T12 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- handoff`)
- [ ] T13 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- eval-trigger`)
- [ ] T14 passes (`pnpm turbo test --filter=@infinitedusky/indusk-mcp -- claude-md-roles`)
- [ ] `pnpm check` passes
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (full indusk-mcp suite)

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
