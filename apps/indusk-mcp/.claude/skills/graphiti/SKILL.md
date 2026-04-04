# Graphiti — Temporal Knowledge Graph

Graphiti is an episodic memory system backed by FalkorDB. It extracts entities and facts from text, detects contradictions, and supports semantic search across project-specific and shared knowledge.

## When to Use

- **Episode capture**: After a decision, retro finding, or correction — anything worth remembering across sessions
- **Search**: Before making assumptions — check what's already known about a topic
- **Context retrieval**: At session start or when working in an unfamiliar area

## Core Concepts

### Episodes
An episode is a chunk of text that Graphiti processes into entities and facts. Think of it as "something that happened" — a decision was made, a bug was found, a convention was established.

### Group IDs
Every episode belongs to a group. Groups isolate knowledge:

| Group | Purpose | Example |
|-------|---------|---------|
| `{project-name}` | Project-specific knowledge | `infinitedusky`, `numero` |
| `shared` | Cross-project conventions | Developer preferences, universal patterns |

When searching, always include both the project group and `shared` to get the full picture. The `GraphitiClient` does this automatically.

### Entities and Facts
Graphiti extracts:
- **Entities**: Named things (tools, patterns, files, concepts)
- **Facts**: Relationships between entities with temporal validity

Facts can be contradicted — if you add "the parser handles three gate types" and later "the parser handles four gate types", Graphiti invalidates the old fact.

## Patterns

### Capturing a Decision
After an ADR is accepted or a significant choice is made:
```
addEpisode("auth-approach-decision", 
  "We chose JWT with refresh tokens over session cookies because the API serves both web and mobile clients. Session cookies don't work well with React Native.",
  { groupId: "myproject" })
```

### Capturing a Correction
When someone corrects the agent or a mistake is found:
```
addEpisode("correction-test-database",
  "Integration tests must use a real database, not mocks. We got burned when mocked tests passed but the production migration failed.",
  { groupId: "shared" })
```

### Searching Before Acting
Before making assumptions about how something works:
```
searchNodes("authentication middleware")
searchFacts("how does auth work in this project")
```

### Capturing a Retrospective Finding
After a plan retrospective surfaces a useful insight:
```
addEpisode("retro-gate-enforcement",
  "Plan gates need hook-based enforcement, not just instructions. The agent skipped gates when they were advisory only. PreToolUse hooks that block phase transitions are the fix.",
  { groupId: "myproject" })
```

## What NOT to Capture

- Code structure (CGC handles this)
- Git history (git log handles this)
- Ephemeral state (current task, in-progress work)
- Things already in CLAUDE.md or lessons

Graphiti is for knowledge that has temporal context — decisions that might change, facts that might be contradicted, insights that accumulate over time.

## Infrastructure

Graphiti runs inside the `indusk-infra` container alongside FalkorDB:

```bash
indusk infra start    # start the container
indusk infra status   # check health
indusk infra stop     # stop (preserves data)
```

Global config (API keys, OTel): `~/.indusk/config.env`

### Graceful Degradation
If the `indusk-infra` container is down:
- CGC graph tools still check FalkorDB directly
- Graphiti client methods return null/empty (never throw)
- The agent continues working with flat-file context (CLAUDE.md, lessons, skills)
