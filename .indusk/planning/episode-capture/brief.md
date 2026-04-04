---
title: "Episode Capture"
date: 2026-03-27
status: draft
sequence: 3
parent: context-graph
---

# Episode Capture — Brief

## Problem
Developer knowledge evaporates between sessions. Capturing it today requires explicit rules ("save a lesson", "update context"). We need developer activity to flow into Graphiti automatically as episodes, with no manual intervention.

## Proposed Direction
Identify natural capture points in the developer workflow and build an episode pipeline in indusk-mcp that feeds them into Graphiti's `add_episode`.

Candidate capture points:
- **Conversation**: questions asked, explanations given, corrections made
- **Plan transitions**: phase advances, gate completions, blockers discovered
- **Verification results**: test failures, lint errors, type check issues
- **Research**: library evaluations, design discussions, trade-off analysis
- **Tool calls**: significant MCP tool invocations with context
- **Debugging**: error messages, root causes identified, workarounds discovered

## Key Questions
- What's the right granularity? Every conversation turn? Only significant ones?
- How do we avoid flooding Graphiti with noise? (filtering, batching, significance threshold)
- Where do capture hooks live? (Claude Code hooks, MCP tool wrappers, skill integration)
- What episode types/metadata should we define for each capture point?
- What's the LLM cost at realistic capture volume?

## Success Criteria
- Developer activity produces episodes in Graphiti without explicit "save" instructions
- Episodes extract meaningful entities and facts (not noise)
- A new session can discover what the previous session learned via graph queries
- Cost per session is acceptable (define threshold during research)

## Depends On
- graphiti-infrastructure (Plan 1)

## Blocks
- context-bootstrap (Plan 5) — informs the right episode format
- context-migration (Plan 6) — can't slim traditional context until capture is proven
