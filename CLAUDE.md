# dusk — Project Context

## What This Is

A pnpm + Turborepo monorepo containing the InDusk development system. The repo dogfoods its own skill system — the same plan/work/verify/context skills used to build features are also the product being showcased.

## Architecture

```
dusk/
├── apps/
│   ├── indusk-mcp/        # InDusk MCP server — dev system tooling
│   └── indusk-docs/       # VitePress documentation site with Mermaid + FullscreenDiagram
├── .claude/skills/        # Claude Code skills (installed via `init`, not manually maintained)
│   ├── planner/SKILL.md   # Installed from apps/indusk-mcp/skills/ — slash command is /planner (not /plan)
│   ├── work/SKILL.md      # Installed from apps/indusk-mcp/skills/
│   ├── context/SKILL.md   # Installed from apps/indusk-mcp/skills/
│   ├── verify/SKILL.md    # Installed from apps/indusk-mcp/skills/
│   ├── retrospective/SKILL.md # Installed from apps/indusk-mcp/skills/
│   ├── catchup/SKILL.md   # Installed from apps/indusk-mcp/skills/
│   ├── handoff/SKILL.md   # Installed from apps/indusk-mcp/skills/
│   ├── jj/SKILL.md        # Installed from apps/indusk-mcp/skills/
│   ├── graphiti/SKILL.md  # Installed from apps/indusk-mcp/extensions/graphiti/
│   └── composable-env/    # composable.env skill (installed via ce add-skill)
├── docker/                # Dockerfiles: Dockerfile.infra (FalkorDB + Graphiti bundled), Dockerfile.nextdev, etc.
├── env/                   # composable.env: components, profiles, contracts
├── biome.json             # Biome config — quality ratchet, see biome-rationale.md for why each rule exists
├── biome-rationale.md     # Annotated rationale for each non-default Biome rule
├── vitest.config.ts       # Root Vitest config — workspace projects, apps inherit via extends: true
├── .indusk/               # InDusk home directory — plans, extensions, config
│   ├── planning/          # Plans following the planner skill lifecycle
│   ├── extensions/        # Extension manifests (built-in + third-party)
│   ├── graph/             # Semantic graph event log (not gitignored in normal mode; inherits .indusk/ exclusion in --local mode)
│   └── config.json        # Project profile — mode, detected tooling, verify contract
├── .indusk/research/      # Standalone research docs
└── CLAUDE.md              # This file — living project memory
```

**Apps:**
- **indusk-mcp**: InDusk MCP server — dev system tooling with MCP tools, CLI (`init`/`update`/`init-docs`/`extensions`/`check-gates`/`infra`), skills, hooks, lessons, and extensions. `.indusk/extensions/` holds extension manifests (built-in + third-party). Published as `@infinitedusky/indusk-mcp`. OTel templates (`templates/instrumentation.ts`, `templates/filtering-exporter.ts`, `templates/logger.ts`, `templates/instrumentation.py`) are scaffolded by `init` into target projects.
- **indusk-infra**: Bundled Docker container (`docker/Dockerfile.infra`) running FalkorDB + Graphiti MCP server. One container for all graph infrastructure. FalkorDB on port 6379, Graphiti on port 8100. Persistent volume `indusk-data` at `/data`. `GOOGLE_API_KEY` env var for Gemini LLM/embeddings. OTel export optional via `OTEL_EXPORTER_OTLP_ENDPOINT`.

**MCP servers** (registered in `.mcp.json` per project):
- **`indusk`** — InDusk MCP tools (lessons, plans, context, extensions, code graph)
- **`codegraphcontext`** (CGC) — structural code intelligence via FalkorDB graph queries
- **`graphiti`** — temporal knowledge graph (Phase 5.5 of graphiti-infrastructure). Captures decisions, contradictions, and lessons across sessions. 9 tools: `add_memory`, `search_nodes`, `search_memory_facts`, `get_episodes`, `get_entity_edge`, `delete_episode`, `delete_entity_edge`, `clear_graph`, `get_status`. Group ids isolate knowledge by project (`dusk`, `numero`, etc.) plus a `shared` group for cross-project conventions. Registered automatically by `indusk init` ≥ v1.10.0.
- **`dash0`** — observability (logs, traces, metrics) via the Dash0 hosted MCP. Use traces-first when investigating.
- **`excalidraw`** — hand-drawn diagrams.
- **indusk-docs**: VitePress 1.x documentation site with Mermaid diagrams and FullscreenDiagram component. Runs in Docker via composable.env. `pnpm turbo dev --filter=indusk-docs` for local dev.

