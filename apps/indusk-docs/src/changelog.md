# Changelog

All notable changes to InDusk MCP are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Excalidraw extension — hand-drawn diagrams for planning, debugging, and teach mode (complements Mermaid for formal docs)
- Extension directory format — extensions use `{name}/manifest.json` + `.env` instead of flat files, auto-migrates
- ExcalidrawEmbed component — persistent, interactive Excalidraw diagrams in VitePress docs via iframe

## [1.2.9] - 2026-03-24

### Added
- Gate policy enforcement with conversation proof — `ask` mode now enforced by hooks at both write and execution time
- Extensions update command — re-fetches manifest and installs latest npm package automatically
- Post-update hooks — extensions can run commands after being updated
- Documentation Plan section in ADR template — plan changelogs, pages, and diagrams upfront
- Catchup enforcement hook — blocks code edits until `/catchup` completes all steps
- 9 new graph tools wrapping CGC — visualize, doctor, dead_code, complexity, callers, callees, find, watch, stats
- `graph_ensure` tool — validates and auto-repairs the full CGC stack (container, connection, indexing)
- Research: context-graph (semantic layer on code graph) and MCP dashboard (real-time agent activity UI)

### Changed
- CGC connection fast-fail — 2 second timeout instead of 60 seconds
- Auto-detect FalkorDB host — tries `falkordb.orb.local` first, falls back to `localhost`
- Extensions update detects package manager (pnpm/yarn/npm) and handles workspaces

### Fixed
- FalkorDB volume mount path (`/var/lib/falkordb/data` not `/data`)
- npm extension fetch for third-party extensions
- Catchup skill now requires reading all skill files (step 6)

## [1.0.0] - 2026-03-22

### Added
- Extension system — one system, two sources (built-in + third-party manifests)
- 10 built-in extensions (falkordb, cgc, nextjs, tailwind, react, solidity, typescript, testing, docker, vitepress)
- Extensions CLI — list, enable, disable, add, remove, status, suggest
- Extension manifest spec for third-party integrations
- composable.env as first third-party extension

### Changed
- Domain skills replaced by extensions
- All MCP tools refactored to consume extension manifests instead of hardcoded knowledge

## [0.9.1] - 2026-03-22

### Added
- VitePress llms.txt plugin for LLM-friendly documentation
- Teach mode for `/work` — explains before and after every edit
- Gate policy system (strict/ask/auto) for controlling override behavior
- `init-docs` command — scaffolds VitePress with Mermaid, llms, FullscreenDiagram
- Handoff and catchup skills for session continuity
- Onboard skill renamed to catchup

### Changed
- Document skill now workflow-aware — features get full docs, bugfixes update existing pages

## [0.8.0] - 2026-03-21

### Added
- Impl structure validation hook — blocks writing impls with missing gate sections
- Workflow-aware gates — bugfix requires only verification, feature requires all four
- Override formats: `(none needed)`, `skip-reason:`, conversation proof

## [0.6.0] - 2026-03-21

### Added
- Plan execution gate enforcement via Claude Code hooks
- `check-gates.js` — PreToolUse hook blocks phase transitions with incomplete gates
- `gate-reminder.js` — PostToolUse hook nudges after impl edits
- `validate-impl-structure.js` — blocks impls missing required sections

## [0.4.1] - 2026-03-20

### Added
- Deep CGC integration — required graph steps in all skills
- Graph wrapper tools (index_project, query_dependencies, query_graph)
- Update command installs new skills that didn't exist before

### Changed
- FalkorDB port forwarding removed — uses OrbStack hostname `falkordb.orb.local`

## [0.1.0] - 2026-03-20

### Added
- Initial release — CLI (init, update, serve), 14 MCP tools, core parsers
- Plan management tools (list_plans, get_plan_status, advance_plan, order_plans)
- Context tools (get_context, update_context)
- Quality tools (quality_check, suggest_rule, get_quality_config)
- Document tools (list_docs, check_docs_coverage)
- System tools (get_system_version, check_health, get_skill_versions)
- 6 skills (plan, work, verify, context, document, retrospective)
- Biome configuration with quality ratchet
