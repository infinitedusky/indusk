# infinitedusky — Project Context

## What This Is

A pnpm + Turborepo monorepo containing Sandy's personal brand site and the development system that powers it. The repo dogfoods its own skill system — the same plan/work/verify/context skills used to build features are also the product being showcased.

## Architecture

```
infinitedusky/
├── apps/
│   ├── indusk-portfolio/   # Next.js 15 + Tailwind 4 — personal brand/portfolio site
│   ├── indusk-mcp/        # InDusk MCP server — dev system tooling
│   └── indusk-docs/       # VitePress documentation site with Mermaid + FullscreenDiagram
├── .claude/skills/        # Claude Code skills (installed via `init`, not manually maintained)
│   ├── plan/SKILL.md      # Installed from apps/indusk-mcp/skills/
│   ├── work/SKILL.md      # Installed from apps/indusk-mcp/skills/
│   ├── context/SKILL.md   # Installed from apps/indusk-mcp/skills/
│   ├── verify/SKILL.md    # Installed from apps/indusk-mcp/skills/
│   └── composable-env/    # composable.env skill (installed via ce add-skill)
├── docker/                # Dockerfiles: Dockerfile.infra (FalkorDB + Graphiti bundled), Dockerfile.nextdev, etc.
├── env/                   # composable.env: components, profiles, contracts
├── biome.json             # Biome config — quality ratchet, see biome-rationale.md for why each rule exists
├── biome-rationale.md     # Annotated rationale for each non-default Biome rule
├── vitest.config.ts       # Root Vitest config — workspace projects, apps inherit via extends: true
├── .indusk/               # InDusk home directory — plans, extensions, config
│   ├── planning/          # Plans following the planner skill lifecycle
│   ├── extensions/        # Extension manifests (built-in + third-party)
│   └── config.json        # Project profile — mode, detected tooling, verify contract
├── .indusk/research/      # Standalone research docs
└── CLAUDE.md              # This file — living project memory
```

