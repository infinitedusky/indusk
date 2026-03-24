---
title: "MCP Dev System — Packaged Development System"
date: 2026-03-20
status: completed
---

# MCP Dev System — Implementation

## Goal

Build the InDusk MCP server as a hybrid npm package: CLI for project setup (`init`/`update`) and MCP server for runtime tools (plan management, quality checks, context manipulation, document coverage, system info). Dogfood in this repo first, then publish as `@infinitedusky/dev-system`.

## Scope

### In Scope
- MCP server with 20 tools across 5 categories
- CLI with `init`, `update`, and `serve` commands
- Skills bundled in the package for distribution
- `.mcp.json`, `.vscode/settings.json`, and CLAUDE.md scaffolding during init
- Phase enforcement via `advance_plan`
- Dogfooded in this repo via `apps/indusk-mcp/`

### Out of Scope
- npm publishing (manual first publish after dogfooding)
- Skill customization/override mechanism (v2)
- Hosted/remote mode

## Checklist

### Phase 1: Package Structure and CLI Scaffolding

- [x] Restructure `apps/indusk-mcp/` with the package layout from the ADR:
  ```
  apps/indusk-mcp/
  ├── src/
  │   ├── bin/cli.ts           # CLI entry: init, update, serve
  │   ├── server/index.ts      # MCP server entry
  │   ├── tools/               # MCP tool implementations
  │   └── lib/                 # Shared utilities (plan parsing, CLAUDE.md parsing, etc.)
  ├── skills/                  # Skill files (copied during init)
  ├── templates/               # CLAUDE.md template, biome.json base, vscode settings
  ├── package.json
  └── tsconfig.json
  ```
- [x] Copy current skill files into `apps/indusk-mcp/skills/`
- [x] Create templates: `CLAUDE.md`, `biome.template.json`, `vscode-settings.json`
- [x] Update `package.json` with `bin` entry for CLI, `exports` for MCP server
- [x] Add `commander`, `glob`, `gray-matter` dependencies

#### Phase 1 Verification
- [x] `pnpm turbo build --filter=@infinitedusky/dev-system` compiles without errors
- [x] `node dist/bin/cli.js --help` prints usage info
- [x] `pnpm check` passes

#### Phase 1 Context
- [x] Update Architecture: indusk-mcp restructured with bin/, server/, tools/, skills/, templates/
- [x] Update Current State: MCP dev system Phase 1 complete

### Phase 2: CLI Init Command

