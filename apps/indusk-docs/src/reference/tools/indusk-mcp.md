# InDusk MCP Server

The InDusk MCP server (`indusk-mcp`) provides 20 tools across 7 categories that make the skill system cohesive. Skills are markdown instructions the agent reads; MCP tools are structured APIs the agent calls.

## Setup

The server is configured in `.mcp.json`. For local development (dogfooding):

```json
{
  "indusk": {
    "command": "node",
    "args": ["apps/indusk-mcp/dist/bin/cli.js", "serve"],
    "env": { "PROJECT_ROOT": "." }
  }
}
```

For projects using the published package:

```json
{
  "indusk": {
    "command": "npx",
    "args": ["indusk-mcp", "serve"],
    "env": { "PROJECT_ROOT": "." }
  }
}
```

## CLI Commands

| Command | Purpose |
|---------|---------|
| `init [options]` | Set up a project: installs skills, CLAUDE.md, biome.json, .mcp.json, hooks, lessons, domain skills |
| `update` | Refresh skills, lessons, domain skills, and hooks from package (compares content hashes) |
| `check-gates [options]` | Validate plan execution gates (verification, context, document items) |
| `serve` | Start the MCP server (called by `.mcp.json`, not run manually) |

### Init Options

| Flag | Effect |
|------|--------|
| `-f, --force` | Overwrite existing files (except CLAUDE.md and planning/) |
| `--skills <list>` | Comma-separated domain skills to install manually |
| `--no-domain-skills` | Skip auto-detection and installation of domain skills |
| `--no-index` | Skip code graph indexing |

### Check-Gates Options

| Flag | Effect |
|------|--------|
| `--file <path>` | Check a specific impl.md file |
| `--phase <number>` | Check a specific phase only |

## Tools

### Plan Management

| Tool | Input | Description |
|------|-------|-------------|
| `list_plans` | — | All plans with stage, status, next step, and dependencies |
| `get_plan_status` | `name` | Detailed status: phase progress, checked/unchecked items per gate |
| `advance_plan` | `name` | Validates prerequisites for the next transition. Returns `{ allowed, missing }` |
| `order_plans` | — | Topological sort of plans based on dependency graph |

#### Phase Enforcement (`advance_plan`)

| Transition | Requirement |
|------------|-------------|
| brief → adr | Brief status = `accepted` |
| adr → impl | ADR status = `accepted` |
| phase N → phase N+1 | All implementation, verification, context, and document items checked |
| impl → retrospective | All phases complete, impl status = `completed` |

### Context Management

| Tool | Input | Description |
|------|-------|-------------|
| `get_context` | — | CLAUDE.md parsed into 6 sections with validation status |
| `update_context` | `section`, `content` | Update one section. Validates structure before and after. |

The 6 canonical sections: What This Is, Architecture, Conventions, Key Decisions, Known Gotchas, Current State.

### Quality Tools

| Tool | Input | Description |
|------|-------|-------------|
| `get_quality_config` | — | Returns biome.json + biome-rationale.md as structured data |
| `suggest_rule` | `description` | Searches Biome rule catalog for rules matching a mistake description |
| `quality_check` | `mode`, `command` | Discovers or runs verification commands. Mode `discover` lists available checks; mode `run` (default) executes them. Optional custom `command`. See [Biome](/reference/tools/biome) and [Verify](/reference/skills/verify). |

### Document Tools

| Tool | Input | Description |
|------|-------|-------------|
| `list_docs` | — | All markdown files in the VitePress docs directory |
| `check_docs_coverage` | — | Compares completed plans to existing decision pages, flags gaps |

### System Tools

| Tool | Input | Description |
|------|-------|-------------|
| `get_system_version` | — | Package name and version |
| `get_skill_versions` | — | Compares installed skills to package skills: current, outdated, or missing |
| `check_health` | — | Checks FalkorDB connectivity, CGC installation, Docker container status |
| `list_domain_skills` | — | Lists available domain skills and their installation status |

### Lesson Tools

| Tool | Input | Description |
|------|-------|-------------|
| `list_lessons` | — | Lists all lessons (community + personal) from `.claude/lessons/`. Read at session start. |
| `add_lesson` | `name`, `title`, `content` | Creates a new personal lesson file. Use after [retrospectives](/reference/skills/retrospective) or when discovering a non-obvious pattern. |

### Graph Tools

| Tool | Input | Description |
|------|-------|-------------|
| `index_project` | — | Indexes the codebase into the code graph via CGC. Run after init or significant changes. |
| `query_dependencies` | `target`, `direction` | Queries what depends on a file/module (`dependents`), what it depends on (`dependencies`), or `both`. See [CodeGraphContext](/reference/tools/codegraph). |
| `query_graph` | `cypher` | Runs a custom Cypher query against the code graph for advanced structural analysis. |

