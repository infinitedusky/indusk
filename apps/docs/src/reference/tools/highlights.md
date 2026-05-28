# Highlights — The Working Agent's Write Path to Graphiti

Highlights are the working agent's low-cost, append-only queue of "something worth remembering." The working agent writes them; the eval agent processes them into structured [Graphiti](/reference/tools/graphiti) episodes. This split is the core of the agent-roles boundary: the working agent stays in flow, and the eval agent does the heavier knowledge work asynchronously.

Before highlights, the working agent called `graph_capture` directly at trigger points. Direct Graphiti writes require the agent to pick a group, phrase the episode as a Y-statement or correction, and swallow the failure if Graphiti is down — every one of these is out-of-flow work. Highlights flip the model: the working agent flags a moment with a tag, a note, and a level. That's it. The eval agent handles the rest on its own cadence.

## File Layout

Highlights live in the project's `.indusk/` directory — project-scoped, not global:

| File | Purpose |
|------|---------|
| `.indusk/highlights.jsonl` | Append-only queue. One JSON object per line. Written by the working agent. |
| `.indusk/highlights-processed.jsonl` | Append-only processed log. One JSON object per line. Written by the eval agent. |

Neither file is ever rewritten or edited in place. The unprocessed set is computed by reading both files and filtering highlights whose IDs don't yet appear in the processed log.

## Highlight Shape

Each entry in `highlights.jsonl` has this shape:

