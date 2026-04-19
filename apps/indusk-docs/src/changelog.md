# Changelog

All notable changes to InDusk MCP are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- **Behavioral test plan document between brief and ADR (1.22.0)** — new `test-plan.md` document type added to the planner skill lifecycle for `feature` workflows. Slots between brief acceptance and ADR authoring. Lists the **behavioral assertions** that must be true for the feature to work, plus the **mechanism** by which each will be tested (vitest unit / vitest integration / e2e script / manual user test / etc.) — but NOT the test code. Discipline: assertions must be behavioral (user-visible) not functional (function/type/internal). "User can sign in with Google" not "googleAuth() returns a JWT." If a non-engineer stakeholder couldn't read an assertion without you explaining a function name, rewrite it. The test plan becomes the source rows for the impl's Test Trajectory: one trajectory row per assertion, with `Writable at`/`Passes at` columns added during impl authoring. Lifecycle now: `research → brief → test-plan → adr → impl → retrospective`. Optional first-class skip: bugfix/refactor workflows continue to skip the test plan; feature workflows include it by default. Will be evaluated on the next Numero feature; if it adds friction without payoff, easy to remove (single planner skill change).
- **Trajectory rationale validator + earliest-writable discipline (1.21.1)** — opt-in fifth trajectory rule. Every trajectory row whose `Writable at` is later than Phase 0 must have a matching entry in a `### Trajectory Rationale` subsection naming what prevents authoring the test before plan code lands. Phase 0 (the pre-plan baseline — "writable today against the current stack") is the default and needs no rationale, so the subsection only fills with the rows that actually require justification. Enable per impl with `rationale: required` in frontmatter; the planner skill template now sets it by default for new impls. The rationale-quality test asks *does this describe a compile error against today's symbols, or does it describe an uninteresting failure mode?* If the latter, the row is a rubber-stamp — move it to Phase 0 (red-for-uninteresting-reason is the whole point of an early-writable test, since it stays red through every intermediate phase as a tripwire). Legitimate Phase 1+ rationales: TypeScript imports of not-yet-exported symbols, constructor signatures that don't yet accept the test's args, enum values not yet defined. Validator rule `rationale-completeness` flags missing Phase 1+ entries and stale entries; mirrors across `.claude/hooks/validate-impl-structure.js` (write-time gate), `apps/indusk-mcp/hooks/validate-impl-structure.js` (package source for `indusk update` to propagate), and `apps/indusk-mcp/src/lib/trajectory/validator.ts` (TS source). 7 new tests (T13–T16 + composite cases + Phase 0 exemption) in validator.test.ts. New lesson `test-red-at-earliest-writable-phase.md` codifies the rule, the rationale-quality test, and the compile-error-vs-rubber-stamp framework.
- **ADR template now opens with a Goal section (1.21.1)** — every new `adr.md` now includes a `## Goal` section immediately before `## Y-Statement`. One bolded sentence states the headline outcome in plain language ("what will be true when this ADR's decisions ship that isn't true today"), followed by a 2-4 sentence paragraph grounding the goal in user-visible terms and naming at least one current failure the decision fixes. The Y-statement's seven canonical clauses remain unchanged — the Goal lets a reader skim the headline without hunting through them. Ships via the planner skill template at `apps/indusk-mcp/skills/planner.md`; `indusk update` copies it into each project's `.claude/skills/planner/SKILL.md`.

