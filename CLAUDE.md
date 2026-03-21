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
├── docker/                # Dockerfiles for local dev (Dockerfile.nextdev, etc.)
├── env/                   # composable.env: components, profiles, contracts
├── biome.json             # Biome config — quality ratchet, see biome-rationale.md for why each rule exists
├── biome-rationale.md     # Annotated rationale for each non-default Biome rule
├── vitest.config.ts       # Root Vitest config — workspace projects, apps inherit via extends: true
├── planning/              # Plans following the plan skill lifecycle
├── research/              # Standalone research docs
└── CLAUDE.md              # This file — living project memory
```

**Apps:**
- **indusk-portfolio**: Next.js 15 + Tailwind 4. Dark theme (zinc-950 bg, amber-400 accents). Runs in Docker via composable.env for local dev.
- **indusk-mcp**: InDusk MCP server — dev system tooling with 13 MCP tools (plan, context, quality, document, system). CLI for `init`/`update`. Skills are owned here in `skills/` and installed to `.claude/skills/` via init. Dogfooded in this repo via `.mcp.json`. Will be published as `indusk-mcp`.
- **indusk-docs**: VitePress 1.x documentation site with Mermaid diagrams and FullscreenDiagram component. Runs in Docker via composable.env. `pnpm turbo dev --filter=indusk-docs` for local dev.

**Skills:**

| Skill | Status | Purpose |
|-------|--------|---------|
| plan | stable | Structured planning lifecycle: research → brief → ADR → impl → retrospective |
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
- Skills are markdown files in `.claude/skills/{name}/SKILL.md`
- Plans follow the lifecycle: research → brief → ADR → impl → retrospective
- All planning docs live in `planning/{kebab-case-name}/`
- Every impl phase ends with four gates before advancing: verify → context → document → advance
- Plan gates are enforced via Claude Code hooks — the agent cannot skip verification/context/document items when advancing phases
- `.claude/hooks/` contains gate enforcement scripts installed by init (check-gates.js blocks, gate-reminder.js nudges)
- Three layers of defense: (1) Context/CLAUDE.md — advisory, (2) Biome rules — enforcement, (3) Hooks — gate enforcement, (4) Retrospective — learning. The quality ratchet only gets tighter.
- Use the plan skill before implementing significant features — don't jump to code
- `pnpm test` runs all tests, `pnpm turbo test --filter={app}` for scoped runs. Vitest configs use `passWithNoTests: true`
- Verification items in impl docs must be specific runnable commands with expected output — not "verify it works"
- `pnpm check` for lint/format check, `pnpm check:fix` to auto-fix, `pnpm format` for format-only
- After each retrospective, ask if mistakes could be caught by a Biome rule — if yes, add to biome.json and biome-rationale.md
- Before touching shared code, query the code graph (`analyze_code_relationships`) to understand blast radius
- Create `.cgcignore` in new projects to exclude build artifacts from graph indexing
- `npx indusk-mcp init` to set up a new project with skills, CLAUDE.md, biome, and MCP config

## Key Decisions

- Context skill is pure markdown instructions, not MCP tools — see `planning/context-skill/adr.md`
- CLAUDE.md has a fixed 6-section structure maintained by the context skill — see `planning/context-skill/adr.md`
- Biome over ESLint: single binary, no plugin config hell, fast enough for per-item verification
- Global + project-level Biome config: global is the quality floor across all projects, project-level extends with overrides
- InDusk MCP server will be published as an npm package for use across projects
- Vitest as committed test runner; adaptive first-connect setup detects existing tooling before installing — see `planning/verify-skill/adr.md`
- Biome config is a knowledge artifact with biome-rationale.md; quality ratchet only gets tighter — see `planning/code-quality-system/adr.md`
- CodeGraphContext with global FalkorDB + local CGC via pipx for structural code intelligence — see `planning/codegraph-context/adr.md`
- Document skill (per-phase execution gate) + retrospective skill (closing audit with knowledge handoff to VitePress docs) — see `planning/document-skill/adr.md`
- GSD-inspired: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, domain skills — see `planning/gsd-inspired-improvements/adr.md`
- Plan gate enforcement via Claude Code PreToolUse hooks — blocks phase transitions with incomplete gates — see `planning/enforce-plan-gates/adr.md`

## Known Gotchas

- Tailwind 4 requires Node 22 — build fails on Node 18 with "Cannot find native binding" error
- Always use `pnpm ce`, not `npx ce` — the skill doc specifies pnpm
- Always run `pnpm env:build` before `docker compose` — use the ce-generated scripts
- Don't jump to implementation without planning — use the plan skill lifecycle
- composable.env binary is `ce`, not `composable.env` — the package.json script should be `"ce": "ce"`
- Skill files are `SKILL.md` (all caps), not `skill.md`
- Vitest `passWithNoTests: true` must be set in each app's `vitest.config.ts`, not just root — `extends: true` doesn't inherit it when the app defines its own `test` block
- Biome 2.x API differs from docs/examples: `noVar` doesn't exist, `noUnusedVariables` has no `ignorePattern` option, overrides use `includes` not `include`. Always match schema version to installed version.
- Impl parser must handle all four gate types per phase: implementation, verification, context, document — not just three
- Skills in `.claude/skills/` are package-owned — edit in `apps/indusk-mcp/skills/`, then run `update` to sync. Don't edit `.claude/skills/` directly.

## Current State

Repo scaffolded and building. InDusk Portfolio runs in Docker via composable.env. FalkorDB running globally, CGC indexing the project. Biome configured with VS Code integration.

**Active plans:**

| Plan | Stage | Next Step |
|------|-------|-----------|
| context-skill | impl (completed) | Ready for retrospective |
| verify-skill | impl (completed) | Ready for retrospective |
| code-quality-system | impl (completed) | MCP tools designed, ready for retrospective |
| codegraph-context | impl (completed) | Ready for retrospective |
| mcp-dev-system | impl (completed) | Ready for retrospective |
| document-skill | impl (completed) | Ready for retrospective |
| gsd-inspired-improvements | impl (in-progress) | Publish v0.5.0 and dogfood |
| enforce-plan-gates | impl (in-progress) | Publish v0.6.0 and dogfood |
