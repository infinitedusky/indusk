---
title: "Hermes-Inspired Improvements"
date: 2026-04-14
status: accepted
blocked_by: [agent-roles]
---

# Hermes-Inspired Improvements — Brief

## Problem

Every Claude Code session generates a full conversation transcript (user messages, assistant responses, tool calls, thinking blocks) that persists at `~/.claude/projects/{project-hash}/{session-id}.jsonl`. For the dusk project alone, that's 33 sessions and 125 MB of structured data. But none of it is searchable.

When you want to know "how did we debug that FalkorDB connection issue?" or "what approach did we try for the sync engine before settling on event sourcing?", the only options are: hope it was captured in a Graphiti episode (curated, often incomplete), hope it's in auto-memory (only durable facts), or hope the handoff mentions it (only the most recent session). The raw transcript has every detail, but there's no way to find anything in it.

Hermes Agent solved this with FTS5 full-text search over a SQLite session store plus LLM-summarized results. The pattern is proven. We need the same thing over the data Claude Code already saves.

Secondary opportunity: a lightweight triage step before ad-hoc work, inspired by Hermes's `hermes-route` pattern. Currently the agent jumps from "user says something" to "start doing stuff" with no classification of complexity or pre-work context loading.

## Proposed Direction

**Build a transcript search and recall system** as an InDusk MCP tool + CLI command. Index existing Claude Code session transcripts into a SQLite FTS5 database. Provide search with optional LLM summarization of results. Make past sessions queryable the same way Hermes's `session_search` does, but built on data that already exists.

**Add a lightweight triage convention** as a CLAUDE.md instruction and optional work skill enhancement — not a separate skill. Before starting ad-hoc work, briefly classify the task and decide what context to load.

Architecture:
- SQLite database at `~/.indusk/transcripts.db` with FTS5 virtual table
- Incremental indexer that reads `~/.claude/projects/*/` JSONL files, tracks what's been indexed
- `transcript_search` MCP tool for agent use during sessions
- `indusk transcript search` CLI command for direct user access
- `indusk transcript index` CLI command to rebuild/update the index
- Catchup step 4.75: auto-index new sessions, optionally recall recent session context
- Triage convention added to CLAUDE.md and/or work skill preamble

## Context

Research analyzed NousResearch's Hermes Agent (76k lines Python, 32k+ GitHub stars) and its community Claude Code port (hermes-CCC). Key findings:

- Hermes's `session_search` tool uses FTS5 over SQLite, groups results by session, summarizes with a cheap auxiliary model. ~550 lines of Python. Proven pattern.
- Claude Code already persists full transcripts as JSONL — the capture problem is solved, the search problem is not.
- Hermes's memory system has 8 pluggable backends but flat storage. InDusk has deeper structured knowledge (Graphiti + CGC + semantic graph) but no raw transcript recall.
- Hermes's `hermes-route` classifies tasks into lightweight/standard/deep with a structured routing block. InDusk has no pre-work classification for ad-hoc requests.

See `.indusk/planning/hermes-inspired-improvements/research.md` for full analysis.

## Scope

### In Scope
- SQLite FTS5 index over Claude Code session transcripts
- Incremental indexer (track indexed files, only process new/modified)
- `transcript_search` MCP tool with keyword search and optional summarization
- `indusk transcript search "<query>"` CLI command
- `indusk transcript index` CLI command (manual index rebuild)
- Integration with catchup (auto-index, optional recall)
- Lightweight triage convention in CLAUDE.md
- Index user messages, assistant text blocks, tool call names. Exclude thinking blocks and file-history-snapshots (noise).

### Out of Scope
- Complementary persona system (separate plan: `complementary-personas`)
- Replacing Graphiti or auto-memory (transcript search is additive, not a replacement)
- Cross-project transcript search (index per-project initially, cross-project later)
- Retention policies or transcript cleanup (transcripts are Claude Code's data, we just index them)
- Web UI or dashboard for insights (CLI/MCP only)
- Full insights synthesis engine (follow-on plan after this is stable)

## Success Criteria
- Can search across all past sessions for a keyword and get relevant results in under 2 seconds
- Results include session date, matched content snippets, and optional LLM-generated summary
- Index updates incrementally (doesn't re-read all 125 MB on every invocation)
- Works during catchup to surface relevant past session context
- Triage convention measurably reduces wasted context loading on simple tasks (qualitative assessment via eval)

## Depends On
- Nothing — builds on existing Claude Code transcript files and existing InDusk MCP/CLI infrastructure

## Blocks
- `complementary-personas` plan may want to query past sessions for user modeling
- Future `insights-synthesis` plan will query the transcript index for usage patterns