**Skills:**

| Skill | Status | Purpose |
|-------|--------|---------|
| planner | stable | Structured planning lifecycle: research → brief → ADR → impl → retrospective |
| work | stable | Execute impl checklists methodically, one item at a time |
| context | stable | Maintain living project memory in CLAUDE.md, shape impl docs to include per-phase context updates |
| verify | stable | Automated verification loop — type checks, lint, tests — integrated with work |
| document | stable | Per-phase documentation gate with Mermaid diagram guidance |
| retrospective | stable | Closing audit — docs, tests, quality, context — plus knowledge handoff and archival |

## Conventions

- pnpm workspaces, Turborepo for task orchestration
- **Node 22 required** — Tailwind 4 native bindings need it
- **Biome for linting and formatting** — NOT ESLint. Single tool, single config. Run `biome check` not `eslint`
- **composable.env for environment management** — all apps run in Docker containers for local dev. Use `pnpm env:build` before `docker compose`. Use `pnpm ce` for all composable.env commands, never `npx ce`
- Skills are markdown files in `.claude/skills/{name}/SKILL.md` — each concept has one canonical skill, others cross-reference
- Plans follow the lifecycle: research → brief → ADR → impl → retrospective
- All planning docs live in `.indusk/planning/{kebab-case-name}/`
- Every impl phase has **four required gates** (verify, context, document) plus an **optional OTel gate**. The OTel gate fires by default. Set `otel.role` in `.indusk/config.json` to `"library"`, `"tool"`, or `"none"` to silence it for projects that don't produce runtime telemetry. dusk/indusk-mcp itself is `library` — its phases never have OTel sections.
- Plan gates are enforced via Claude Code hooks — the agent cannot skip verification/context/document items when advancing phases
- `.claude/hooks/` contains gate enforcement scripts installed by init (check-gates.js blocks execution, validate-impl-structure.js blocks writing, gate-reminder.js nudges)
- Every impl phase must have verification, otel, context, and document sections — enforced by hook at write time. Use `(none needed)` or `skip-reason:` to opt out.
- Health checks, init setup, and verification commands come from extensions — don't hardcode tool knowledge in indusk-mcp
- Three layers of defense: (1) Context/CLAUDE.md — advisory, (2) Biome rules — enforcement, (3) Hooks — gate enforcement, (4) Retrospective — learning. The quality ratchet only gets tighter.
- Use the planner skill before implementing significant features — don't jump to code
- `pnpm test` runs all tests, `pnpm turbo test --filter={app}` for scoped runs. Vitest configs use `passWithNoTests: true`
- Verification items in impl docs must be specific runnable commands with expected output — not "verify it works"
- Every new impl.md opens with a `## Test Trajectory` table after `## Boundary Map` and before `## Checklist`. Columns: `ID | Asserts | Writable at | Passes at | State` (optional: `Kind`, `Scope`). Phase Verification sections reference test IDs from the trajectory — not free-text checks. Deferred Verification rows (for genuinely untestable items) require three fields: `reason:`, `would require:`, `mitigation:`. The planner skill's impl.md template emits this shape; `trajectory: required` in frontmatter opts the impl into `validate-impl-structure.js` enforcement. See `.indusk/planning/tests-first-planning/adr.md`.
- Phase close requires every `Passes at: Phase N` trajectory row to be in `State: passing` (or `skipped`/`blocked` with a reason). The `check-gates` hook enforces this structurally — deferral is impossible by construction. The work skill updates the `State` column at phase start (to `writable`/`written`) and phase close (to `passing`/`skipped`/`blocked`). Library helpers live in `apps/indusk-mcp/src/lib/trajectory/state-ops.ts`.
- Retrospectives audit the trajectory at plan close — `auditPlanAtClose` from `apps/indusk-mcp/src/lib/trajectory/audit.ts` surfaces rows ending in `blocked` state and classifies every Deferred Verification row's `mitigation:` (telemetry-alert / scheduled-review / downstream-plan / canary-or-staging / feedback-signal / unclassified). Vague mitigations become retrospective findings that must be resolved or promoted to a concrete commitment before the plan archives.
- Every plan that completes impl runs `/falsify {plan}` before `/retrospective`. The ritual (a bounty hunt: investigate, hypothesize, write a failing test that confirms the hypothesis) writes an append-only log at `.indusk/planning/{plan}/falsification.md` via `apps/indusk-mcp/src/lib/falsification/log.ts`. Skipping requires both `falsification: skipped` AND `falsification_reason: "{non-empty text}"` in the impl frontmatter. See `.indusk/planning/falsification-ritual/adr.md`.
- Retrospective hard-blocks without falsification. The retrospective skill's Step 0 (Falsification Gate) refuses to proceed unless either `isFalsificationComplete(planRoot)` or `isFalsificationSkipped(implContent).skipped` is true. The work skill's Step 15 (Completion) directs users to run `/falsify` before `/retrospective`. Both are skill-level enforcement, not a validator hook — enough to carry the discipline without the rigidity of a Node-level block.
- `pnpm check` for lint/format check, `pnpm check:fix` to auto-fix, `pnpm format` for format-only
- After each retrospective, ask if mistakes could be caught by a Biome rule — if yes, add to biome.json and biome-rationale.md
- Before touching shared code, query the code graph (`analyze_code_relationships`) to understand blast radius
- Create `.cgcignore` in new projects to exclude build artifacts from graph indexing
- **Graphiti capture is automatic at trigger points, not manual.** The planner skill writes a `brief-accepted-{plan}` episode when a brief moves to `accepted` and an `adr-{plan}` Y-statement when an ADR is accepted. The work skill writes a `correction-{slug}` episode when the user confirms `context learn`. The retrospective skill writes one episode per "What We Learned" and "What We'd Do Differently" item. The catchup skill recalls recent decisions and lessons via `mcp__graphiti__search_nodes` at session start (Step 4.5) and surfaces them in the catchup summary. **The agent rarely needs to call `mcp__graphiti__add_memory` directly** — trust the skills to capture, and let `/catchup` recall.
- The semantic graph sync pipeline is adapter-agnostic by design (see `.indusk/research/anchor-overlay-pattern.md` Section 7). CGC is the first adapter; adding a new adapter means implementing `SemanticGraphAdapter` — the sync engine itself never changes. Enforced by sync-engine tests, which cannot import anything CGC-related.
- Use `indusk graph sync` to manually sync the semantic graph; `indusk graph rebuild` to clear and replay the runtime; `indusk graph status` for diagnostics. Also available as MCP tools (`graph_sync`, `graph_rebuild`, `graph_status`).
- **Eval hook fires on every `jj describe`** — a Claude Code PostToolUse hook spawns a background judge agent that scores work quality, writes derived insights to Graphiti, and logs scorecards to `.indusk/eval/results.log`. Disable with `eval.enabled: false` in `.indusk/config.json`. `indusk eval summary` for trends, `indusk eval baseline --task <path>` for baseline comparisons. Eval findings persist until fixed or ignored — the agent sees unresolved findings on every `jj describe`. `indusk eval findings` to list, `indusk eval fix <key>` / `indusk eval ignore <key>` to resolve. The eval judge is persistent per session — catchup runs once on first commit, subsequent commits reuse the session via `claude --resume`.
- `indusk infra start` to start the infrastructure container (FalkorDB + Graphiti). One command, idempotent. Creates `~/.indusk/config.env` on first run.
- `npx indusk-mcp init` to set up a new project with skills, CLAUDE.md, biome, OTel instrumentation, and MCP config
- `init` scaffolds OTel: `instrumentation.ts`, `filtering-exporter.ts`, `logger.ts` (Node.js/Next.js) or `instrumentation.py` (Python) — every project is observable from day one

