---
title: "Context Graph — Alignment with Anthropic's Context Engineering Guidance"
date: 2026-03-25
status: complete
---

# Anthropic Alignment — Research

Extracted from the main research doc. See `research.md` for the full context graph proposal.

## Source

[Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)

Core principle: "find the smallest set of high-signal tokens that maximize the likelihood of some desired outcome."

They document **context rot** — as context length increases, models show reduced ability to recall information. LLMs have a limited "attention budget."

## How Our System Implements Their Principles

| Anthropic's principle | Their solution | Our implementation |
|---|---|---|
| **Just-in-time loading** — don't pre-load all data, maintain lightweight identifiers and load at runtime | Tools that fetch data on demand | `context_beam` queries the graph when the agent is about to edit a file — loads only what's relevant to that file, not everything |
| **Progressive disclosure** — agents incrementally discover context through exploration, guided by metadata signals | File hierarchies, naming conventions, timestamps | Graph distance as the disclosure mechanism — distance 0 is full detail, distance 1 is summary, distance 2+ is awareness. The agent pulls threads deeper only when needed |
| **Context rot** — recall degrades as context grows | Keep context minimal, high-signal | The graph replaces unbounded flat files with targeted queries that return only what's relevant to the current task |
| **Structured note-taking** — agents maintain external memory files they reference later | Markdown files, scratchpads | Graph enrichment after verified work — structured nodes and edges instead of appending to a flat file. Queryable, relational, not just text |
| **Compaction** — summarize and reset context windows | Periodic summarization | The graph enables this naturally — instead of carrying 500 lines of CLAUDE.md, carry a 5-line orientation summary + the ability to query for depth |
| **Sub-agent architectures** — focused agents return condensed summaries to a coordinator | Specialized sub-agents | Future: a context sub-agent could run `context_beam` and return a pre-formatted context block |

## Key Observation

Anthropic doesn't mention graphs or structured knowledge representations. Their solutions operate at the prompt engineering level. The context graph is the **infrastructure** that makes their recommended patterns work at scale — when the project is too large for any flat file to remain "the smallest set of high-signal tokens."

## Sources
- [Effective Context Engineering for AI Agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
