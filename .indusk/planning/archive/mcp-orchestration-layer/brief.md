---
title: "MCP Orchestration Layer"
date: 2026-04-15
status: draft
blocked_by: [agent-roles]
---

# MCP Orchestration Layer — Brief

## Problem

Claude Code's interaction with MCP servers is painful. Three concrete problems:

**1. Repeated failures from missing context.** Claude doesn't know the dataset name for Dash0, the group ID for Graphiti, the graph name for CGC. So it guesses. It tries `development`, gets nothing, tries `default`, gets nothing, tries `dev`. Three or four failed calls burning context window before it gets a result. Every session. This is maddening to watch.

**2. No compound operations.** Investigating a browser performance issue requires calling Chrome DevTools for a trace, Dash0 for backend spans, and correlating by trace ID. Claude has to orchestrate this manually — figure out which tools to call, in what order, with what arguments, and how to correlate the results. It does this poorly and verbosely.

**3. No observability.** We have no record of what MCP tools were called, what arguments were used, what came back, how long it took, or what failed. We can't analyze tool usage patterns, identify bottlenecks, or feed tool performance data into the knowledge graph.

## Proposed Direction

Build an **intent-based orchestration layer** in the InDusk MCP server that sits between Claude and external MCP servers.

### Intent Translation (Proxy Calls)

Claude expresses what it wants in natural terms. InDusk translates to correct syntax and fills in project-specific context from `.indusk/config.json`, composable.env, or extension config.

Example — today:
```
Claude -> dash0.getSpans({ dataset: "development", ... })  -> empty
Claude -> dash0.getSpans({ dataset: "default", ... })      -> empty  
Claude -> dash0.getSpans({ dataset: "dev", ... })          -> empty
Claude -> dash0.getSpans({ dataset: "dusk-dev", ... })     -> results!
```

With orchestration layer:
```
Claude -> indusk.query_spans({ query: "next", env: "dev", lookback: "1h" })
InDusk -> resolves dataset from config -> dash0.getSpans({ dataset: "dusk-dev", ... }) -> results
```

One call. One result. No guessing.

### Compound Operations

Single InDusk calls that orchestrate multiple MCP servers to answer one question. Defined declaratively in manifests, not hardcoded.

Examples:
- `indusk.diagnose_browser({ url: "/dashboard", symptom: "slow" })` -> Chrome DevTools performance trace + Dash0 backend spans + correlation by trace ID
- `indusk.trace_request({ endpoint: "/api/settle", lookback: "30m" })` -> Dash0 traces + correlated logs + timeline
- `indusk.investigate_error({ error: "ECONNREFUSED", service: "graphiti" })` -> container status + logs + health check -> unified diagnosis

### Manifest-Defined Operations

Proxy calls and compound operations defined declaratively in extension manifests or a dedicated operations config. New operations can be added without code changes. Extensions can ship their own.

### MCP Request Logging

Every call through the orchestration layer — proxied or compound — logged with:
- Timestamp, tool name, arguments
- Response (or error), latency
- Which compound operation it was part of (if any)
- Session context (which session, which plan phase)

Stored as append-only JSONL (like the semantic graph event log pattern). Queryable for tool usage patterns, performance analysis, and feeding into the knowledge graph.

## Context

- Claude Code session transcripts contain `tool_use` blocks with tool names and arguments, but no timing, no error tracking, and no way to query them
- InDusk MCP server already wraps some operations (e.g., `graph_capture` dual-writes to Graphiti + semantic graph)
- Graphiti group IDs are already resolved via `getProjectGroupId()` — this is a one-off version of the intent translation pattern
- CGC graph names already follow a convention (`cgc-{project}`) — another one-off
- Dash0 dataset names, time formats, and common filters vary per project and environment
- Chrome DevTools MCP server was recently added — compound operations correlating browser + backend are immediately valuable

## Scope

### In Scope
- Intent translation layer for Dash0 (dataset, time, query syntax)
- Intent translation layer for Graphiti (group ID resolution — formalize existing pattern)
- Intent translation layer for CGC (graph name resolution — formalize existing pattern)
- Compound operation framework (manifest-defined multi-tool sequences)
- At least 2-3 compound operations as proof of concept
- MCP request logging (all proxied and compound calls)
- Operation manifest format definition
- Extension support for shipping custom operations

### Out of Scope
- Wrapping every MCP tool (start with highest-pain servers: Dash0, Chrome DevTools)
- Replacing direct MCP calls (proxy is additive — Claude can still call Dash0 directly)
- Building a UI for request logs (CLI/MCP tool query only)
- Automatic retry logic (intent translation should get it right the first time)
- Real-time alerting on MCP failures

## Success Criteria
- Dash0 queries succeed on first call via the orchestration layer (no more 3-4 retries)
- At least one compound operation works end-to-end, correlating data from two MCP servers
- All proxied MCP calls are logged with timing and success/failure
- MCP request log is queryable ("show me all Dash0 calls from today" or "what's the average latency for graph_capture?")
- New proxy translations can be added via config/manifest without code changes

## Depends On
- `agent-roles` — defines the infrastructure layer's responsibilities, confirms orchestration belongs there

## Blocks
- Future insights synthesis (tool usage analytics come from the request log)
- Future eval improvements (eval agent could score tool usage efficiency)
