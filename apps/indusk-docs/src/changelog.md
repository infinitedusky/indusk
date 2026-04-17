# Changelog

All notable changes to InDusk MCP are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed
- **Repo renamed from `infinitedusky` to `dusk`** — removed `indusk-portfolio` app (will be rebuilt in a separate repo). Updated graph namespaces, config, and docs references. npm package `@infinitedusky/indusk-mcp` unchanged.

### Fixed
- **CLI commands walk up to the project root (1.16.1)** — every non-`init` `indusk` command (`update`, `extensions *`, `init-docs`, `check-gates`, `pr-clean`, `pr-restore`, `graph *`, `eval *`, `beam`, `install`) now walks up from cwd looking for `.indusk/config.json` and errors out with a helpful message if no project is found. Fixes accidental installs into sub-app `.claude/` dirs when the user runs e.g. `indusk update` from inside `apps/indusk-mcp/`. `init` still uses raw cwd (it creates the marker). `.gitignore` now also excludes `apps/*/.claude/` and `apps/*/.indusk/` as belt-and-suspenders.
- **`indusk update` hook sync (1.15.1)** — the update command now discovers bundled hooks via `glob` from the package's `hooks/` dir (instead of a hardcoded list), creates `.claude/hooks/` if missing with all bundled hooks copied in, and logs the source path for debugging. New hooks added to the package now sync on update without code changes to `update.ts`.

### Added
- **Falsification Ritual (1.16.0)** — new `/falsify {plan}` skill between `/work` completion and `/retrospective`. Same working agent, goal-flipped from "prove it works" to "find a failing test." Drives a bounty-hunting loop: investigate the code, form a specific hypothesis about what should be broken, write the test that confirms it, run it. Three outcomes per failing test: fix in scope (reopens the impl with a new phase), spawn a new plan, or accept as finding. Hybrid exit (agent proposes termination, user confirms). Retrospective skill's Step 0 hard-blocks without either a completed `falsification.md` log or `falsification: skipped` + `falsification_reason` in the impl frontmatter. Bookend to the Test Trajectory. See the [Falsification Ritual guide](/guide/falsification-ritual).
- **Test Trajectory (1.15.0)** — every new impl.md opens with a `## Test Trajectory` table (`ID | Asserts | Writable at | Passes at | State`), and phase Verification sections reference test IDs rather than restating checks. Deferred Verification handles untestable items with three required fields (`reason`, `would require`, `mitigation`). Four validator rules enforced by `validate-impl-structure.js`; phase close structurally gated by `check-gates.js` blocking advance when `Passes at: Phase N` rows aren't `passing`/`skipped`/`blocked`. Retrospective skill audits mitigations via `auditPlanAtClose`. Enable on an impl with `trajectory: required` in the frontmatter. See the [Test Trajectory guide](/guide/test-trajectory).
- **Local init mode** (`indusk init --local`) — use InDusk on team codebases without touching committed files. Uses `.git/info/exclude` for isolation.
- **`.indusk/config.json`** — central project profile recording mode, detected tooling, and verify contract. Both modes use it.
- **`indusk pr-clean` / `pr-restore`** — strip and re-apply InDusk settings overlay for clean PRs
- **Settings overlay** (`.indusk/settings-overlay.json`) — tracks what InDusk added to `.claude/settings.json`
- Local-mode quality tools: `.indusk/biome.json`, `.indusk/tests/`, `.indusk/docs/`
- Tooling detection at init (linter, test runner, OTel, TypeScript)

- **Context beam** — file-specific context delivery via 6-query pipeline across semantic graph, Graphiti, eval findings, and CGC. Distance-based relevance decay, trace mode for transparency, configurable pipeline. `context_beam` MCP tool and `indusk beam` CLI.

- **Context system evaluation** — commit-triggered judge agent scores every commit against project conventions, lessons, and graph data. Two modes: eval (always on, writes derived insights to Graphiti) and baseline (vanilla agent comparison). `indusk eval summary` for trends, `indusk eval baseline --task <path>` for delta measurement. `/eval review` for manual quality checks.

- **Semantic graph bridge** — per-project event-sourced projection of CGC structure and Graphiti knowledge, versioned via jj change IDs. Anchors for files, functions, classes, interfaces; internal import edges. `indusk graph sync/rebuild/status` CLI and MCP tools. Automatic sync at phase boundaries.

### Changed
- **Planning moved to `.indusk/planning/`** — all modes. `.indusk/` is now the InDusk home directory.
- All skill path references updated (`planning/` → `.indusk/planning/`)
- `indusk update` respects local mode — re-applies overlay after syncing

### Fixed
- Pre-existing test failure: `otel-core-skill` plan reference in plan-parser tests replaced with existing plan

---

- OpenTelemetry extension — auto-instrumentation scaffolding, Pino structured logging, category-based filtering exporter. Every project is observable from `init`.
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
