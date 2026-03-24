---
title: "Code Quality System — Global + Project-Level Enforcement"
date: 2026-03-19
status: accepted
---

# Code Quality System — Brief

## Problem

The current development system has a memory layer (CLAUDE.md/context skill) and a verification layer (verify skill). But there's a gap between "the agent knows the rules" and "the rules are enforced." CLAUDE.md is advisory — the agent can read it and still produce code that violates conventions. Retrospectives capture lessons, but those lessons live as text that has to be re-read and re-interpreted every session.

Meanwhile, every project starts with a blank slate on code quality. If you learn in project A that barrel exports cause circular dependency hell, that insight protects project A (via its CLAUDE.md) but doesn't protect project B at all.

What's missing is a **codified quality floor** that improves over time, spans all projects, and is enforced automatically — not just remembered.

## Proposed Direction

Install and configure Biome as the single tool for linting and formatting, configured at two levels:

### Level 1: Global Base Config

A `biome.json` that lives in the canonical skills/config repo (infinitedusky today, eventually installable into any project). This represents everything you've learned across all projects — your universal code quality standards. It starts with Biome's recommended defaults and gets tighter over time as retrospectives surface patterns.

This config encodes hard lessons:
- Agent kept using `any` types → enable `noExplicitAny`
- Agent kept leaving unused imports → enable `noUnusedImports`
- Agent kept writing inconsistent formatting → Biome handles this by default, no config needed
- Agent kept using `console.log` in production code → enable `noConsole` (with `allow: ["warn", "error"]`)

The global config is the "quality ratchet" — it only gets tighter, never looser. Each retrospective is an opportunity to ask: "could this mistake have been caught automatically?" If yes, add the rule.

### Level 2: Project-Level Overrides

Each project can extend the global config with an `overrides` section in its own `biome.json`. This handles project-specific needs:
- A Next.js project might adjust rules for JSX/React patterns
- A CLI tool might allow `console.log`
- A test directory might relax rules that don't apply to test code

The project-level config uses Biome's `extends` field to inherit the global base, so projects always get the latest global rules plus their own overrides.

### The Retrospective → Enforcement Loop

This is where the code quality system connects to the rest of the skill ecosystem:

```
work (executes impl)
  → verify (runs biome check, tests, types)
    → if mistakes get past verify and are caught in review or production
      → retrospective captures the lesson
        → context updates CLAUDE.md (soft memory)
        → code-quality updates biome.json (hard enforcement)
          → verify now catches it automatically next time
```

Three levels of defense, each catching what the previous layer missed:
1. **Context/CLAUDE.md** — "don't do this" (advisory, agent reads at session start)
2. **Biome rules** — "you can't do this" (enforced, verify blocks on violation)
3. **Retrospective** — "we did this wrong, here's how we prevent it" (feeds back into 1 and 2)

### Integration with the MCP Server

The MCP server should expose the quality system as tools:

- **`get_quality_config`** — returns the current biome.json with annotations explaining why each non-default rule exists (what incident/retrospective prompted it)
- **`suggest_rule`** — given a mistake pattern, suggests a Biome rule that would catch it. Used during retrospectives.
- **`quality_check`** — runs `biome check` on specified files or the whole repo and returns structured results. This is what the verify skill calls.

This makes the quality system inspectable. An agent can ask "why is `noExplicitAny` enabled?" and get back "added after planning/auth-system retrospective — agent used `any` for JWT payload types, causing runtime type errors."

### The Annotated Config

The key innovation is that the `biome.json` isn't just a config file — it's a **knowledge artifact**. Each non-default rule has a companion entry in a `biome-rationale.md` file (or inline comments if Biome supports them) that links back to the retrospective or incident that prompted it.

```
// biome-rationale.md
## noExplicitAny (error)
Added: 2026-03-20
Source: planning/auth-system/retrospective.md
Reason: Agent typed JWT payload as `any`, causing silent runtime failures
when payload shape changed. Caught in production.

## noConsole (warn, allow: ["warn", "error"])
Added: 2026-03-22
Source: planning/api-logging/retrospective.md
Reason: Agent left debug console.logs in production API routes.
Structured logging via pino should be used instead.
```

This means the quality config tells a story. New projects that inherit it don't just get rules — they get the reasoning behind them.

### How Installation Works

This extends the existing skill installation mechanism:

```bash
# When setting up a new project (extends claude-skills init)
claude-skills init
# This already installs skills. Now it also:
# 1. Copies global biome.json to project root
# 2. Copies biome-rationale.md to project root
# 3. Adds @biomejs/biome to devDependencies
# 4. Adds "check" and "format" scripts to package.json

# When pulling updates (extends claude-skills update)
claude-skills update
# This already updates skills. Now it also:
# 1. Merges new global biome rules into project's biome.json
# 2. Preserves project-level overrides
# 3. Updates biome-rationale.md with new entries
```

## Scope

### In Scope
- Install and configure `@biomejs/biome` with recommended + learned rules
- Global `biome.json` as the quality floor
- `biome-rationale.md` linking each rule to its origin
- Project-level override pattern via Biome's `extends`
- MCP tools: `get_quality_config`, `suggest_rule`, `quality_check`
- Integration with verify skill (verify calls `biome check`)
- Integration with retrospective flow (retro can suggest new rules)
- Integration with `claude-skills init` and `claude-skills update`
- Add `check` and `format` scripts to package.json

### Out of Scope
- Custom Biome plugins (Biome doesn't support user plugins yet — just configuration)
- Type checking (that's TypeScript's job, invoked separately by verify)
- Test coverage enforcement (separate concern)
- CI/CD pipeline integration (that's the deploy skill's job)

## Success Criteria
- `biome check` runs in < 2 seconds on changed files
- Every non-default rule in biome.json has a corresponding entry in biome-rationale.md
- A new project inherits the full quality floor via `claude-skills init`
- After a retrospective identifies a preventable mistake, a new Biome rule is proposed within the same session
- Project-level overrides don't get clobbered by `claude-skills update`

## Depends On
- verify-skill (verify is the runner; code-quality provides the config) — completed
- context-skill (context captures the soft lessons; code-quality captures the hard ones) — completed

## Blocks
- Nothing — this is additive and can be built in parallel with verify and context
