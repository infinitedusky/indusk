---
title: "MCP Dev System — Packaged Development System"
date: 2026-03-20
status: accepted
---

# MCP Dev System — Brief

## Problem

The dev system (plan/work/verify/context/document/retrospective skills, Biome quality config, CodeGraphContext integration) works well in this repo but is locked to it. Other projects can't adopt it. The skills also feel disjointed — each is a standalone markdown file that references the others by name, but nothing enforces they work together or share state. There's no structured way to query plan status, enforce phase completion order, or manage cross-plan dependencies.

## Proposed Direction

Build an npm package (`@infinitedusky/dev-system`) that serves as both a CLI installer and an MCP server (Approach D from research).

**CLI mode** — one-time setup and updates:
- `init` — copies skills to `.claude/skills/`, creates CLAUDE.md structure, sets up `.mcp.json`, creates `planning/` directory, generates `.vscode/settings.json` with Biome config
- `update` — refreshes skill files from package without touching project content (CLAUDE.md, plans, biome config)

**MCP server mode** — runtime tools that make skills cohesive:
- Plan management: `list_plans`, `get_plan_status`, `advance_plan`, `order_plans`
- Phase enforcement: validate that implement → verify → context → document order is followed before advancing
- Quality tools: `get_quality_config`, `suggest_rule`, `quality_check` (from code-quality-system design)
- Context tools: `get_context`, `update_context` (structured CLAUDE.md manipulation)
- Document tools: `list_docs`, `check_docs_coverage` (verify docs exist for completed plans)
- System tools: `get_system_version`, `get_skill_versions`

The MCP server reads the project's `planning/` directory and `CLAUDE.md` — it operates on the same files the skills reference. This shared state is what makes the system cohesive.

## Context

Research explored four distribution approaches. Hosted remote was ruled out (skills need local filesystem access). Pure MCP resources were ruled out (Claude Code reads skills from `.claude/skills/` natively). The hybrid approach — local skills + MCP server for tooling — fits both constraints. See `planning/mcp-dev-system/research.md`.

The existing `apps/indusk-mcp/` scaffold has `@modelcontextprotocol/sdk` installed and is wired for stdio transport.

## Scope

### In Scope
- MCP server with plan, quality, context, document, and system tools
- CLI for init and update
- `.vscode/settings.json` generation during init (Biome configured, ESLint disabled)
- Published as npm package
- Dogfooded in this repo first (the MCP server builds itself using the system it provides)

### Out of Scope
- Hosted/remote mode
- Multi-user or team features
- GUI or web dashboard
- Skill customization/override mechanism (v2 — track as open question)

## Success Criteria

- `npx @infinitedusky/dev-system init` sets up a fresh project with all skills, CLAUDE.md, `.vscode/settings.json`, and MCP config in under 30 seconds
- `list_plans` returns structured data for all plans with correct stages
- `advance_plan` refuses to advance if verification, context, or document items are incomplete
- `quality_check` returns structured Biome results the agent can reason about
- `update_context` modifies the correct CLAUDE.md section without breaking the 6-section structure
- A new Claude Code session can query plan status and project state via MCP tools instead of parsing markdown

## Depends On

- `planning/context-skill/` (completed)
- `planning/verify-skill/` (completed)
- `planning/code-quality-system/` (completed)
- `planning/codegraph-context/` (completed)
- `planning/document-skill/` (completed)

## Blocks

Nothing currently — this is the capstone.
