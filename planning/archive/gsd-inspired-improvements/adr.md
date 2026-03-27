---
title: "GSD-Inspired Improvements"
date: 2026-03-21
status: accepted
---

# GSD-Inspired Improvements

## Y-Statement

In the context of **a dev system that has complete process skills but lacks experiential knowledge capture, automatic verification, forward intelligence, blocker handling, workflow flexibility, and domain expertise**,
facing **agents that repeat mistakes, require manual verification setup, treat all work the same regardless of complexity, and have no domain-specific guidance**,
we decided for **7 improvements adapted from GSD-2: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, and domain skills registry**
and against **building a full autonomous orchestration layer like GSD-2, or adopting their SQLite-backed state machine and skill router pattern**,
to achieve **an agent that learns across projects, discovers its own verification commands, warns about fragile areas, halts on blockers, scales ceremony to task size, and has domain expertise for the project's stack**,
accepting **more files in .claude/ (lessons, domain skills) and more complexity in init's detection logic**,
because **these patterns are proven in GSD-2's production use and all fit our MCP + markdown skills architecture without requiring a rewrite**.

## Context

GSD-2 is a 56K+ line autonomous coding agent. We analyzed it and identified 10 patterns we lack. The brief narrowed to 7 based on effort-to-value ratio. See `planning/gsd-inspired-improvements/research.md` for the full analysis and `brief.md` for the selection rationale.

Our system augments Claude Code via MCP and markdown skills. GSD-2 replaces the agent entirely. The patterns we're adopting are the ones that translate to our architecture.

## Decision

### 1. Lessons Registry

Two layers in `.claude/lessons/`:

**Community lessons** — ship in the package under `lessons/community/`. Named with a `community-` prefix. Installed by `init`, synced by `update`. Examples:
- `community-no-fallback-values.md` — "Never use fallback values where a value is expected — it hides errors"
- `community-check-existing-packages.md` — "Search for official packages before building custom"
- `community-no-mock-databases.md` — "Don't mock the database in integration tests"
- `community-explicit-errors.md` — "Let errors propagate visibly — silent catches create mystery bugs"

**Personal lessons** — created by the dev, no prefix convention required. `update` never touches files without the `community-` prefix. Committed to git so team members benefit.

**Agent reads all lessons** at session start via the toolbelt skill. The retrospective skill prompts "any lessons worth capturing?" and can create a new lesson file.

### 2. Verification Auto-Discovery

The verify skill and `quality_check` MCP tool detect available checks from the project:

1. Read `package.json` scripts for known patterns: `typecheck`, `type-check`, `tsc`, `lint`, `test`, `build`, `check`
2. Detect common tool configs: `biome.json` → `biome check`, `tsconfig.json` → `tsc --noEmit`, `vitest.config.*` → `vitest run`
3. Impl docs can still specify explicit verification commands — these override auto-detected ones
4. `quality_check` MCP tool gains a `discover` mode that returns detected commands without running them

### 3. Forward Intelligence

The context skill adds a `## Forward Intelligence` section to context updates between phases:

```markdown
#### Phase N Forward Intelligence
- **Fragile**: {file/module that was tricky, why}
- **Watch out**: {downstream risk for next phase}
- **Assumption**: {thing that's true now but might not be later}
```

Written at the end of each phase. The work skill reads it before starting the next phase.

### 4. Blocker Protocol

Impl docs support a blocker field per phase:

```markdown
### Phase 3: API Integration
blocker: The upstream API doesn't support batch requests — Phase 3 scope needs revision

- [ ] Implement batch endpoint
```

The work skill checks for `blocker:` lines before starting a phase. If found, it stops and presents the blocker to the user. `advance_plan` also checks for unresolved blockers.

### 5. Workflow Templates

The plan skill recognizes a workflow type as the second argument:

- `/plan bugfix auth-token-expiry` → creates `brief.md` + `impl.md` only, no research/ADR
- `/plan refactor extract-auth-middleware` → creates `brief.md` + `impl.md` with boundary map section
- `/plan spike redis-pubsub` → creates `research.md` only
- `/plan feature payment-flow` → full lifecycle (current default, also the default when no type specified)

Templates live in the package under `templates/workflows/`. Each is a pre-filled markdown structure.

### 6. Boundary Maps

Impl docs for multi-phase work include a `## Boundary Map` section:

```markdown
## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `PlanParser` class, `PlanStatus` type | `planning/` directory structure |
| Phase 2 | `list_plans` MCP tool | `PlanParser` from Phase 1 |
| Phase 3 | Unit tests | All parsers from Phase 1 |
```

The plan skill includes this section in impl templates. The work skill references it before starting each phase to understand inputs/outputs.

### 7. Domain Skills Registry

**Detection** — `init` reads package.json and scans file patterns:

| Signal | Domain Skill |
|--------|-------------|
| `next` in dependencies | `nextjs` |
| `tailwindcss` in dependencies | `tailwind` |
| `react` in dependencies | `react` |
| `.sol` files present | `solidity` |
| `typescript` in devDependencies | `typescript` |
| `vitest` or `jest` in devDependencies | `testing` |
| `Dockerfile` present | `docker` |
| `vitepress` in dependencies | `vitepress` |

**Structure** — domain skills live in `skills/domain/` in the package. Installed to `.claude/skills/{name}/SKILL.md` alongside process skills.

**Manual override** — `init --skills nextjs,tailwind` forces specific domain skills. `init --no-domain-skills` skips detection entirely.

**Content** — each domain skill provides:
- Best practices and anti-patterns for that technology
- Common gotchas the agent should watch for
- Patterns to prefer and patterns to avoid
- References to official docs (via Context7 when available)

**Growth** — start with 8 domain skills. Add more over time. Community contributions welcome.

## Alternatives Considered

### Full GSD-2 adoption
Rejected — GSD-2 replaces the agent entirely. We augment Claude Code. Different architecture, different trade-offs.

### SQLite-backed state
Rejected — markdown files are more debuggable, diffable, and git-friendly. The overhead of SQLite doesn't pay off at our scale.

### Skill router pattern (subdirectories)
Rejected for now — high restructure effort. Domain skills work fine as flat .md files. Can revisit if skills grow complex enough to need workflows/ and references/ subdirectories.

### Lessons as a CLAUDE.md section
Rejected — CLAUDE.md is curated project memory with a fixed structure. Lessons are cross-project, append-friendly, and belong in their own directory where `update` can manage community vs personal.

## Consequences

### Positive
- Agent carries lessons across projects and sessions
- Verification happens automatically — less manual impl doc maintenance
- Forward intelligence prevents "stepping on landmines" between phases
- Blockers are formalized — no silent plan invalidation
- Ceremony scales to task size — bugfixes don't need ADRs
- Domain expertise makes the agent immediately useful for a project's stack
- Boundary maps make integration points explicit

### Negative
- More files in `.claude/` (lessons + domain skills)
- `init` detection logic adds complexity
- Community lessons need curation to stay high-quality
- Workflow templates may not cover every work type

### Risks
- **Lesson bloat** — Mitigate by keeping community lessons small and focused (one lesson per file, 2-5 sentences each)
- **Detection false positives** — Mitigate with `--no-domain-skills` and `--skills` manual override
- **Stale domain skills** — Mitigate by versioning via `update`, same as process skills

## References
- `planning/gsd-inspired-improvements/research.md`
- `planning/gsd-inspired-improvements/brief.md`
- GSD-2: https://github.com/gsd-build/gsd-2
