---
name: handoff
description: Session-end ritual — call mcp__indusk__update_current_section to promote your session's operational state into .indusk/current.md (overwriting only your own section), commit, run `indusk agent done`, fire the eval trigger.
---

You are ending a session, or about to hand off to another agent or another session of yourself. The handoff ritual promotes your session's operational state into `.indusk/current.md` so the next agent (or future-you) can pick up where you left off without rediscovery.

The file `.indusk/current.md` carries **per-agent sections** — one per Claude Code session that's worked on this project recently. Your session owns one of those sections, identified by your full session ID (`$CLAUDE_CODE_SESSION_ID`, or `pid-<N>` fallback). This ritual overwrites only *your* section; every other agent's section in the file is byte-untouched. There's no shared mutation surface and no race against concurrent handoffs.

## The ritual

### 1. Update your section via the MCP tool

Call `mcp__indusk__update_current_section` with your operational state:

```typescript
mcp__indusk__update_current_section({
  sessionId: "<your $CLAUDE_CODE_SESSION_ID, or pid-<N> if env unset>",
  task: "<one-line description of what this session is working on>",
  sections: {
    in_flight: "What's actively in progress. Plan name + phase + current focus. Examples: 'auth-refactor Phase 3 — middleware rewrite', 'investigating slow catchup reads (no plan yet)'. Be specific; vague entries waste the next session's time.",
    open_questions: "Hypotheses you haven't confirmed; design decisions mid-conversation; things you want the next agent to think about before continuing.",
    cursor: "Where you stopped, in enough detail that re-entering doesn't require rediscovery. File paths + line numbers + the next concrete step. Examples: 'apps/backend/src/auth/middleware.ts:42 — about to extract refreshToken helper', 'Phase 2 verification gate — T7 written + scaffolded, needs Phase 3 lib lands'."
  }
})
```

The tool reads `.indusk/current.md`, finds the section matching your session ID, overwrites the three subsection bodies, refreshes the `Last updated` timestamp, and atomically writes back. If no section exists for your session yet, the tool appends a new one. Either way, every other agent's section is byte-untouched.

**Body-content rules** — the tool rejects any of the three section bodies (`in_flight`, `open_questions`, `cursor`) containing a line that matches one of these four anchored patterns:

- `^---\s*$` — a horizontal rule on its own line (would split the section in the parser)
- `^##\s+Session\s+` — a heading starting with `## Session` (would inject a fake session)
- `^\*\*Session ID\*\*:` — the full-UUID marker line
- `^\*\*Last updated\*\*:` — the staleness-timestamp marker

These are the four line patterns the parser uses to recognize sessions. If you need to describe another session's work in your body — e.g., "blocked on what `## Session 2c87` is doing" — wrap the marker in backticks (`` `## Session ...` ``) or indent it, so it's no longer at the start of the line. Newlines and other control characters in the `sessionId` field are also rejected. Rejections come back as `TypeError`; the tool exits with non-zero before any write.

If you have nothing worth promoting (the session shipped a feature and closed a plan, leaving no in-flight state), you can skip this step. The tool is for moments that *should* survive — don't paste boilerplate just because the ritual asks.

### 2. Commit the change

Use the normal commit flow for this project. Other agents only see committed state — your uncommitted edits are invisible to them. If you skipped step 1, commit whatever code/plan work you did this session anyway.

### 3. Remove your presence

```bash
indusk agent done
```

Removes your section from `.indusk/current.md`. After this, you no longer show up in `indusk agent list` from other sessions. Optional — sections age out automatically via the `Last updated` TTL — but explicit `done` makes the bulletin tidier for concurrent agents.

### 4. Fire the eval trigger

So the eval agent processes any unprocessed highlights before the session closes. Highlights written after the last `git commit` would otherwise sit in the queue until the next session's first commit.

```bash
node .claude/hooks/eval-trigger.js --source handoff
```

The trigger spawns the evaluator in the background and returns immediately. Never blocks session close. If the hook isn't installed or Node isn't on PATH, the highlights stay queued for the next commit in a future session.

## When this skill fires

- `/handoff` explicitly
- The user says "wrap up", "hand off", "let's stop here"
- You're about to run out of context

In any of those cases, walk the four steps. Skip step 1 only if there's genuinely nothing worth promoting — don't pad the section with vague restatements of the conversation.

## What you're NOT doing

- **Not writing a separate file.** The old `.claude/handoff.md` is gone. There's no document to write, no template to fill in beyond the three section bodies passed to the MCP tool.
- **Not touching other agents' sections.** Even if you see another agent's section in `current.md` with stale `Last updated`, leave it alone. Use `indusk agent prune` if you want to clean up stale entries — it operates on TTL, not session identity.
- **Not overwriting the `Project (shared)` section.** That section is for cross-cutting project state (any agent can edit it) — not session handoffs. If you need to update shared state, do it as a separate explicit edit; don't bundle it into your handoff write.

## Why it works this way

The old singleton `.claude/handoff.md` had two reliable failure modes:

1. `/catchup` mutated the file while another agent was reading it (checkbox state machine), so concurrent catchups would block or corrupt each other.
2. `/handoff` overwrote whatever was in the file, so two sessions handing off destroyed each other's content.

The section-shape design makes both impossible: each agent's section is keyed by session ID, the MCP tool's atomic read-modify-write only touches that section, and git merges different-section edits without conflict. See [the ADR](apps/docs/src/decisions/multi-agent-coordination.md) for the full rationale.
