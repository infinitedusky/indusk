# Handoff

The handoff skill is the session-end ritual: promote your session's operational state into `.indusk/current.md`, commit, run `indusk agent done`, fire the eval trigger.

After the [section-shape rework](/decisions/multi-agent-coordination), `.indusk/current.md` carries per-agent sections — one per Claude Code session. Your session owns one section, identified by your full session ID. The handoff ritual overwrites only *your* section; every other agent's section in the file is byte-untouched.

## The Four Steps

### 1. Update your section via the MCP tool

Call [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools) with three section bodies:

```typescript
mcp__indusk__update_current_section({
  sessionId: "<$CLAUDE_CODE_SESSION_ID>",
  task: "<one-line description>",
  sections: {
    in_flight: "What's actively in progress.",
    open_questions: "Hypotheses to confirm, design decisions mid-conversation.",
    cursor: "Where you stopped — file paths, line numbers, next concrete step."
  }
})
```

Atomic read-modify-write: the tool reads `current.md`, calls `upsertSection`, and renames a tmp file into place. Other agents' sections are byte-untouched.

If the session produced nothing worth promoting (shipped a feature and closed a plan, no in-flight state), skip this step. The tool is for state that *should* survive — don't paste boilerplate to fill the section.

### 2. Commit the change

Other agents only see committed state. If you skipped step 1, commit any code/plan work you did this session anyway.

### 3. Remove your presence

```bash
indusk agent done
```

Removes your section from `current.md`. Optional — sections age out via the `Last updated` TTL — but explicit `done` makes the bulletin tidier.

### 4. Fire the eval trigger

So the eval agent processes any unprocessed highlights before the session closes:

```bash
node .claude/hooks/eval-trigger.js --source handoff
```

Spawns the evaluator in the background and returns immediately. Never blocks session close.

## What You're NOT Doing

- **Not writing a separate file.** The old `.claude/handoff.md` is gone. There's no document to fill in beyond the three section bodies passed to the MCP tool.
- **Not touching other agents' sections.** Other sections in `current.md` belong to other sessions. Leave them alone. Use `indusk agent prune` if you want to clean up stale entries.
- **Not editing `## Project (shared)`.** That section is for cross-cutting project state, not session handoffs. If you need to update shared state, do it as a separate explicit edit; don't bundle it into your handoff write.

## Why It Works This Way

The old singleton `.claude/handoff.md` had two reliable failure modes against concurrent agents:

1. `/catchup` mutated the file (checkbox state machine) while another agent was reading it.
2. `/handoff` overwrote the file, destroying the previous session's content.

The section-shape design makes both impossible: each section is keyed by session ID; the MCP tool's atomic read-modify-write only touches the calling agent's section; and git merges different-section edits without conflict.

## Source

The canonical skill lives at `apps/indusk-mcp/skills/handoff.md`. Auto-synced to consumer projects' `.claude/skills/handoff/SKILL.md` via `globSync("*.md")` in `init.ts` and `update.ts`.

## See also

- [Multi-Agent Coordination ADR](/decisions/multi-agent-coordination)
- [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools)
- [`indusk agent` CLI reference](/reference/cli/agent)
- [Catchup skill](/reference/skills/catchup)