### Added
- **Eval agent OTel logs signal (1.19.0)** — the evaluator now emits OTel LogRecords alongside span traces. Content captured: full prompt body (`eval.event=prompt`), Claude subprocess stdout (`eval.event=claude.stdout`), full scorecard JSON (`eval.event=scorecard`), and error stack traces (`eval.event=error`) in the error path. Logs ingest to the same Dash0 dataset as spans (default `agent`, same routing) and auto-correlate with the active span via trace_id + span_id. Root `eval.run` span also gains content-rich attributes: `scorecard.status` (`ok`/`error`), `scorecard.question_count`, `scorecard.summary` (first 500 chars), `scorecard.cost_usd`, `scorecard.duration_ms`, `scorecard.input_tokens`, `scorecard.output_tokens`, `scorecard.answers.{yes,no,partial}`. Verified end-to-end: `dash0 logs query --dataset agent` returns the 3 log records per run after a real evaluator invocation. See the [Eval Agent OTel docs](/reference/tools/otel#eval-agent-otel-opt-in) for the full signal set.

### Fixed
- **Eval agent hook-spawn silent crash (1.19.1)** — the PostToolUse hook at `apps/indusk-mcp/hooks/eval-trigger.js` spawned the evaluator as `node --input-type=module -e <inline-script>` where the inline script's first two statements used CJS `require()` for fs and path. `require` is undefined in ESM scope → `ReferenceError` at parse, line 2, before any user code ran. `stdio: "ignore"` swallowed the stderr. **Every hook-spawned evaluator since at least 2026-04-11 crashed silently** — scorecards stopped appearing in `.indusk/eval/results.log`, the system looked idle, nothing surfaced. Direct invocations (via `indusk eval` subcommands and ad-hoc node scripts) were unaffected. Fix: inline script now uses ESM-native `import { mkdirSync, appendFileSync } from "node:fs"` and `import { dirname, join } from "node:path"`. Belt-and-suspenders: added `process.on("uncaughtException")` + `process.on("unhandledRejection")` handlers that write an `error: true` entry to `results.log` before `process.exit(1)` — so the next silent-failure class is loud. Diagnosed via the predecessor OTel plan's falsification ritual; regression test grep-asserts the fix. See the [eval overview's Known Failure Modes section](/reference/eval/overview#known-failure-modes) for the debugging recipe.
- **Eval agent dataset routing via composable.env (1.18.2)** — when `OTEL_EXPORTER_OTLP_HEADERS` env var is set with a `Dash0-Dataset=<project-dataset>` entry (composable.env default), exporter-constructor headers lose — OTel spec says env beats constructor. Fixed by (1) adding `EVAL_AGENT_DATASET` env var to the dataset resolution chain (priority: `INDUSK_EVAL_OTEL_DATASET` > `EVAL_AGENT_DATASET` > config `eval.otel.dataset` > `"agent"` default), and (2) rewriting `Dash0-Dataset=<old>` to `Dash0-Dataset=<eval-agent-dataset>` in `OTEL_EXPORTER_OTLP_HEADERS` in-place before the exporter reads it. Confirmed end-to-end via `dash0 spans query --dataset agent`: `final-smoke-via-ce-env` span landed in the agent dataset with `EVAL_AGENT_DATASET=agent` + `DASH0_DATASET=indusk-test` in the shell env. See `env/components/dash0.env` for the composable.env wiring.
- **Eval agent OTel header env parsing (1.18.1)** — the OTel SDK's `OTEL_EXPORTER_OTLP_HEADERS` env parser silently drops Bearer tokens that contain a space (e.g., `Authorization=Bearer auth_xxx`). Result: exports retry-looped to no effect even though `initEvalOtel` logged success. Fixed by reading `DASH0_API_TOKEN` directly in `otel.ts` and attaching `Authorization: Bearer ${DASH0_API_TOKEN}` to the exporter constructor's `headers` option. User-set `OTEL_EXPORTER_OTLP_HEADERS` env still takes precedence per OTel spec. Diagnosed via `dash0 spans query` showing our test probe reached Dash0 only when headers were hardcoded in the constructor.

### Added
- **Eval agent OpenTelemetry (1.18.0)** — opt-in OTel tracing for the background eval agent (evaluator). Default OFF, zero cost in normal operation. Enable via `eval.otel.enabled: true` in `.indusk/config.json` or `INDUSK_EVAL_OTEL=1` env var. Exports to `OTEL_EXPORTER_OTLP_ENDPOINT` (Dash0 or any OTLP HTTP receiver). Routes to Dash0 "agent" dataset by default via `Dash0-Dataset` header; override with `eval.otel.dataset` config or `INDUSK_EVAL_OTEL_DATASET` env. Span tree: root `eval.run` (attrs: `changeId`, `source`, `mode`, `projectGroup`, `resumed`, `highlights.unprocessed_count`) + wrapper-level children (`read_session`, `build_prompt`, `spawn_claude`, `parse_output`, `update_session`, `write_scorecard`, `clear_stale_session`). `eval.spawn_claude` carries `exit.code` + `exit.stderr_tail` (on error) — the primary diagnostic signal when the evaluator fails. Inside-Claude steps (catchup, read_transcript, answer_rubric, etc.) can't be spanned from the wrapper — documented as future work if Claude Code exposes its own OTel. See the [Eval Agent OTel docs](/reference/tools/otel#eval-agent-otel-opt-in).

### Changed
- **Rename: "judge" → "evaluator" / "eval agent" (Phase 0 of `improvement-eval-agent-open-telemetry`)** — the background process that scores every `jj describe` is now called the eval agent or evaluator in code. Files renamed: `judge-runner.ts` → `evaluator-runner.ts`, `persistent-judge.ts` → `persistent-evaluator.ts`. Symbols renamed: `runJudgeSync` → `runEvaluatorSync`, `runJudgeBackground` → `runEvaluatorBackground`, `buildJudgePrompt` → `buildEvaluatorPrompt`, `JudgeRunOptions` → `EvaluatorRunOptions`. Log strings, skill docs, and reference pages updated. The state file `.indusk/eval/judge-session.json` becomes `.indusk/eval/evaluator-session.json` (harmless — the evaluator has been silently failing since 2026-04-11 so no one had live session state). No external CLI or MCP API change. Historical mentions of "judge" in archived changelog entries and archived plan docs remain as-is.

### Added
- **Agent Roles — highlights queue and eval-processing pipeline (1.17.0)** — the working agent stops writing Graphiti episodes at trigger points. Instead it calls `mcp__indusk__highlight` with a tag, a single-line note, and a level (`critical` / `important` / `note`). Highlights append to `.indusk/highlights.jsonl`. The eval agent, spawned on every `jj describe` and at session end, reads unprocessed highlights via `highlights_unprocessed`, writes level-weighted Graphiti episodes via `graph_capture` (critical → 1.0, important → 0.6, note → 0.3), and calls `highlight_mark_processed` with either `wrote-episode` or `skipped`. Three-tier agent roles (working agent / eval agent / infrastructure) documented in CLAUDE.md Architecture + Key Decisions. New `/highlight` slash command for explicit user-flagged moments. `handoff` skill fires `eval-trigger.js --source handoff` at session end so queued highlights are processed before the session ends — the eval-trigger hook now accepts `--source <tag>` and propagates it to the judge via `INDUSK_EVAL_SOURCE`. planner / work / retrospective skills migrated from direct `graph_capture` calls to `highlight` calls. See the [Highlights reference](/reference/tools/highlights) for the full flow and level semantics.

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
