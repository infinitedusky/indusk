---
title: "Hermes-Inspired Improvements"
date: 2026-04-14
status: complete
---

# Hermes-Inspired Improvements — Research

## Question

What patterns from NousResearch's Hermes Agent (76k lines Python, 32k+ GitHub stars) are worth adopting in InDusk, given that InDusk operates within Claude Code sessions (not as a standalone agent runtime)?

## Background

Hermes Agent is a persistent AI agent daemon that runs 24/7, talks to 20+ LLM backends, integrates with Telegram/Discord/Slack/Signal/WhatsApp, and manages its own memory, context compression, and session lifecycle. hermes-CCC is a community port that brings Hermes's operational patterns into Claude Code as pure markdown skills (46 skills, no code).

InDusk is a development system that runs inside Claude Code sessions — skills, hooks, MCP tools, code graph, knowledge graph. It doesn't control the runtime, it augments it.

The research question is: which Hermes patterns translate to InDusk's architecture, and which solve problems InDusk doesn't have?

## Findings

### 1. Session Transcript Capture

**Hermes approach:** Every message (user, assistant, tool calls, tool results) is stored in a SQLite database (`state.db`) with FTS5 full-text search. Schema tracks session metadata (source platform, model, timestamps, token counts, cost), message content, tool call details, and reasoning. The `session_search` tool queries FTS5, groups results by session, sends matching transcripts to a cheap auxiliary model (Gemini Flash) for summarization, and returns focused summaries. ~550 lines of Python.

**What InDusk currently has:**
- The full conversation transcript already exists during each session at `$CLAUDE_TRANSCRIPT_PATH` as JSONL
- It is **deleted when the session ends** — this is the primary data loss point
- The eval hook reads this path to feed the judge, but doesn't archive it
- Handoff captures a summary but not the raw transcript
- Graphiti captures curated episodes at trigger points (brief/ADR/correction/retro)
- Auto-memory captures durable facts
- `~/.claude/history.jsonl` captures only user inputs, not assistant responses or tool calls

**Gap analysis:**
- **What disappears:** Full assistant responses, tool call arguments and results, reasoning chains, the flow of exploration/debugging, rejected approaches, mid-conversation corrections
- **What survives:** Curated highlights (Graphiti episodes), summary (handoff), durable facts (auto-memory), quality scores (eval), user inputs only (history.jsonl)
- **When it matters:** "What did we try when debugging X?", "How did we solve this last time?", "What was the agent's reasoning for that approach?", "We discussed something about Y three sessions ago"