**Apps:**
- **indusk-portfolio**: Next.js 15 + Tailwind 4. Dark theme (zinc-950 bg, amber-400 accents). Runs in Docker via composable.env for local dev.
- **indusk-mcp**: InDusk MCP server — dev system tooling with MCP tools, CLI (`init`/`update`/`init-docs`/`extensions`/`check-gates`/`infra`), skills, hooks, lessons, and extensions. `.indusk/extensions/` holds extension manifests (built-in + third-party). Published as `@infinitedusky/indusk-mcp`. OTel templates (`templates/instrumentation.ts`, `templates/filtering-exporter.ts`, `templates/logger.ts`, `templates/instrumentation.py`) are scaffolded by `init` into target projects.
- **indusk-infra**: Bundled Docker container (`docker/Dockerfile.infra`) running FalkorDB + Graphiti MCP server. One container for all graph infrastructure. FalkorDB on port 6379, Graphiti on port 8100. Persistent volume `indusk-data` at `/data`. `GOOGLE_API_KEY` env var for Gemini LLM/embeddings. OTel export optional via `OTEL_EXPORTER_OTLP_ENDPOINT`.
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
- Every impl phase has **four required gates** (verify, context, document) plus an **optional OTel gate**. The OTel gate fires by default. Set `otel.role` in `.indusk/config.json` to `"library"`, `"tool"`, or `"none"` to silence it for projects that don't produce runtime telemetry. infinitedusky/indusk-mcp itself is `library` — its phases never have OTel sections.
- Plan gates are enforced via Claude Code hooks — the agent cannot skip verification/context/document items when advancing phases
- `.claude/hooks/` contains gate enforcement scripts installed by init (check-gates.js blocks execution, validate-impl-structure.js blocks writing, gate-reminder.js nudges)
- Every impl phase must have verification, otel, context, and document sections — enforced by hook at write time. Use `(none needed)` or `skip-reason:` to opt out.
- Health checks, init setup, and verification commands come from extensions — don't hardcode tool knowledge in indusk-mcp
- Three layers of defense: (1) Context/CLAUDE.md — advisory, (2) Biome rules — enforcement, (3) Hooks — gate enforcement, (4) Retrospective — learning. The quality ratchet only gets tighter.
- Use the planner skill before implementing significant features — don't jump to code
- `pnpm test` runs all tests, `pnpm turbo test --filter={app}` for scoped runs. Vitest configs use `passWithNoTests: true`
- Verification items in impl docs must be specific runnable commands with expected output — not "verify it works"
- `pnpm check` for lint/format check, `pnpm check:fix` to auto-fix, `pnpm format` for format-only
- After each retrospective, ask if mistakes could be caught by a Biome rule — if yes, add to biome.json and biome-rationale.md
- Before touching shared code, query the code graph (`analyze_code_relationships`) to understand blast radius
- Create `.cgcignore` in new projects to exclude build artifacts from graph indexing
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
- Local init mode: `.indusk/` as home directory, `config.json` as project profile, `--local` flag for team repos — see `.indusk/planning/local-init-mode/adr.md`
- OTel gate is role-aware via `otel.role` in `.indusk/config.json` (Phase 5.25 of graphiti-infrastructure). Unset/`service` = gate fires (default). `library`/`tool`/`none` = gate silenced. The planner skill stops writing OTel sections, and both gate-enforcement hooks honor the same rule. Backwards compatible: projects without the field behave exactly as before. indusk-mcp itself is `library`.

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
- OTel gate is conditional on `otel.role` in `.indusk/config.json`. Set to `"library"` / `"tool"` / `"none"` to silence the gate. Unset (or `"service"`) keeps the gate firing. infinitedusky and apps/indusk-mcp both have `otel.role: library` — do NOT add `#### Phase N OTel` sections to plans in this repo. The `validate-impl-structure` and `check-gates` hooks read `.indusk/config.json` directly via inlined helpers (they can't import the TS one).
- Skills in `.claude/skills/` are package-owned — edit in `apps/indusk-mcp/skills/`, then run `update` to sync. Don't edit `.claude/skills/` directly.
- Domain skills directory (`skills/domain/`) removed — domain skills are now extensions. Use `extensions enable nextjs` not `init --skills nextjs`.
- OTel auto-instrumentation must be loaded before any other imports — use `node --import ./instrumentation.ts` or the Next.js instrumentation hook
- CGC graphs use `cgc-` prefix: `cgc-infinitedusky`, `cgc-numero`, etc. Graphiti semantic graphs use bare project names. Don't confuse them in FalkorDB.
- CGC connects to `localhost:6379` via the `indusk-infra` container (not the old standalone `falkordb` container on `falkordb.orb.local`). If CGC tools fail, check `docker ps --filter name=indusk-infra`.
- FalkorDB and Graphiti run in a single bundled container (`indusk-infra`), not as separate containers. Use `docker/test-infra.sh` to smoke test. Port 8000 is taken by OrbStack — Graphiti uses 8100.
- `GOOGLE_API_KEY` is required for Graphiti (Gemini LLM/embeddings). Without it, FalkorDB still works but Graphiti retries indefinitely. Store in `~/.indusk/config.env` (global, not per-project).
- Graphiti source at `~/.graphiti/` has a reranker patch — this is now baked into `docker/patches/graphiti-reranker.patch` and applied during image build.
- In local mode, `.git/info/exclude` manages ignores — if you re-clone, re-run `indusk init --local`. The exclude file is per-clone, not committed.
- In local mode, run `indusk pr-clean` before PRs to strip InDusk settings from `.claude/settings.json`. Run `indusk pr-restore` after.

## Current State

Repo scaffolded and building. InDusk Portfolio runs in Docker via composable.env. `indusk-infra` container bundles FalkorDB + Graphiti (replaces standalone FalkorDB). CGC indexing the project. Biome configured with VS Code integration. OTel extension active — every project scaffolded by `init` gets instrumentation by default. **OTel gate is conditional on `otel.role` in `.indusk/config.json`** (Phase 5.25): fires by default, silenced for `library`/`tool`/`none`. infinitedusky/indusk-mcp itself is `otel.role: library` — phases here never have OTel sections. Local init mode (`--local`) available for using InDusk on team repos without touching committed files. `.indusk/config.json` serves as the central project profile.

**Active plans:**

| Plan | Stage | Next Step |
|------|-------|-----------|
| context-graph | brief (accepted) | Phase 0 complete, Phase 1 in progress |
| graphiti-infrastructure | impl (in-progress) | Phase 1 complete, Phase 2: `indusk infra` CLI |
| react-native-support | brief (accepted) | Write ADR |
| mcp-dashboard | research (complete) | Write brief (lower priority) |
| agent-skills-format | brief (draft) | Sandy reviews brief |
