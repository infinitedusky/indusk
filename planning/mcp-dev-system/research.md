---
title: "MCP Dev System — Distribution & Architecture"
date: 2026-03-20
status: complete
---

# MCP Dev System — Research

## Question

How should we package and distribute a development system (plan/work/verify/context/document skills + supporting MCP tools) so that any project can adopt it, get cohesive behavior across all skills, and receive updates when the system improves?

## Findings

### What we have today

The dev system currently consists of:

**Skills (markdown files in `.claude/skills/`):**
- `plan/SKILL.md` — structured planning lifecycle (research → brief → ADR → impl → retrospective)
- `work/SKILL.md` — execute impl checklists, per-phase completion (implement → verify → context)
- `verify/SKILL.md` — gate work with automated checks, shape impls to include progressive verification
- `context/SKILL.md` — maintain CLAUDE.md, shape impls to include per-phase context updates
- `composable-env/SKILL.md` — installed by `ce add-skill`, manages env config

**Planned skills:**
- `document` — VitePress docs as a per-phase gate

**Designed MCP tools (from code-quality-system plan):**
- `get_quality_config` — Biome config + rationale
- `suggest_rule` — match mistakes to Biome rules
- `quality_check` — structured Biome check results

**External MCP tools already in use:**
- CodeGraphContext — 19 structural analysis tools (find_code, analyze_code_relationships, etc.)

**Current MCP server (`apps/mcp/`):**
- Scaffolded but empty (`index.ts` has no content)
- Has `@modelcontextprotocol/sdk` as dependency
- Runs via stdio transport

### Distribution approaches

#### Approach A: Hosted remote MCP server

A server running on a VPS/cloud that projects connect to via HTTP/SSE transport.

**Pros:**
- Instant updates — change the server, all projects get it
- No installation per project
- Could serve skill files as MCP resources

**Cons:**
- Most skill work is local file manipulation (CLAUDE.md, planning/, running tests) — a remote server can't do this
- Latency on every tool call
- Auth complexity
- Doesn't work offline
- Skills as markdown need to be in the repo for Claude Code to read them at session start

**Verdict:** Fundamentally wrong for this use case. The skills need filesystem access and the instructions need to be local for Claude Code to read.

#### Approach B: npm package with CLI init

Publish as `@infinitedusky/dev-system` (or similar). Projects install it and run an init command that wires everything up.

```
pnpm add -D @infinitedusky/dev-system
npx dev-system init
```

Init would:
1. Copy skill files to `.claude/skills/`
2. Add MCP server config to `.mcp.json`
3. Create initial `CLAUDE.md` structure
4. Set up planning directory

**Pros:**
- Standard npm distribution — versioned, reproducible
- `pnpm update` pulls new versions
- Init is a one-time setup, skills live in the project
- MCP server runs locally via stdio (spawned by Claude Code)

**Cons:**
- Skills copied into the project diverge from the package over time
- Need an "update" command to refresh skills without losing project-specific customization
- Two things to manage: the package version AND the local skill files

#### Approach C: npm package as MCP server only (skills bundled as resources)

The package IS the MCP server. Skills are served as MCP resources that Claude Code reads. No file copying.

```json
// .mcp.json
{
  "mcpServers": {
    "dev-system": {
      "command": "npx",
      "args": ["@infinitedusky/dev-system"]
    }
  }
}
```

**Pros:**
- Single distribution mechanism — update the package, everything updates
- No file divergence — skills always come from the package
- Clean separation: package owns the system, project owns the content (plans, CLAUDE.md)

**Cons:**
- Claude Code reads skills from `.claude/skills/` at session start. MCP resources are not automatically loaded as skill instructions. The agent would need to call a tool to get the skill content, adding friction.
- The plan/work/verify/context skills are currently triggered via `/skill` invocations which require the files to exist locally

#### Approach D: npm package as MCP server + skill installer (hybrid)

The package is primarily an MCP server that also has an `init` and `update` CLI. Skills are installed locally (so Claude Code can read them natively) but the MCP server provides tools that complement the skills.

```bash
# One-time setup
pnpm add -D @infinitedusky/dev-system
npx dev-system init    # copies skills, sets up .mcp.json, creates CLAUDE.md

# Updates
npx dev-system update  # refreshes skill files from package, preserves project content
```

