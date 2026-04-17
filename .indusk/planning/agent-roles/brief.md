---
title: "Agent Roles — Define and Enforce Role Boundaries"
date: 2026-04-14
status: accepted
blocked_by: [improvement-eval-agent-open-telemetry, bug-fix-eval-agent]
---

# Agent Roles — Brief

## Problem

The InDusk system has two agents (working agent and eval agent) but their responsibilities were never formally defined. Roles have accumulated organically:

- The **working agent** writes code, follows plans, runs skills, AND writes to Graphiti (via planner/work/retro skills), AND updates CLAUDE.md context, AND manages its own memory
- The **eval agent** scores commits, writes findings to Graphiti, AND is planned to become the sole graph writer (graph-knowledge-architecture), AND is planned to index LSP structure (lsp-structural-indexing)

Nobody owns transcript indexing. Nobody owns triage. The working agent does things the eval agent should probably do (graph writes). The eval agent might be getting overloaded with responsibilities it can't handle well given its `claude --resume` execution model.

Before building transcript search, knowledge graph improvements, LSP indexing, or personas on top of this, we need to define who does what, audit what's currently misassigned, and refactor so each agent is doing its job properly.

## Proposed Direction

### 1. Define the roles

Formally define each agent's role, responsibilities, execution model, and boundaries. Current candidates:

**Working Agent** (the session you're talking to)
- Execution model: interactive Claude Code session, lives as long as the user is working
- Owns: code changes, plan execution, skill invocation, user interaction
- Reads: everything (code, graph, transcripts, context)
- Writes: code, plan documents, handoff

**Eval Agent** (fires on commit)
- Execution model: persistent via `claude --resume`, fires on `jj describe`
- Owns: quality assessment, knowledge capture, structural indexing
- Reads: transcript, diff, code graph, Graphiti
- Writes: eval scorecards, Graphiti episodes, findings

**Infrastructure** (not an agent — hooks, CLI, MCP tools)
- Owns: gate enforcement, index maintenance, health checks
- Examples: transcript indexing, FTS5 maintenance, CGC sync, graph rebuild

### 2. Audit current state

Map every write operation in the system to its current owner and decide if that's correct:

| What | Current Owner | Should Be |
|------|--------------|-----------|
| Graphiti episodes (brief/ADR acceptance) | Working agent (planner skill) | ? |
| Graphiti episodes (corrections) | Working agent (work skill) | ? |
| Graphiti episodes (retro lessons) | Working agent (retro skill) | ? |
| Eval scorecards | Eval agent | Eval agent |
| Eval findings → Graphiti | Eval agent | Eval agent |
| CLAUDE.md context updates | Working agent (context skill) | ? |
| Handoff | Working agent (handoff skill) | Working agent |
| Auto-memory | Working agent (Claude Code built-in) | Working agent |
| Semantic graph event log | Working agent (graph_capture) | ? |
| Transcript indexing | Nobody | ? |
| Triage/routing | Nobody | ? |

### 3. Refactor misassignments

Move responsibilities that are in the wrong place. This is the implementation work — updating skills, hooks, and agent prompts so each role owns exactly what it should.

### 4. Evaluate the eval agent's execution model

Is `claude --resume` sufficient for everything we're loading onto the eval agent? Options:
- **Status quo:** `claude --resume` on `jj describe`. Fires, works, stops. Good enough if the eval agent's job stays bounded.
- **Extended triggers:** eval agent also fires on other events (session end, periodic timer, file change). Still `claude --resume` but with more trigger points.
- **Persistent daemon:** always-on agent that watches for events. More like Hermes. Much more complex, probably overkill.
- **Separate agents per role:** instead of one eval agent doing quality + graph writes + LSP indexing, split into focused agents. More `claude --resume` sessions, each with a narrow job.

## Context

This plan was triggered by reviewing all open briefs and realizing that `hermes-inspired-improvements`, `graph-knowledge-architecture`, `lsp-structural-indexing`, and `complementary-personas` all add responsibilities to agents without a clear ownership model. Building on top of undefined roles means rework later.

Key input: graph-knowledge-architecture already proposes "eval agent becomes sole graph writer." That's a role decision. This plan formalizes it and extends the same thinking to all responsibilities.

## Scope

### In Scope
- Formal role definitions for working agent, eval agent, and infrastructure
- Audit of all current write operations and their ownership
- Refactor any misassigned responsibilities
- Decision on eval agent execution model (is `claude --resume` sufficient?)
- Updated skill/hook code to reflect correct ownership
- Documentation of roles in CLAUDE.md

### Out of Scope
- Building new capabilities (transcript search, LSP indexing, personas — those are separate plans)
- Changing the eval agent's scoring rubric (that's graph-knowledge-architecture)
- Adding new agents beyond working + eval (unless the audit reveals a need)

## Success Criteria
- Every write operation in the system has a clear, documented owner
- No agent is doing work that belongs to another agent
- The eval agent's execution model is validated against its planned responsibilities
- Other plans (hermes-inspired-improvements, graph-knowledge-architecture, etc.) can reference role definitions when assigning ownership

## Depends On
- Nothing — this is foundational

## Blocks
- `hermes-inspired-improvements` — needs to know who owns transcript indexing
- `graph-knowledge-architecture` — needs role definitions to formalize eval-as-sole-writer
- `lsp-structural-indexing` — needs to know if the eval agent can handle LSP queries
- `complementary-personas` — needs to know where persona agents fit in the role model
- `context-migration` — needs to know who owns context writes