```json
{
  "id": "h-20260417-001",
  "timestamp": "2026-04-17T13:58:55.123Z",
  "level": "critical",
  "tag": "brief-accepted",
  "note": "agent-roles brief accepted on 2026-04-15"
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `id` | `h-{YYYYMMDD}-{seq}` | Auto-generated. `seq` is a 3-digit counter that resets daily. |
| `timestamp` | ISO 8601 UTC | When the highlight was written. |
| `level` | `critical` / `important` / `note` | How much effort the eval agent should spend processing it. |
| `tag` | short string | The trigger category: `brief-accepted`, `adr-accepted`, `correction`, `retro-lesson`, `observation`, or user-defined. |
| `note` | single line | What matters. Human-readable. |

Processed entries (in `highlights-processed.jsonl`) have this shape:

```json
{
  "id": "h-20260417-001",
  "processedAt": "2026-04-17T14:30:00.000Z",
  "action": "wrote-episode",
  "detail": "retro-agent-roles-2"
}
```

`action` is either `wrote-episode` (eval agent turned it into a Graphiti episode, `detail` is the episode name) or `skipped` (eval agent decided no episode was needed, `detail` is the reason).

## Levels

The level is the only real contract between the working agent and the eval agent. It drives effort and weight downstream:

| Level | Meaning | Eval agent response |
|-------|---------|---------------------|
| `critical` | Architectural decision, accepted ADR, accepted brief. Must not be lost. | Extract full context from transcript, write a structured Graphiti episode with high weight (1.0). |
| `important` | Correction, retro lesson, confirmed pattern. Worth remembering. | Extract and write with medium weight (0.6). |
| `note` | Observation, surprise, partially-formed thought. | Consider. Write with low weight (0.3) or skip if already captured elsewhere. |

The working agent does not decide which Graphiti group the episode lands in, how the Y-statement is phrased, or whether it supersedes an earlier fact. Those are eval-agent concerns.

## MCP Tools

Three tools on the InDusk MCP server wrap the file operations. The working agent and eval agent use these directly instead of touching the JSONL files.

| Tool | Called by | Purpose |
|------|-----------|---------|
| `highlight` | working agent (and skills) | Write a new highlight to the queue. Returns the generated entry. |
| `highlights_unprocessed` | eval agent | Return all entries in the queue that don't yet appear in the processed log. |
| `highlight_mark_processed` | eval agent | Mark a highlight processed — either `wrote-episode` (with the episode name in `detail`) or `skipped` (with the reason in `detail`). |

### `highlight`

```ts
highlight({
  tag: "brief-accepted",
  note: "agent-roles brief accepted on 2026-04-15",
  level: "critical"
})
```

Returns the full entry including auto-generated `id` and `timestamp`. The call is idempotent from the working agent's perspective — if Graphiti is down, the highlight is still on disk for the eval agent to process later.

### `highlights_unprocessed`

```ts
highlights_unprocessed({})
```

Returns an array of `Highlight` objects. Order is the order they were written. The eval agent iterates this list at the start of its run.

### `highlight_mark_processed`

```ts
highlight_mark_processed({
  id: "h-20260417-001",
  action: "wrote-episode",
  detail: "retro-agent-roles-2"
})
```

Appends to `highlights-processed.jsonl`. The next call to `highlights_unprocessed` will exclude this ID.

## Trigger Points (Phase 2 and beyond)

In Phase 1, only the library and the MCP tools ship. In Phase 2 of the agent-roles plan, the planner / work / retrospective skills migrate from direct `graph_capture` calls to `highlight` calls:

| Trigger | Skill | Level | Tag |
|---------|-------|-------|-----|
| Brief moves to `accepted` | planner | `critical` | `brief-accepted` |
| ADR moves to `accepted` | planner | `critical` | `adr-accepted` |
| User confirms `context learn` | work | `important` | `correction` |
| Retrospective "What We Learned" item | retrospective | `important` | `retro-lesson` |
| User runs `/highlight ...` (Phase 4) | highlight skill | user-specified (default `important`) | user-specified or `observation` |

The eval agent's PostToolUse hook fires on every `jj describe` and processes the unprocessed queue before scoring the commit. The handoff skill also fires the eval trigger at session end (Phase 4), so highlights written without a subsequent commit still get processed before the session ends.

## How the Eval Agent Processes Highlights

The eval agent's prompt (built by [`prompt-builder.ts`](https://github.com/infinitedusky/dusk/tree/main/apps/indusk-mcp/src/lib/eval/prompt-builder.ts)) includes a **Step 4: Process unprocessed highlights** before the rubric evaluation. The step runs only in eval mode; baseline mode skips it by design.

For each highlight returned by `highlights_unprocessed`, the evaluator:

1. **Reads the level** and maps it to a Graphiti edge weight:

   | Level | Edge weight | Expected effort |
   |-------|-------------|-----------------|
   | `critical` | **1.0** | Extract full context from transcript + changed files, write a structured episode. |
   | `important` | **0.6** | Extract relevant context, write a medium-weight episode. |
   | `note` | **0.3** | Consider — write a low-weight episode if it adds signal, otherwise skip. |

2. **Writes a Graphiti episode** via `mcp__indusk__graph_capture` (not raw `mcp__graphiti__add_memory`). `graph_capture` attaches the episode to the relevant file anchor in the semantic graph, so [context-beam](/reference/tools/context-beam) queries can find it later. The group is typically the project group for project-specific facts, or `shared` for cross-project conventions (e.g., "always use pnpm ce"). The level is encoded in the body's metadata so downstream queries can rank by importance.

3. **Marks the highlight processed** via `mcp__indusk__highlight_mark_processed`:
   - `action: "wrote-episode"` with `detail: "{episode name}"` if an episode was written
   - `action: "skipped"` with `detail: "{reason}"` if the eval agent decided the highlight didn't warrant a new episode (e.g., already captured by another episode)

### Highlights are additive, not bounding

The eval agent's prompt explicitly says: **"Highlights are additive context, not a constraint. Continue reading the full transcript and inferring knowledge independently."** The working agent's highlights ensure important moments aren't missed, but they don't bound the eval agent's analysis. The transcript may contain insights the working agent didn't flag, and the eval agent is expected to surface those too.

This matters because the working agent operates under time/flow pressure and may miss moments that are obvious in hindsight. Highlights are a floor on what gets captured, not a ceiling.

### Graceful degradation

If `mcp__indusk__highlights_unprocessed` is unavailable (InDusk MCP down, transport error), Step 4 is skipped silently and the evaluator continues to the rubric. Highlights are best-effort — the broader scoring flow never fails because of a Graphiti or InDusk hiccup.

## Why Highlights and Not Direct Graphiti Writes

1. **The working agent stays in flow.** Writing a highlight is two lines — a tag and a note. Writing a structured episode requires picking a group, phrasing a Y-statement, deciding whether this supersedes earlier facts, and handling Graphiti being down.
2. **The eval agent is the authoritative knowledge writer.** It already has the full transcript, the scorecard, and cross-session context. It can produce higher-quality episodes than the working agent can mid-task.
3. **Highlights are observable.** A plain JSONL file is trivial to inspect, replay, and migrate. Direct Graphiti writes are opaque once they leave the agent.
4. **Levels give the eval agent a budget.** Not every highlight deserves a full episode. The level lets the eval agent spend more effort on `critical` moments and skip redundant `note`s.

See [the agent-roles ADR](https://github.com/infinitedusky/dusk/tree/main/.indusk/planning/agent-roles/adr.md) for the full reasoning.