- [x] Implement `init` command in `src/bin/cli.ts`:
  1. Copy skills from package `skills/` to project `.claude/skills/`
  2. Create `CLAUDE.md` from template (skip if exists)
  3. Create `planning/` directory (skip if exists)
  4. Add `indusk` entry to `.mcp.json` (merge with existing, don't overwrite)
  5. Generate `.vscode/settings.json` from template (skip if exists)
  6. Create base `biome.json` from template (skip if exists)
  7. Print setup summary with next steps
- [x] Implement `update` command:
  1. Read installed skill files
  2. Compare to package versions (by content hash or version in frontmatter)
  3. Replace outdated skills
  4. Never touch: CLAUDE.md, planning/, biome.json, .mcp.json (except indusk entry)
  5. Print what was updated
- [x] Implement `serve` command that launches the MCP server (delegates to server/index.ts)

#### Phase 2 Verification
- [x] Create a temp directory and run `init` — verify all files created correctly
- [x] Run `init` again — verify it doesn't overwrite existing files
- [x] Run `update` after modifying a skill file — verify it gets restored
- [x] `pnpm check` passes

#### Phase 2 Context
- [x] Add to Conventions: `npx @infinitedusky/dev-system init` for new project setup
- [x] Update Current State: CLI init/update working

### Phase 3: Core Library — Plan and CLAUDE.md Parsing

- [x] Create `src/lib/plan-parser.ts`:
  - Parse plan directories from `planning/`
  - Extract frontmatter (title, date, status) from each document
  - Determine plan stage (which document is current)
  - Parse impl checklists: phases, items, checked/unchecked status
  - Detect dependencies from brief `## Depends On` section
- [x] Create `src/lib/context-parser.ts`:
  - Parse CLAUDE.md into the 6 sections
  - Validate structure (all 6 sections present)
  - Read/write individual sections without breaking structure
- [x] Create `src/lib/impl-parser.ts`:
  - Parse impl phases with their four gate types (implementation, verification, context, document)
  - Calculate phase completion status (all items checked?)
  - Identify blocked items (notes under unchecked items)

#### Phase 3 Verification
- [x] Unit tests for plan-parser: parse this repo's planning/ directory, verify correct stages for all plans
- [x] Unit tests for context-parser: parse this repo's CLAUDE.md, verify all 6 sections extracted
- [x] Unit tests for impl-parser: parse document-skill impl, verify phase completion status
- [x] `pnpm turbo test --filter=indusk-mcp` passes (21 tests, 4 files)
- [x] `pnpm check` passes

#### Phase 3 Context
- [x] Add to Known Gotchas: impl parser must handle all four gate types (verify, context, document) not just three

### Phase 4: MCP Server — Plan and Context Tools

- [x] Create `src/server/index.ts` — MCP server setup with stdio transport, register all tools
- [x] Implement `src/tools/plan-tools.ts`:
  - `list_plans` — returns array of `{ name, stage, nextStep, dependencies }`
  - `get_plan_status` — returns detailed status including phase progress and blocked items
  - `advance_plan` — validates prerequisites before advancing; returns what's missing if blocked
  - `order_plans` — get/set plan execution order based on dependencies
- [x] Implement `src/tools/context-tools.ts`:
  - `get_context` — returns CLAUDE.md parsed into 6 sections
  - `update_context` — updates a specific section; validates structure preserved

#### Phase 4 Verification
- [x] Start MCP server locally, call `list_plans` — verify it returns correct data for this repo
- [x] Call `get_plan_status` for document-skill — verify it shows completed
- [x] Call `get_context` — verify all 6 sections returned
- [x] Call `update_context` with a test edit, verify CLAUDE.md updated correctly, then revert
- [x] `pnpm turbo test --filter=indusk-mcp` passes (21 tests)
- [x] `pnpm check` passes

#### Phase 4 Context
- [x] Update Current State: Plan and context MCP tools working

### Phase 5: MCP Server — Quality and Document Tools

- [x] Implement `src/tools/quality-tools.ts`:
  - `get_quality_config` — read biome.json + biome-rationale.md, return as structured data
  - `suggest_rule` — given a mistake description, search Biome rule catalog for matches
  - `quality_check` — run `biome check` via child process, parse output into structured results
- [x] Implement `src/tools/document-tools.ts`:
  - `list_docs` — list all markdown files in the VitePress docs directory
  - `check_docs_coverage` — compare completed plans (in archive or with completed impl) to existing decision/lesson pages; flag gaps

#### Phase 5 Verification
- [x] Call `quality_check` — verify structured results match `pnpm check` output
- [x] Call `get_quality_config` — verify biome.json and rationale returned
- [x] Call `list_docs` — verify docs pages from indusk-docs are listed
- [x] Call `check_docs_coverage` — verify it flags missing decision pages for completed plans (5 gaps found)
- [x] `pnpm turbo test --filter=indusk-mcp` passes (21 tests)
- [x] `pnpm check` passes

#### Phase 5 Context
- [x] Update Current State: Quality and document MCP tools working

### Phase 6: MCP Server — System Tools and Phase Enforcement

- [x] Implement `src/tools/system-tools.ts`:
  - `get_system_version` — return package version from package.json
  - `get_skill_versions` — compare installed skills to package skills, return status per skill
- [x] Implement phase enforcement in `advance_plan`:
  - Brief → ADR: brief status must be `accepted`
  - ADR → Impl: ADR status must be `accepted`
  - Phase N → Phase N+1: all implementation, verification, context, and document items checked
  - Impl → Retrospective: all phases complete, impl status `completed`
  - Return structured response: `{ allowed: boolean, missing: string[] }`

#### Phase 6 Verification
- [x] Call `get_system_version` — verify correct version returned (0.1.0)
- [x] Call `get_skill_versions` — verify it detects installed skills (6/6 installed, all current)
- [x] Test `advance_plan` enforcement: mcp-dev-system correctly blocked at Phase 6 with 8 missing items
- [x] `pnpm turbo test --filter=indusk-mcp` passes (21 tests)
- [x] `pnpm check` passes

#### Phase 6 Context
- [x] Update Current State: All MCP tools implemented, phase enforcement working

### Phase 7: Dogfood — Wire Up in This Repo

- [x] Update `.mcp.json` in this repo to use the local indusk-mcp as the MCP server
- [x] Test full workflow: start a new Claude Code session, verify MCP tools are available (13 tools)
- [x] Test `list_plans` returns all plans with correct stages
- [x] Test `get_context` returns current CLAUDE.md
- [x] Test `quality_check` returns Biome results
- [x] Verify skills are installed from package via `init`, loaded from `.claude/skills/`
- [x] Removed manually maintained `.claude/skills/` — skills now sourced from `apps/indusk-mcp/skills/` via init/update

#### Phase 7 Verification
- [x] All MCP tools callable from Claude Code session (13 tools listed)
- [x] `list_plans` output matches actual plan states
- [x] `advance_plan` correctly blocks on incomplete phases
- [x] No conflicts between local skills and MCP tools
- [x] `pnpm turbo test --filter=indusk-mcp` passes (21 tests)
- [x] `pnpm check` passes

#### Phase 7 Context
- [x] Update Architecture: indusk-mcp is now the active MCP server for this repo
- [x] Update Current State: MCP dev system dogfooded and working
- [x] Add to Known Gotchas: skills are now package-owned, installed via init/update

#### Phase 7 Document
- [x] Write reference page at `apps/indusk-docs/src/reference/tools/indusk-mcp.md` covering all 14 MCP tools with architecture diagram
- [x] Create getting started guide at `apps/indusk-docs/src/guide/getting-started.md` with full setup flow including MCP

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/` | Complete restructure — CLI, server, tools, skills, templates |
| `apps/indusk-mcp/package.json` | Add bin entry, commander, exports |
| `.mcp.json` | Update to use local indusk-mcp |
| `CLAUDE.md` | Architecture, conventions, current state updates |

## Dependencies

- `@modelcontextprotocol/sdk` (already installed)
- `commander` (CLI argument parsing)
- `gray-matter` (frontmatter parsing)
- `glob` (file discovery)

## Notes

- Start with the tools that provide the most immediate value: `list_plans`, `get_plan_status`, `get_context`, `quality_check`
- Phase enforcement is advisory — the agent can override with user approval
- npm publish is out of scope for this impl — manual first publish after dogfooding is stable
- The `serve` command is what `.mcp.json` calls — it's just a thin wrapper that starts the MCP server