## Key Decisions

- Context skill is pure markdown instructions, not MCP tools — see `.indusk/planning/context-skill/adr.md`
- CLAUDE.md has a fixed 6-section structure maintained by the context skill — see `.indusk/planning/context-skill/adr.md`
- Biome over ESLint: single binary, no plugin config hell, fast enough for per-item verification
- Global + project-level Biome config: global is the quality floor across all projects, project-level extends with overrides
- InDusk MCP server will be published as an npm package for use across projects
- Vitest as committed test runner; adaptive first-connect setup detects existing tooling before installing — see `.indusk/planning/verify-skill/adr.md`
- Biome config is a knowledge artifact with biome-rationale.md; quality ratchet only gets tighter — see `.indusk/planning/code-quality-system/adr.md`
- CodeGraphContext with global FalkorDB + local CGC via pipx for structural code intelligence — see `.indusk/planning/codegraph-context/adr.md`
- Document skill (per-phase execution gate) + retrospective skill (closing audit with knowledge handoff to VitePress docs) — see `.indusk/planning/document-skill/adr.md`
- GSD-inspired: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, domain skills — see `.indusk/planning/gsd-inspired-improvements/adr.md`
- Plan gate enforcement via Claude Code PreToolUse hooks — blocks phase transitions with incomplete gates — see `.indusk/planning/enforce-plan-gates/adr.md`
- Extension system: one system, two sources (built-in + third-party manifests), replaces domain skills — see `.indusk/planning/extension-system/adr.md`
- Excalidraw extension for hand-drawn diagrams, complements Mermaid (formal docs = Mermaid, informal/conceptual = Excalidraw) — see `.indusk/planning/excalidraw-extension/adr.md`
- ExcalidrawEmbed component for persistent Excalidraw diagrams in VitePress via iframe — see `.indusk/planning/vitepress-extension/adr.md`
- OTel as core instrumentation with category-based filtering — see `.indusk/planning/otel-core-skill/adr.md`
- Bundled `indusk-infra` container (FalkorDB + Graphiti), global CLI install, `~/.indusk/config.env` for secrets — see `.indusk/planning/graphiti-infrastructure/adr.md`
- Local init mode: `.indusk/` as home directory, `config.json` as project profile, `--local` flag for team repos — see `.indusk/planning/archive/local-init-mode/adr.md`
- OTel gate is role-aware via `otel.role` in `.indusk/config.json` (Phase 5.25 of graphiti-infrastructure). Unset/`service` = gate fires (default). `library`/`tool`/`none` = gate silenced. The planner skill stops writing OTel sections, and both gate-enforcement hooks honor the same rule. Backwards compatible: projects without the field behave exactly as before. indusk-mcp itself is `library`.
- Graphiti registered directly in `.mcp.json` as a top-level MCP server (Option C from Phase 5.5 of graphiti-infrastructure). Agent calls `mcp__graphiti__*` tools directly (no `indusk` wrapper). `GraphitiClient` typed wrapper at `apps/indusk-mcp/src/lib/graphiti-client.ts` is kept for internal use only — skills/catchup that want typed defaults (project group + `shared` resolution, error swallowing) use it; the agent does not. Capture is automatic at trigger points (planner brief/ADR, work corrections, retro lessons), not manual. Recall happens in catchup Step 4.5.
- Context system evaluation via commit-triggered judge agent: PostToolUse hook on Bash spawns a persistent judge session in background on every `jj describe`, scores work against a 4-question rubric, writes derived insights to Graphiti, logs scorecards to `.indusk/eval/results.log`. Findings persist until fixed or ignored. Persistent sessions amortize catchup cost across commits. `indusk eval summary/findings/fix/ignore/baseline` CLI. `system.log` for lifecycle visibility — see `.indusk/planning/archive/semantic-graph-eval/adr.md`
- Falsification ritual (`/falsify`) between `/work` and `/retrospective`: same working agent, goal-flipped from "prove it works" to "find a failing test"; bounty-hunting loop (investigate → hypothesize → write confirming test → run) with three outcomes per failing test (fix-in-scope reopens impl, spawn-plan creates a new plan, accept-finding records for retro); hybrid exit (agent proposes, user confirms). Bookend to `tests-first-planning` — Trajectory writes failing tests at plan start that pass on success; falsification hunts failing tests at plan close that shouldn't be producible if success is real. Retrospective skill's Step 0 hard-blocks without a completed log or `falsification: skipped` frontmatter. See `.indusk/planning/falsification-ritual/adr.md` and the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md).
- Context beam: fixed 6-query pipeline (`context_beam` MCP tool) for file-specific context delivery. Queries semantic graph, Graphiti, eval findings, and CGC with distance-based decay (0=full, 1=summary, 2=name). Optional graph weights via COALESCE. Trace mode for transparency. V1 explicit invocation, v2 auto-injection via PreToolUse hook — see `.indusk/planning/archive/context-beam/adr.md`
- Semantic graph bridge as event-sourced projection: per-project append-only log (`.indusk/graph/semantic-graph.log`) is canonical, tagged with jj change IDs, gitignored and local-only; FalkorDB runtime (`semantic-{project}`) is a disposable projection replayed from the log; anchor identity uses graph-stored UUIDs matched via git blob hashes and git rename detection; sync pipeline is adapter-agnostic (must not know "CGC") to preserve optionality for future non-code adapters. Graphiti captures flow through a log-writer wrapper (`captureWithLog`) that mirrors every Graphiti write as an `edge.attached` event in the semantic graph log — see `.indusk/planning/archive/cgc-graphiti-bridge/adr.md` and companion whitepaper `.indusk/research/anchor-overlay-pattern.md`.
- Test Trajectory as canonical shape for every new impl.md: top-of-document table with `ID | Asserts | Writable at | Passes at | State` columns, phase Verification sections reference test IDs, Deferred Verification subsection requires three fields (`reason:`, `would require:`, `mitigation:`). Four validator rules enforced by `validate-impl-structure.js`; phase close structurally gated by `check-gates.js` on `Passes at: Phase N` rows being terminal. Retrospective skill audits mitigations via `auditPlanAtClose`. See `.indusk/planning/tests-first-planning/adr.md`.