```json
// .mcp.json (set up by init)
{
  "mcpServers": {
    "dev-system": {
      "command": "npx",
      "args": ["@infinitedusky/dev-system", "serve"],
      "env": {
        "PROJECT_ROOT": "."
      }
    }
  }
}
```

**Pros:**
- Skills live locally → Claude Code reads them natively at session start
- MCP server adds tools that skills reference (plan management, quality checks, etc.)
- Update command refreshes skills without losing project content (CLAUDE.md, planning/)
- Version tracked — `package.json` shows which version is installed
- Single package, two modes: CLI for setup, MCP server for runtime

**Cons:**
- More complex than pure file copy
- Need to define clearly what's "system" (skills, managed by package) vs "project" (CLAUDE.md, plans, managed by user)

### What tools should the MCP server provide?

The skills define WHAT to do. The MCP tools make it easier to do it. Categorized by skill:

**Plan management:**
- `list_plans` — list all plans with their current stage
- `get_plan_status` — detailed status of a specific plan (which phase, what's blocked)
- `advance_plan` — move a plan to the next stage (validates prerequisites)
- `order_plans` — set execution order / dependencies between plans

**Context management:**
- `get_context` — read current CLAUDE.md parsed into sections
- `update_context` — update a specific section of CLAUDE.md (prevents structural drift)

**Quality tools (from code-quality-system design):**
- `get_quality_config` — Biome config + rationale
- `suggest_rule` — match mistakes to Biome rules
- `quality_check` — structured Biome check results

**Verification tools:**
- `run_checks` — execute the verify check order (type → lint → test → build) and return structured report
- `get_verification_report` — last verification report for a plan phase

**System tools:**
- `get_system_version` — current dev-system version
- `get_skill_versions` — which skills are installed and whether they're up to date
- `update_skills` — refresh skills from package (same as CLI update)

### Cohesion: How skills know about each other

The key problem you raised: the skills feel disjointed. Currently, each skill is a standalone markdown file. They reference each other by name ("the verify skill", "the context skill") but there's no enforcement that they work together.

The MCP server can be the glue:

1. **Shared state.** The MCP server reads the project's `planning/` directory and CLAUDE.md. All tools operate on the same state. When `advance_plan` moves a plan forward, it can check that verification passed and context was updated.

2. **Orchestration.** Instead of each skill independently knowing the per-phase order (implement → verify → context), the server enforces it. A tool like `complete_phase` would refuse to advance unless all three are done.

3. **Cross-skill awareness.** The `list_plans` tool knows about plan ordering and dependencies. When you start `/work` on Plan B, it can warn that Plan A (a dependency) isn't done yet.

4. **Single source of truth for project state.** Instead of the agent parsing markdown frontmatter to figure out plan statuses, it calls `list_plans` and gets structured data.

### The "system" vs "project" boundary

This distinction is critical for the update mechanism:

**System (owned by package, updated via `npx dev-system update`):**
- Skill files (`.claude/skills/{name}/SKILL.md`)
- MCP server code
- Biome base config (the quality floor)
- Templates (impl template, retro template, etc.)

**Project (owned by user, never overwritten):**
- `CLAUDE.md` (content is project-specific)
- `planning/` (all plan documents)
- `biome.json` (extends base but has project-specific rules)
- `biome-rationale.md` (project-specific rationale)
- `.mcp.json` (may have other servers configured)

The update command must never touch project files. It only replaces system files.

### Existing pattern: composable.env's `add-skill`

composable.env already solves a simpler version of this:
- `ce add-skill` copies a skill file into the project
- The skill file is self-contained markdown
- Updates require re-running `ce add-skill`

This could be the model: `dev-system init` is like `ce add-skill` but for the whole system.

## Open Questions

- Should the MCP server run as a separate process (stdio) or as a library that the project's own MCP server imports?
- How do we handle skill customization? If a project wants to modify the work skill's commit rules, does that get lost on update?
- Should plan ordering/dependencies be stored in a manifest file or inferred from brief frontmatter?
- Is `@infinitedusky/dev-system` the right package name, or should this be more generic (e.g., `@devloop/core`)?

## Sources

- MCP TypeScript SDK: `@modelcontextprotocol/sdk` v1.12.1 — `registerTool`, `StdioServerTransport`
- composable.env `add-skill` pattern — existing skill distribution mechanism
- Code quality MCP tools design: `planning/code-quality-system/mcp-tools-design.md`
- Current skill files: `.claude/skills/{plan,work,verify,context}/SKILL.md`