**Implementation path for InDusk:**
- A hook (PreToolUse or PostToolUse, or a session-end hook) copies `$CLAUDE_TRANSCRIPT_PATH` to a persistent location before the session ends
- Storage: `.indusk/transcripts/{date}-{session-id}.jsonl` or a central location like `~/.indusk/transcripts/`
- Index: SQLite with FTS5 (following Hermes's proven approach) or append to a search-friendly format
- Search: An MCP tool (`transcript_search`) that queries the index, optionally summarizes with a cheap model
- The handoff skill could trigger the archive as its final step (it already runs at session end)

**Key constraint:** Claude Code controls the session lifecycle. We can't hook into "session ending" reliably from inside the session. Options:
- The `/handoff` skill archives the transcript as part of its workflow (most reliable — user explicitly ends session)
- A PostToolUse hook on session-ending signals (less reliable, what signals?)
- The eval hook could archive as a side effect of firing on `jj describe` (captures at commit points, not session end)

**Storage considerations:**
- Transcripts can be large (a 2-hour session could be 1-5 MB of JSONL)
- FTS5 index stays fast up to hundreds of MB
- Privacy: transcripts may contain sensitive data — should respect `.gitignore` and stay local
- Retention policy: keep last N sessions? Last N days? Unlimited?

### 2. Pre-Compress Memory Extraction

**Hermes approach:** The `MemoryProvider` ABC has an `on_pre_compress(messages) -> str` hook. Before the `ContextCompressor` summarizes and discards middle turns, every memory provider gets a chance to extract important information from the messages about to be lost. The returned text is included in the compression summary prompt so the compressor preserves provider-extracted insights.

**What InDusk currently has:**
- Claude Code handles its own context compression (via `/compact` or automatic)
- InDusk has no visibility into when compression happens or what gets discarded
- No hook fires before or after compression

**Gap analysis:**
- When context is compressed, uncaptured decisions, corrections, and reasoning chains disappear
- The handoff file only captures what was explicitly written at session end, not what was in-flight when compression hit
- If transcript capture is implemented, this becomes less critical — the raw data is preserved even if it leaves the context window

**Implementation path for InDusk:**
- Claude Code doesn't expose a pre-compress hook to skills/MCP tools
- **This may not be implementable** without changes to Claude Code itself
- Workaround: if transcripts are being archived continuously (not just at session end), compression doesn't cause data loss — it just leaves the context window, but the data is still on disk
- Alternative: a periodic "context snapshot" that the agent takes proactively (like hermes-compress's session-state YAML block), saved to the transcript or a separate file

**Verdict:** Partially addressed by transcript capture. The real value of pre-compress extraction is that it's automatic. A manual `/compress` skill that writes a structured snapshot would be useful but isn't solving the same problem.

### 3. Lightweight Triage/Routing

**Hermes approach:** Two layers:
1. `smart_model_routing.py` (~196 lines): Per-turn routing to a cheaper model for simple messages. Checks character count (<160), word count (<28), line count (<=1), absence of code blocks/URLs, and absence of complexity keywords (debug, implement, refactor, etc.). If all checks pass, routes to a configured cheap model.
2. `hermes-route` skill: A markdown playbook for task classification into lightweight/standard/deep buckets, with a structured routing block output (task class, execution mode, read-first, parallelism, reasoning depth, first concrete step).

**What InDusk currently has:**
- No pre-work triage step for ad-hoc requests
- The planner skill handles structured work but isn't invoked for quick requests
- Catchup establishes context but doesn't classify incoming work
- The agent jumps from "user says something" to "start doing stuff"

**Gap analysis:**
- Model routing is N/A (Claude Code controls model selection)
- Task classification is relevant: "should I read the plan first?", "should I query the graph?", "is this a quick edit or a deep investigation?", "can I parallelize?"
- Currently the agent sometimes over-invests in simple tasks or under-invests in complex ones

**Implementation path for InDusk:**
- Not a separate skill — too much overhead for every interaction
- Could be a CLAUDE.md instruction: "Before starting work on any request, briefly classify: is this lightweight (direct edit), standard (read context first), or deep (read plan + query graph + consider approach)?"
- Could be part of catchup or a PostToolUse hook that nudges classification
- The routing block format from hermes-route is good: task class, execution mode, read-first, parallelism, first step

**Verdict:** Worth adopting as a lightweight convention, not a heavy skill. Add to CLAUDE.md conventions or as a micro-instruction in the work skill.

### 4. Insights Synthesis

**Hermes approach:** `InsightsEngine` (~790 lines Python) queries SQLite session data to produce:
- Token consumption and cost estimates (per model, per platform)
- Tool usage patterns (which tools, how often, percentage breakdown)
- Activity patterns (by day of week, by hour, streaks)
- Session metrics (longest, most messages, most tokens)
- Model/platform breakdowns
- Formatted for terminal (box-drawing chars) or messaging (markdown)

**What InDusk currently has:**
- Eval scorecards (quality signal per commit)
- `indusk eval summary` (basic trend over recent evals)
- Graphiti episodes (searchable knowledge, but not aggregated)
- No "how am I using this system?" dashboard
- No cross-session analytics

**Gap analysis:**
- Token/cost tracking is less relevant (Anthropic bills directly, not per-session)
- Tool usage patterns could be derived from transcripts if captured
- Quality trends over time are partially covered by eval but not well-visualized
- Activity patterns are interesting but low priority
- The real value: "is the system getting better?" — are eval scores improving? Are fewer corrections needed? Are plans completing faster?

**Implementation path for InDusk:**
- Depends on transcript capture being in place first (needs data to analyze)
- An `indusk insights` MCP tool / CLI command that queries:
  - Eval results.log (quality trends)
  - Graphiti (knowledge accumulation rate, contradiction frequency)
  - Transcripts (tool usage, session duration, common patterns)
  - Plan history (completion rate, phase counts, time-to-ship)
- Output: structured report, not a dashboard

**Verdict:** Worth building after transcript capture is stable. Needs real data to be meaningful. Defer to a later phase or a follow-on plan.

### 5. Hermes Memory Architecture Comparison

**Hermes has three memory layers:**

| Layer | Mechanism | InDusk Equivalent |
|-------|-----------|-------------------|
| Built-in memory | MEMORY.md (2200 chars) + USER.md (1375 chars), frozen snapshot in system prompt, file-locked atomic writes, injection scanning | Auto-memory (user/feedback/project/reference types in `~/.claude/projects/*/memory/`), no char limit, no frozen snapshot |
| Session search | SQLite FTS5 over all past messages, LLM-summarized results via cheap auxiliary model | Nothing — transcripts are deleted |
| Pluggable provider | One of 8 backends (Honcho/Mem0/Hindsight/etc.), per-turn prefetch+sync, lifecycle hooks | Graphiti (temporal knowledge graph), capture at trigger points only, no per-turn sync |

**Key architectural differences:**
- Hermes controls the runtime → can inject memory into system prompt, intercept compression, sync every turn
- InDusk rides on Claude Code → can use hooks and MCP tools but can't modify the system prompt or intercept compression
- Hermes has breadth (8 memory backends) but flat storage (facts in, facts out)
- InDusk has depth (knowledge graph with temporal facts, contradiction detection, code-structure awareness) but narrower capture

**What Hermes does that's worth noting but NOT worth adopting:**
- Frozen system prompt snapshot for cache stability — Claude Code manages its own prompt caching
- Per-turn sync to external memory — too expensive and noisy for a dev system; trigger-point capture is better
- Multiple memory backends — one good backend (Graphiti) is better than 8 mediocre ones
- Memory injection scanning (prompt injection patterns) — interesting but Claude Code has its own safety mechanisms

### 6. Critical Discovery: Claude Code Already Persists Transcripts

**Claude Code does NOT delete session transcripts.** They persist at `~/.claude/projects/{project-hash}/{session-id}.jsonl`.

**Verified data for the dusk project:**
- 33 session files
- 125 MB total
- Sessions range from 3.5 KB (quick warmup) to 5 MB (long sessions)
- Full JSONL with every message

**JSONL schema per line:**
```
{
  "parentUuid": string | null,    // for conversation threading
  "isSidechain": boolean,         // branching context
  "userType": "external",
  "cwd": string,                  // working directory
  "sessionId": string,            // UUID
  "version": string,              // Claude Code version
  "gitBranch": string,
  "type": "user" | "assistant" | "ai-title" | "attachment" | "file-history-snapshot" | "queue-operation" | "last-prompt",
  "message": {
    "role": "user" | "assistant",
    "content": string | ContentBlock[]  // ContentBlock has type: "text" | "tool_use" | "thinking" | "tool_result"
  },
  "uuid": string,
  "timestamp": ISO-8601,
  "requestId": string             // (assistant messages only)
}
```

**Content types observed in a single session (5 MB, 631 assistant messages, 436 user messages):**
- `tool_use` blocks with `name` and `input` (full tool call arguments)
- `thinking` blocks (model reasoning)
- `text` blocks (assistant prose)
- `file-history-snapshot` entries (121 in one session — file state tracking)
- `queue-operation` entries (170 — internal queue management)

**This means the capture problem is already solved.** The raw data exists, is structured, and is comprehensive. What's missing is:
1. **Search** — no way to query across sessions
2. **Indexing** — no FTS5 or similar index over the content
3. **Summarization** — no way to get "what happened in session X?" without reading megabytes of JSONL
4. **Cross-project access** — transcripts are siloed by project hash

The plan shifts from "capture transcripts" to "build a search and recall layer over existing transcripts."

## Revised Open Questions

1. **FTS5 index location:** Build a SQLite index at `~/.indusk/transcripts.db` that indexes content from `~/.claude/projects/*/` JSONL files? This mirrors Hermes's `state.db` approach.

2. **Incremental indexing:** The index needs to track which session files have been indexed and their last-modified timestamp, so it can efficiently update without re-reading everything.

3. **What to index:** Full content of user and assistant messages? Just text blocks? Include tool call names/arguments? Exclude thinking blocks (privacy/noise)?

4. **Summarization approach:** Hermes uses a cheap auxiliary model (Gemini Flash) to summarize matched sessions. We could use Claude Code's built-in Agent tool (spawning a haiku subagent) for the same purpose, staying within Claude Code's ecosystem.

5. **MCP tool vs CLI:** Should `transcript_search` be an MCP tool (available to the agent during sessions) or a CLI command (used by the user directly)? Probably both, like `graph_sync`.

## Sources

- Hermes Agent source: https://github.com/NousResearch/hermes-agent (cloned at /tmp/hermes-agent)
- hermes-CCC source: https://github.com/AlexAI-MCP/hermes-CCC (cloned at /tmp/hermes-CCC)
- Key files analyzed:
  - `/tmp/hermes-agent/agent/memory_manager.py` — MemoryManager orchestration
  - `/tmp/hermes-agent/agent/memory_provider.py` — MemoryProvider ABC
  - `/tmp/hermes-agent/agent/context_compressor.py` — ContextCompressor (800 lines)
  - `/tmp/hermes-agent/agent/smart_model_routing.py` — per-turn model routing
  - `/tmp/hermes-agent/agent/trajectory.py` — trajectory capture
  - `/tmp/hermes-agent/agent/insights.py` — InsightsEngine (790 lines)
  - `/tmp/hermes-agent/tools/memory_tool.py` — built-in memory (MEMORY.md/USER.md)
  - `/tmp/hermes-agent/tools/session_search_tool.py` — FTS5 session search
  - `/tmp/hermes-agent/hermes_state.py` — SQLite state store schema
  - `/tmp/hermes-agent/plugins/memory/honcho/__init__.py` — Honcho provider (720 lines)
  - `/tmp/hermes-agent/plugins/memory/mem0/__init__.py` — Mem0 provider
