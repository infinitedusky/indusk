---
title: "Convert Skills to Agent Skills Format"
date: 2026-04-01
status: draft
---

# Convert Skills to Agent Skills Format — Brief

## Problem
Our skills are tightly coupled to indusk-mcp's delivery mechanism — they're markdown files copied from the npm package via `init`. This means:
- Only Claude Code users with indusk-mcp can use them
- Other agent frameworks (Cursor, Windsurf, Aider, OpenClaw) can't benefit
- The skills aren't independently versioned or discoverable
- No standard way for the community to contribute or consume individual skills

The [Agent Skills](https://agentskills.io/) format is an emerging standard for distributing skills to AI coding agents. Skills are installed via `npx skills add {org}/{repo}` and follow a defined structure (frontmatter with name/description/metadata, rules in subdirectories). Dash0 already publishes their OTel skills this way.

## Proposed Direction
Convert all indusk-mcp skills to the Agent Skills format and publish them as an independent GitHub repo (`infinitedusky/agent-skills` or similar). This makes them installable by any agent framework while keeping them as the foundation of indusk-mcp.

### Structure
The repo follows the Agent Skills format. The top-level skill is `indusk` — the equivalent of our toolbelt. It's the entry point that describes what's available and when to use each skill:

```
infinitedusky/agent-skills/
├── skills/
│   ├── indusk/                    # Entry point — "here's the system, here's when to use each skill"
│   │   ├── SKILL.md              # Overview, skill map, session workflow
│   │   └── rules/
│   │       ├── session-start.md  # What to do when a session begins
│   │       ├── before-code.md    # Query graph, check blast radius
│   │       └── new-app.md        # How to create a new app (the toolbelt "Creating a New App" section)
│   ├── plan/                     # Planning lifecycle
│   │   ├── SKILL.md
│   │   └── rules/
│   ├── work/                     # Impl execution
│   │   ├── SKILL.md
│   │   └── rules/
│   ├── verify/                   # Verification gates
│   ├── context/                  # Living project memory
│   ├── document/                 # Documentation gates
│   ├── retrospective/            # Closing audit
│   ├── otel/                     # OpenTelemetry patterns
│   │   ├── SKILL.md
│   │   └── rules/
│   │       ├── spans.md
│   │       ├── logs.md
│   │       ├── categories.md
│   │       └── sensitive-data.md
│   ├── composable-env/           # Environment management
│   └── cgc/                      # Code graph
```

### What changes
- Skills follow the Agent Skills frontmatter format (name, description, license, metadata with author/version/workflow_type, trigger conditions)
- Complex skills split into a SKILL.md + rules/ subdirectory (like Dash0's approach)
- The toolbelt becomes the `indusk` entry point skill — the first thing any agent reads
- Published as a standalone GitHub repo installable via `npx skills add`
- indusk-mcp's `init` still installs them (pulls from the same source), but they're also independently consumable

### What stays the same
- The content — our plan/work/verify/context/document/retrospective skills
- The extension system — extensions still provide domain-specific skills (otel, cgc, dash0)
- The hook system — gate enforcement stays in indusk-mcp

## Scope

### In Scope
- Convert process skills (plan, work, verify, context, document, retrospective) to Agent Skills format
- Convert utility skills (catchup, handoff, toolbelt) to Agent Skills format
- Convert extension skills (otel, cgc, dash0, etc.) to Agent Skills format
- Create a standalone repo with the proper structure
- Ensure `init` and `update` can pull from the repo or the npm package
- Add metadata: author, version, license, workflow_type, trigger descriptions

### Out of Scope
- Changing skill content (that's a separate effort per skill)
- Building an Agent Skills registry or discovery service
- Modifying the Agent Skills specification itself
- Removing skills from the indusk-mcp npm package (dual distribution — both paths work)

## Key Questions
- Should process skills (plan, work, verify) be one combined skill or separate? The Agent Skills format supports both — a single skill with rules/ subdirectories, or individual skills.
- Should extension skills live in the same repo or stay with their extensions?
- How do we handle the hook scripts? They're not skills — they're enforcement. Keep them in indusk-mcp only?
- What's the versioning strategy? Semver per skill, or one version for the whole collection?

## Success Criteria
- All skills installable via `npx skills add infinitedusky/agent-skills`
- Skills work in Claude Code, Cursor, and at least one other agent framework
- indusk-mcp `init` still installs them (no regression)
- Skills have proper frontmatter with metadata, descriptions, and trigger conditions

## Depends On
- Nothing — can start anytime

## Blocks
- Community adoption of indusk skills outside of Claude Code