## Hooks

Two Claude Code hooks enforce the gate system during [work](/reference/skills/work) execution:

| Hook | Event | Purpose |
|------|-------|---------|
| `check-gates.js` | PreToolUse | Blocks marking Phase N+1 implementation items until Phase N gates (verification, context, document) are complete. Exits with code 2 to block the action. |
| `gate-reminder.js` | PostToolUse | Reminds the agent to call `advance_plan` when all items in a phase are checked. Advisory only, does not block. |

Hooks are installed to `.claude/hooks/` during `init` and updated via `update`.

## Lessons Registry

The system ships 8 community lessons installed to `.claude/lessons/`:

| Lesson | Rule |
|--------|------|
| `check-existing-packages` | Search for official packages before building custom |
| `explicit-errors` | Return explicit errors, not silent failures |
| `index-after-setup` | Always re-index after infrastructure changes |
| `no-fallback-values` | No hidden fallback defaults; fail fast |
| `no-mock-databases` | Use real databases for integration tests |
| `one-concern-per-change` | Each commit has one purpose |
| `read-before-edit` | Read the code before editing |
| `verify-before-commit` | Run checks before committing |

Personal lessons are created during [retrospectives](/reference/skills/retrospective) via `add_lesson`.

## Domain Skills

Domain skills provide technology-specific guidance and are auto-detected during `init` based on dependencies and file patterns:

| Skill | Detected From |
|-------|---------------|
| `nextjs` | `next` in dependencies |
| `react` | `react` in dependencies |
| `tailwind` | `tailwindcss` in dependencies |
| `typescript` | `typescript` in devDependencies |
| `testing` | `vitest` or `jest` in devDependencies |
| `vitepress` | `vitepress` in dependencies |
| `docker` | `Dockerfile*` in project root |
| `solidity` | `*.sol` files in project |

Install manually with `indusk init --skills nextjs,docker` or skip with `--no-domain-skills`.

## Workflow Templates

Four planning workflow templates determine which documents are created:

| Workflow | Documents | Use Case |
|----------|-----------|----------|
| `feature` | research → brief → ADR → impl → retrospective | New functionality (default) |
| `bugfix` | brief → impl | Known issue with clear fix |
| `refactor` | brief → impl (with boundary map) | Structural changes |
| `spike` | research only | Exploration, no deliverable |

See [Plan](/reference/skills/plan) for full details on each workflow.

## Architecture

<FullscreenDiagram>

```mermaid
flowchart TD
    subgraph CLI["CLI (init / update / check-gates)"]
        init["init"]
        update["update"]
        gates["check-gates"]
    end

    subgraph MCP["MCP Server (20 tools)"]
        plan["Plan Tools (4)"]
        ctx["Context Tools (2)"]
        qual["Quality Tools (3)"]
        doc["Document Tools (2)"]
        sys["System Tools (4)"]
        lesson["Lesson Tools (2)"]
        graph["Graph Tools (3)"]
    end

    subgraph Hooks["Claude Code Hooks"]
        checkHook["check-gates.js (PreToolUse)"]
        reminderHook["gate-reminder.js (PostToolUse)"]
    end

    subgraph Lib["Core Libraries"]
        pp["plan-parser"]
        cp["context-parser"]
        ip["impl-parser"]
        vd["verification-discovery"]
    end

    subgraph FS["Project Files"]
        skills[".claude/skills/"]
        claude["CLAUDE.md"]
        planning["planning/"]
        biome["biome.json"]
        docs["apps/indusk-docs/"]
        lessons[".claude/lessons/"]
    end

    subgraph External["External Services"]
        falkor["FalkorDB"]
        cgc["CGC"]
    end

    init --> skills
    init --> claude
    init --> biome
    init --> lessons
    update --> skills
    update --> lessons
    gates --> ip

    plan --> pp
    plan --> ip
    plan --> planning
    ctx --> cp
    ctx --> claude
    qual --> biome
    qual --> vd
    doc --> docs
    doc --> pp
    lesson --> lessons
    graph --> cgc
    cgc --> falkor

    checkHook --> ip
    reminderHook --> ip

    pp --> planning
    cp --> claude
    ip --> planning
```

</FullscreenDiagram>

## Ownership

Skills are owned by the package at `apps/indusk-mcp/skills/`. When editing a skill, edit the source there and run `update` to sync to `.claude/skills/`. Never edit `.claude/skills/` directly — changes will be overwritten on the next update.
