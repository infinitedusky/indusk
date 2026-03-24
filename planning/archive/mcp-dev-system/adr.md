---
title: "MCP Dev System — Packaged Development System"
date: 2026-03-20
status: accepted
---

# MCP Dev System — Packaged Development System

## Y-Statement

In the context of **distributing a multi-skill development system (plan/work/verify/context/document/retrospective) to any project**,
facing **skills that work individually but lack shared state, enforcement, and cohesion across the lifecycle**,
we decided for **a hybrid npm package that installs skills locally AND runs an MCP server for runtime tooling (Approach D)**
and against **a hosted remote server (can't access local files), pure MCP resources (Claude Code needs local skills), or CLI-only distribution (no runtime cohesion)**,
to achieve **a development system any project can adopt in under 30 seconds with cohesive lifecycle enforcement via MCP tools**,
accepting **the complexity of maintaining two modes (CLI installer + MCP server) in one package and a clear system/project boundary**,
because **skills need to be local for Claude Code to read at session start, but runtime tools need shared state to enforce the lifecycle across skills**.

## Context

The dev system has seven skills (plan, work, verify, context, document, retrospective, composable-env) and integrations with Biome, CodeGraphContext, and VitePress. These work well in the infinitedusky repo but can't be adopted by other projects. The skills reference each other by convention but nothing enforces cohesion — the MCP server provides that enforcement layer.

Research evaluated four distribution approaches (see `planning/mcp-dev-system/research.md`). The hybrid approach (Approach D) was chosen because it satisfies both constraints: local skills for Claude Code and runtime tools for cohesion.

## Decision

### Package Structure

Published as `@infinitedusky/dev-system` on npm. Built from `apps/indusk-mcp/`.

```
@infinitedusky/dev-system
├── bin/
│   └── cli.ts              # CLI entry: init, update
├── server/
│   └── index.ts            # MCP server entry: serve
├── skills/                  # Skill files (copied during init)
│   ├── plan/SKILL.md
│   ├── work/SKILL.md
│   ├── verify/SKILL.md
│   ├── context/SKILL.md
│   ├── document/SKILL.md
│   └── retrospective/SKILL.md
├── templates/
│   ├── CLAUDE.md            # Initial CLAUDE.md structure
│   ├── biome.json           # Base Biome config
│   └── vscode-settings.json # VS Code settings (Biome, no ESLint)
└── tools/                   # MCP tool implementations
    ├── plan-tools.ts        # list_plans, get_plan_status, advance_plan, order_plans
    ├── context-tools.ts     # get_context, update_context
    ├── quality-tools.ts     # get_quality_config, suggest_rule, quality_check
    ├── document-tools.ts    # list_docs, check_docs_coverage
    └── system-tools.ts      # get_system_version, get_skill_versions
```

### CLI Mode

**`npx @infinitedusky/dev-system init`**
1. Copy skills to `.claude/skills/`
2. Create `CLAUDE.md` with the 6-section structure (empty sections with placeholders)
3. Create `planning/` directory
4. Add MCP server config to `.mcp.json`
5. Generate `.vscode/settings.json` (Biome as formatter, ESLint disabled)
6. Create base `biome.json` if none exists
7. Print setup summary

**`npx @infinitedusky/dev-system update`**
1. Read installed skill versions (from frontmatter or a manifest)
2. Compare to package versions
3. Replace skill files that are outdated
4. Never touch: CLAUDE.md, planning/, biome.json project overrides, .mcp.json (except dev-system entry)
5. Print what was updated

### MCP Server Mode

Launched by Claude Code via `.mcp.json`:
```json
{
  "mcpServers": {
    "indusk": {
      "command": "npx",
      "args": ["@infinitedusky/dev-system", "serve"],
      "env": {
        "PROJECT_ROOT": "."
      }
    }
  }
}
```

Uses stdio transport. Reads `PROJECT_ROOT` to find `planning/`, `CLAUDE.md`, `biome.json`, and `apps/`.

### MCP Tool Surface

**Plan management:**
| Tool | Purpose |
|------|---------|
| `list_plans` | List all plans with current stage (parsed from frontmatter) |
| `get_plan_status` | Detailed status: phase progress, blocked items, dependencies |
| `advance_plan` | Move plan to next stage; validates prerequisites (e.g., all verification/context/document items checked) |
| `order_plans` | Set/get execution order and dependencies between plans |

**Context management:**
| Tool | Purpose |
|------|---------|
| `get_context` | Read CLAUDE.md parsed into the 6 sections as structured data |
| `update_context` | Update a specific section; validates structure isn't broken |

**Quality tools:**
| Tool | Purpose |
|------|---------|
| `get_quality_config` | Return biome.json + biome-rationale.md as structured data |
| `suggest_rule` | Given a mistake description, suggest matching Biome rules |
| `quality_check` | Run `biome check` and return structured results (not raw CLI output) |

**Document tools:**
| Tool | Purpose |
|------|---------|
| `list_docs` | List all docs pages in the VitePress site |
| `check_docs_coverage` | Compare completed plans to existing decision/lesson pages; flag gaps |

**System tools:**
| Tool | Purpose |
|------|---------|
| `get_system_version` | Return package version |
| `get_skill_versions` | Return installed vs available versions for each skill |

### System vs Project Boundary

**System (owned by package, replaced on update):**
- Skill files (`.claude/skills/{name}/SKILL.md`)
- MCP server code
- Base templates

**Project (owned by user, never overwritten):**
- `CLAUDE.md` content
- `planning/` directory and all plan documents
- `biome.json` (project may extend the base)
- `biome-rationale.md`
- `.mcp.json` (only the `indusk` entry is managed)
- `apps/` and all project code
- VitePress docs content

The update command replaces system files only. It never touches project files.

### Phase Enforcement

The `advance_plan` tool is the enforcement mechanism. Before advancing a plan to the next stage, it checks:

- **Brief → ADR**: Brief status must be `accepted`
- **ADR → Impl**: ADR status must be `accepted`, Key Decisions updated in CLAUDE.md
- **Phase N → Phase N+1**: All implementation, verification, context, and document items in Phase N must be checked (`[x]`)
- **Impl → Retrospective**: All phases complete, impl status is `completed`

This is advisory — the agent can override with user approval, but the tool surfaces what's missing.

## Alternatives Considered

### Hosted Remote Server (Approach A)
Skills need local filesystem access for CLAUDE.md, planning/, tests. A remote server can't run `pnpm test` or edit local files. Fundamentally wrong for this use case.

### Pure MCP Resources (Approach C)
Claude Code reads skills from `.claude/skills/` at session start. MCP resources aren't loaded as skill instructions automatically. The agent would need to call a tool every session to get skill content — too much friction.

### CLI Only (Approach B without MCP server)
Works for distribution but provides no runtime cohesion. Skills remain disjointed — no shared state, no enforcement, no structured queries against project state.

## Consequences

### Positive
- Any project can adopt the full system in one command
- Skills stay local (Claude Code compatible) while MCP adds cohesion
- Version tracking via npm — `pnpm update` gets improvements
- Clear system/project boundary prevents update conflicts
- Phase enforcement makes the lifecycle self-policing

### Negative
- Two modes (CLI + MCP server) add package complexity
- Skill files live in two places (package source + project copy)
- Projects that modify skills locally lose changes on update

### Risks
- **Skill divergence** — projects modify skills, updates overwrite changes. Mitigation: clear docs that skills are system files; customization is via CLAUDE.md conventions, not skill edits. V2 could add a local override mechanism.
- **MCP server scope creep** — temptation to put too much logic in tools vs skills. Mitigation: tools provide data and enforce rules; skills provide instructions. Tools don't replace skills.
- **npm publish workflow** — need CI/CD for reliable publishing. Mitigation: start with manual publish, automate later.

## References

- `planning/mcp-dev-system/research.md` — distribution approach analysis
- `planning/mcp-dev-system/brief.md` — accepted brief
- `planning/code-quality-system/mcp-tools-design.md` — quality tool specifications
- `planning/document-skill/adr.md` — document/retrospective skill decisions
- MCP TypeScript SDK: `@modelcontextprotocol/sdk`
