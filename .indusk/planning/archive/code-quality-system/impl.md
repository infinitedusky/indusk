---
title: "Code Quality System"
date: 2026-03-19
status: completed
---

# Code Quality System

## Goal

Configure Biome as the single lint/format tool with a quality ratchet pattern. Create the annotated config (biome.json + biome-rationale.md), wire it into the verify skill, add package.json scripts, and design the MCP tools for future implementation.

## Scope

### In Scope
- Configure `biome.json` with recommended + learned rules
- Create `biome-rationale.md` with annotated entries for each non-default rule
- Add `check` and `format` scripts to package.json
- Wire into verify skill (biome check as the lint step)
- Run `biome check --write` to normalize existing code
- Design MCP tool interfaces for `get_quality_config`, `suggest_rule`, `quality_check`

### Out of Scope
- MCP tool implementation (deferred to MCP server plan)
- `claude-skills init/update` integration (deferred to portability plan)
- Cross-project propagation

## Checklist

### Phase 1: Configure Biome

- [x] Create `biome.json` at project root with:
  - VCS integration (git, useIgnoreFile)
  - Formatter: tabs, lineWidth 100
  - Linter: recommended + `noExplicitAny`, `noUnusedImports`, `noConsole`, `useConst`, `noUnusedVariables`
  - Overrides: relax `noConsole` for test files and mcp app
  - Note: `noVar` doesn't exist in Biome 2.x, removed. `noUnusedVariables` `ignorePattern` option doesn't exist in 2.x, removed. Schema must match installed version.
- [x] Create `biome-rationale.md` with entries for each non-default rule
- [x] Add scripts to root `package.json`: `check`, `check:fix`, `format`
- [x] Run `pnpm check` and fix any violations in existing code
- [x] Run `pnpm check:fix` to normalize formatting (18 files reformatted, spaces→tabs)

#### Phase 1 Verification
- [x] `pnpm check` exits 0 with no errors — "Checked 23 files in 203ms"
- [x] `biome check` runs in < 2 seconds (203ms)
- [x] Test files are not flagged for `noConsole` (overrides working)

#### Phase 1 Context
- [x] Add to Conventions in CLAUDE.md: `pnpm check` for lint/format check, `pnpm check:fix` to auto-fix
- [x] Update Architecture: `biome.json` and `biome-rationale.md` in directory tree

### Phase 2: Wire into verify and retro flow

- [x] Update `.claude/skills/verify/SKILL.md`: lint command now `pnpm check`
- [x] Add to the plan skill's retrospective template: Quality Ratchet section
- [x] Add to the context skill: post-retro trigger includes Biome rule → Conventions update

#### Phase 2 Verification
- [x] Verify skill references `pnpm check` as the lint command
- [x] Plan skill's retrospective template includes Quality Ratchet section
- [x] Cross-read verify, plan, and context skills — quality ratchet loop documented without contradiction

#### Phase 2 Context
- [x] Add to Conventions in CLAUDE.md: "After each retrospective, ask if mistakes could be caught by a Biome rule — if yes, add to biome.json and biome-rationale.md"

### Phase 3: Design MCP tool interfaces

- [x] Document the three MCP tool interfaces in `planning/code-quality-system/mcp-tools-design.md`
- [x] MCP server plan note: tools are designed at `planning/code-quality-system/mcp-tools-design.md`

#### Phase 3 Verification
- [x] Design doc exists with clear input/output for all three tools
- [x] Design doc references implementation notes for each tool

#### Phase 3 Context
- [x] Update Current State in CLAUDE.md: code-quality-system impl completed, MCP tools designed but not yet implemented

## Files Affected

| File | Change |
|------|--------|
| `biome.json` | Create — root Biome config with recommended + learned rules |
| `biome-rationale.md` | Create — annotated rationale for each non-default rule |
| `package.json` | Add check, check:fix, format scripts |
| `.claude/skills/verify/SKILL.md` | Update lint command to `pnpm check` |
| `.claude/skills/plan/SKILL.md` | Add Biome rule prompt to retrospective guidance |
| `.claude/skills/context/SKILL.md` | Add retro→enforcement loop reference |
| `planning/code-quality-system/mcp-tools-design.md` | Create — MCP tool interface design |
| `CLAUDE.md` | Context updates per phase |

## Dependencies
- Biome installed (it is — `@biomejs/biome@2.4.8`)
- Verify skill exists (it does)
- Context skill exists (it does)
- Code-quality ADR accepted (it is)

## Notes
- Existing code may have formatting violations. `biome check --write` will normalize everything in one pass. This is expected and not a sign of problems.
- The MCP tools are designed in this plan but implemented in the MCP server plan. This keeps code-quality focused on config and process.
