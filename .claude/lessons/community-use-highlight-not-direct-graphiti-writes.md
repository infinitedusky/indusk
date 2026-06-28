# Use mcp__indusk__highlight, never call mcp__graphiti__add_memory directly

The InDusk agent system runs across three tiers — working agent, eval agent, infrastructure. The boundary between the first two tiers is load-bearing for every project that uses InDusk: **the working agent flags moments via `mcp__indusk__highlight`; the eval agent is the sole structured Graphiti writer at trigger points.**

If you are a working agent in a Claude Code session — and during normal sessions, you are — this rule applies to you.

## The rule

When you want to capture a decision, observation, correction, or lesson from the current session:

✅ **Do this:**

```typescript
mcp__indusk__highlight({
  tag: "brief-accepted" | "adr-accepted" | "correction" | "retro-lesson" | "observation" | ...,
  note: "single line describing what matters, with enough context to materialize",
  level: "critical" | "important" | "note"
})
```

❌ **Do NOT do this from process skills:**

```typescript
mcp__graphiti__add_memory({ ... })   // working agent crossing into eval-agent territory
mcp__indusk__graph_capture({ ... })  // same, just the InDusk wrapper
```

The eval agent — spawned automatically on every `git commit` and at session end via `/handoff` — reads the unprocessed highlights queue and materializes each entry as a structured Graphiti episode with the right typing, group ID, and edges. Your job is to **flag the moment**, not to shape the structured episode.

## Why this boundary exists

Direct Graphiti writes from in-flow code require the working agent to:

1. Pick a group ID (sanitization rules, project vs shared, etc.)
2. Phrase the episode as a Y-statement or correction (typed entity, structured edges)
3. Swallow Graphiti's network failures or container outages
4. Stop what it was doing to do all of the above

Every one of these is out-of-flow work. The working agent should stay in flow.

Highlights flip the model: write one line, keep going. The eval agent does the heavier shaping on its own cadence, in its own subprocess, with its own context. By the next `/catchup`, the structured episode is in Graphiti and queryable via `mcp__graphiti__search_nodes`.

## What you CAN do with Graphiti directly

**Reads are always allowed** from the working agent:

```typescript
mcp__graphiti__search_nodes({ query, group_ids: [project_group, "shared"], max_nodes })
mcp__graphiti__search_memory_facts({ ... })
mcp__graphiti__get_episodes({ ... })
mcp__graphiti__get_entity_edge({ ... })
```

These are used during `/catchup`, mid-session research, and conflict resolution. The boundary is only on **structured writes**.

## Trigger points where you SHOULD call highlight

The skills you load via slash commands already call highlight at the right moments. If you're authoring or modifying a skill, these are the canonical trigger points:

| Trigger | Skill | Tag | Level |
|---|---|---|---|
| Brief accepted | planner | `brief-accepted` | `important` |
| ADR accepted | planner | `adr-accepted` | `critical` |
| Mid-session correction (user says "no, do it this way") | work | `correction` | `important` |
| Retrospective "What We Learned" item | retrospective | `retro-lesson` | `important` |
| Retrospective "What We'd Do Differently" item | retrospective | `retro-hindsight` | `important` |
| User runs `/highlight ...` | highlight | user-specified, default `observation` | user-specified, default `important` |

If you find yourself wanting to write to Graphiti at a trigger point not on this list — first ask whether the existing skills should be flagging there too. The answer is usually yes; add a `mcp__indusk__highlight` call to the existing skill rather than calling Graphiti directly from your new skill.

## Common failure modes

**"I want the episode to land in Graphiti RIGHT NOW because the user is asking about it."**
You're conflating "I want the user to see something" with "I need Graphiti to remember something." If the user is asking now, just tell them now. The eval agent handles the durable memory. If the user wants you to query Graphiti and report what's there, that's a `mcp__graphiti__search_nodes` call (read) — fine.

**"The eval agent might not run if I don't commit."**
That's what `/handoff` is for. The session-end ritual fires the eval-trigger explicitly so the queue drains before the session closes. If you're using `/handoff`, the highlight will be processed.

**"Graphiti is down — should I write the highlight anyway?"**
Yes. Highlights write to a local `.indusk/highlights.jsonl` file, not to Graphiti. The eval agent retries on its own schedule. Graphiti being down doesn't prevent you from flagging the moment.

**"I'm writing a custom MCP tool — can it call `add_memory`?"**
Custom tools that aren't process skills can have different rules, but the question is whether the tool's purpose includes "structured durable memory" (eval-agent territory) or "ad-hoc temporal state" (working-agent territory). If it's the former, route it through the highlights queue so the discipline survives. If it's the latter, you probably don't want Graphiti at all — use the file system or a session-scoped store.

## Where this is enforced (and where it isn't)

There is no structural enforcement of this rule. No validator hook blocks `mcp__graphiti__add_memory` calls from process skills. The discipline is content-level: skills are authored to call highlight; agents trained on the skills follow the pattern; lessons (this one) reinforce it.

If you violate the rule, your episode WILL land in Graphiti (it'll work). But:
- The typing won't match what the eval agent's prompt produces (group ID sanitization, entity-type assumptions, edge weighting)
- The highlights queue won't have a record, so cross-agent visibility breaks
- The eval agent can't deduplicate against your direct write
- Future plans that rely on the highlights queue as a complete audit trail will miss your entry

The rule exists because the consequences of violating it are subtle and accumulate. A single direct-Graphiti-write call may seem harmless. Hundreds across many skills produce graph corruption that's hard to detect and harder to clean.

## How to know if you're following the rule

Search your generated code for `mcp__graphiti__add_memory` and `mcp__indusk__graph_capture`. If either appears in a process skill, an MCP tool, or any agent-invoked code path, that's the violation. Replace with `mcp__indusk__highlight` + tag + level + note.

The exception is `apps/indusk-mcp/src/lib/eval/` — that's the eval-agent code path and it's allowed to call `graph_capture` because it IS the eval agent. If you're touching eval-agent code, you're operating in the second tier and the rules differ.