## Known Gotchas

- Tailwind 4 requires Node 22 — build fails on Node 18 with "Cannot find native binding" error
- Always use `pnpm ce`, not `npx ce` — the skill doc specifies pnpm
- Always run `pnpm env:build` before `docker compose` — use the ce-generated scripts
- Don't jump to implementation without planning — use the planner skill lifecycle
- composable.env binary is `ce`, not `composable.env` — the package.json script should be `"ce": "ce"`
- Skill files are `SKILL.md` (all caps), not `skill.md`
- Vitest `passWithNoTests: true` must be set in each app's `vitest.config.ts`, not just root — `extends: true` doesn't inherit it when the app defines its own `test` block
- Biome 2.x API differs from docs/examples: `noVar` doesn't exist, `noUnusedVariables` has no `ignorePattern` option, overrides use `includes` not `include`. Always match schema version to installed version.
- Impl parser must handle all four gate types per phase: implementation, verification, context, document — not just three
- OTel gate is conditional on `otel.role` in `.indusk/config.json`. Set to `"library"` / `"tool"` / `"none"` to silence the gate. Unset (or `"service"`) keeps the gate firing. dusk and apps/indusk-mcp both have `otel.role: library` — do NOT add `#### Phase N OTel` sections to plans in this repo. The `validate-impl-structure` and `check-gates` hooks read `.indusk/config.json` directly via inlined helpers (they can't import the TS one).
- Skills in `.claude/skills/` are package-owned — edit in `apps/indusk-mcp/skills/`, then run `update` to sync. Don't edit `.claude/skills/` directly.
- Domain skills directory (`skills/domain/`) removed — domain skills are now extensions. Use `extensions enable nextjs` not `init --skills nextjs`.
- OTel auto-instrumentation must be loaded before any other imports — use `node --import ./instrumentation.ts` or the Next.js instrumentation hook
- CGC graphs use `cgc-` prefix: `cgc-dusk`, `cgc-numero`, etc. Graphiti semantic graphs use bare project names. Don't confuse them in FalkorDB.
- CGC connects to `localhost:6379` via the `indusk-infra` container (not the old standalone `falkordb` container on `falkordb.orb.local`). If CGC tools fail, check `docker ps --filter name=indusk-infra`.
- FalkorDB and Graphiti run in a single bundled container (`indusk-infra`), not as separate containers. Use `docker/test-infra.sh` to smoke test. Port 8000 is taken by OrbStack — Graphiti uses 8100.
- `GOOGLE_API_KEY` is required for Graphiti (Gemini LLM/embeddings). Without it, FalkorDB still works but Graphiti retries indefinitely. Store in `~/.indusk/config.env` (global, not per-project).
- Graphiti source at `~/.graphiti/` has a reranker patch — this is now baked into `docker/patches/graphiti-reranker.patch` and applied during image build.
- In local mode, `.git/info/exclude` manages ignores — if you re-clone, re-run `indusk init --local`. The exclude file is per-clone, not committed.
- In local mode, run `indusk pr-clean` before PRs to strip InDusk settings from `.claude/settings.json`. Run `indusk pr-restore` after.
- Semantic graph event log is append-only jsonl at `.indusk/graph/semantic-graph.log` — never edited in place, never rewritten. Malformed lines (from crashed writes or hand edits) are skipped on replay with a warning via the reader's `onMalformed` callback, not thrown.
- Semantic graph bridge requires jj — projects without jj cannot use it in v1. If `jj` is missing or the cwd is not a jj repo, sync fails with `NotAJjRepoError` explicitly rather than silently degrading. Stable change IDs (not git commit SHAs) are the versioning substrate because they survive rebase/amend/split/abandon.
- FalkorDB now holds three graph namespaces per project, all in the same `indusk-infra` container: `cgc-{project}` (CGC's structural index), `semantic-{project}` (the semantic graph runtime — anchors and overlay edges projected from the event log), and any Graphiti groups. The semantic graph namespace is disposable; the canonical state lives in `.indusk/graph/semantic-graph.log` and rebuild = replay-the-log.
- FalkorDB JS client (`falkordb` npm) returns query results as `{ data: Array<Record<aliasKey, value>> }` — rows are objects keyed by the projection alias, NOT positional tuples. Always alias projections in Cypher (`RETURN a.uuid AS uuid`) and read by name (`row.uuid`). Tested by chasing 6 false-positive failures in Phase 3 of cgc-graphiti-bridge.
- CGC adapter reads from `cgc-{basename}` graph, writes to `semantic-{basename}` graph. Different graph namespaces, same FalkorDB instance. Don't mix them up in manual Cypher. Internal imports (relative specifiers only) are projected as `edge.attached` events with `relation: "imports"` — npm packages and `node:*` builtins are excluded.
- `indusk graph rebuild` is safe to run at any time — the FalkorDB runtime for the semantic graph is disposable and reconstructs deterministically from the event log at `.indusk/graph/semantic-graph.log` via `replay()` in `apps/indusk-mcp/src/lib/semantic-graph/replay.ts`. No data is stored exclusively in the runtime; all canonical state lives in the log.
- The eval judge needs `claude` CLI available in PATH. If eval scorecards aren't appearing, check `which claude` and `.indusk/eval/results.log` for error entries. The eval hook is a Claude Code PostToolUse hook — it only fires inside Claude Code sessions, not from manual `jj describe` in a terminal.
- Falsification log fields (`hypothesis`, `note`, `reason`) must be single-line. The library rejects any line-separator character (LF, CR, U+2028, U+2029) at the boundary — callers sanitize before passing or split multi-part content across multiple hypothesis entries. Discovered by the `/falsify` dogfood on the falsification-ritual plan itself (logged at `.indusk/planning/falsification-ritual/falsification.md`). Without rejection, the line-oriented markdown parser silently truncates at the first line separator on round-trip.
- Test Trajectory parser is strict about phase references being numeric (`Phase N`). Slug-style references are rejected — reorder overhead is intentional, per `.indusk/planning/tests-first-planning/adr.md` Section 6a. Temporal coherence (`Writable at ≤ Passes at`) is enforced by the validator; a reorder that breaks this fails at write time rather than silently.
- `validate-impl-structure.js` full-file validation triggers when the edit's `new_string` contains a phase header — and the regex `/###\s+Phase\s+\d+/` matches `#### Phase` too (three of four hashes plus space). If you edit inside a phase and the hook flags unrelated OTel/Verification gaps, the edit itself is fine but the file-as-a-whole has structural gaps. Scope your edit to checklist items (not the phase heading) to limit re-validation.
- The trajectory hook JS ports (`check-gates.js`, `gate-reminder.js`, `validate-impl-structure.js`) are MINIMAL mirrors of `apps/indusk-mcp/src/lib/trajectory/` — each hook re-parses the trajectory table with just the fields it needs. When adding a new trajectory field or changing parser behavior, update the TS source AND every JS port. The TS is tested (55 tests across `parser.test.ts`, `validator.test.ts`, `state-ops.test.ts`, `template.test.ts`); the JS ports are exercised via end-to-end hook invocations.

## Current State

Repo scaffolded, building, and at v1.10.3 published. **`graphiti-infrastructure` plan completed and archived 2026-04-07** — indusk-infra container running FalkorDB + Graphiti, Graphiti registered as MCP server in every project's `.mcp.json` via init, capture/recall triggers wired into planner/work/retrospective/catchup skills, otel.role role-aware gate landed, hyphen-in-group-id sanitization fixed. CGC indexing the project (118 files, 19821 functions). Biome configured with VS Code integration. OTel extension active — every project scaffolded by `init` gets instrumentation by default. **OTel gate is conditional on `otel.role` in `.indusk/config.json`** (Phase 5.25 of graphiti-infrastructure): fires by default, silenced for `library`/`tool`/`none`. dusk/indusk-mcp itself is `otel.role: library` — phases here never have OTel sections. Local init mode (`--local`) available for using InDusk on team repos without touching committed files. `.indusk/config.json` serves as the central project profile. **Semantic graph bridge live** — event-sourced projection of CGC structure + Graphiti knowledge into `semantic-{project}` FalkorDB graphs. Anchors exist for dusk (~10k) and chitin-sportsbook (18). Internal import edges projected. `indusk graph sync/rebuild/status` CLI and MCP tools available. Sync runs at phase boundaries automatically via work skill. **Context system evaluation live** — commit-triggered judge agent scores every commit via Claude Code PostToolUse hook, writes derived insights to Graphiti, logs scorecards to `.indusk/eval/results.log`. `indusk eval summary` for trends, `indusk eval baseline --task <path>` for baseline comparisons. `/eval review` for manual quality checks. **Context beam live** — `context_beam` MCP tool and `indusk beam` CLI for file-specific context delivery. 6-query pipeline across semantic graph, Graphiti, eval findings, and CGC with distance-based decay and trace mode. **Test Trajectory live and archived** — every new impl.md opens with a Test Trajectory table (columns `ID | Asserts | Writable at | Passes at | State`), phase Verification references test IDs, Deferred Verification requires three fields including mitigation. Four validator rules enforced by `validate-impl-structure.js`; phase close structurally gated by `check-gates.js`; retrospective audit classifies mitigations. 67 trajectory tests in `apps/indusk-mcp/src/lib/trajectory/`. `tests-first-planning` plan archived 2026-04-16 — shipped in indusk-mcp 1.15.0 (feature) and 1.15.1 (update hook-sync fix). **`agent-roles` is the first active plan running under the new shape** (Phase 1 of 4, impl retrofitted with 14 trajectory rows + 1 deferred row). **Falsification Ritual live** — `/falsify {plan}` runs between `/work` and `/retrospective`, driving the same working agent through a goal-flipped bounty hunt. Retrospective hard-blocks without a completed falsification log or explicit skip-reason frontmatter. Shipped in indusk-mcp 1.16.0. The falsification-ritual plan dogfooded itself — the ritual found 2 real gaps in its own log library (LF and CR line-separator truncation), both fixed in scope via Phase 5.

**Sibling test bed**: `~/code/sandbox/chitin-sportsbook` is a real project (peer-to-peer baseball moneyline sportsbook on Base Sepolia, NUMEROSP-settled, agent-first API) being built using the dev system as both a substrate for evaluating CGC + Graphiti and as a future Numero module candidate. First plan (`scaffold-bootstrap`) ran end-to-end with full capture/recall on 2026-04-07. Ongoing experimental evaluation lives in `cgc-graphiti-evaluation` spike.

**Active plans:**

| Plan | Stage | Next Step |
|------|-------|-----------|
| agent-roles | impl (draft, retrofitted with Test Trajectory) | `/work agent-roles` Phase 1 (highlights queue infrastructure) |
| hermes-inspired-improvements | brief (accepted) | Create ADR |
| graph-knowledge-architecture | impl (draft) | Review impl in light of agent-roles' highlights-queue decisions |
| mcp-orchestration-layer | brief (draft) | Sandy reviews brief |
| complementary-personas | brief (draft) | Review — last in pipeline |
| lsp-structural-indexing | brief (draft) | Review |
| type-edges | brief (draft) | Review |
| context-migration | brief (draft) | Needs fresh brief when beam data quality is proven |
| agent-skills-format | brief (draft) | Sandy reviews brief |
| dusk-v2 | research (in-progress, parked) | Pick back up when ready to rewrite indusk-mcp |
| react-native-support | impl (approved, parked) | Roll OTel substance into dusk-v2 OTel-as-extension; archive otherwise |
