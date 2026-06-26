---
name: handoff
description: Deprecated. Session-end checklist — commit any operational state to .indusk/current.md, run `indusk agent done`, fire the eval trigger. The singleton handoff.md file no longer exists.
---

`/handoff` is **deprecated** as of the handoff-multi-agent plan. The singleton `.claude/handoff.md` is gone. There is no shared handoff document to write or overwrite. If you came here looking for the old "write a handoff file" flow, that's not what closes a session anymore.

The work that the old handoff was trying to do is now split across two surfaces, both of which are already in place:

- **Operational state** (in-flight work, open questions, cursor position) lives in `.indusk/current.md`. Working agents edit it during the session as things solidify, and commit the edits like any other file. There is no end-of-session "snapshot" ceremony — the file is current at every moment because agents keep it that way.
- **Presence** (who is currently working on this project) lives in `.indusk/agents/<sessionId>.md`, written on `indusk agent register` and removed on `indusk agent done`. There is no session-end "broadcast" ceremony — the presence file just exists while the agent is alive.

The architecture rationale is in [`apps/docs/src/decisions/multi-agent-coordination.md`](../../docs/src/decisions/multi-agent-coordination.md). The CLI reference is in [`apps/docs/src/reference/cli/agent.md`](../../docs/src/reference/cli/agent.md). The guide is in [`apps/docs/src/guide/multi-agent.md`](../../docs/src/guide/multi-agent.md).

## What to do at session end

There is no document to write. There is a small ritual:

1. **Promote any operational state that's worth carrying to the next session.** Edit `.indusk/current.md` if the session produced in-flight reasoning, open hypotheses, or cursor-position context that the next agent (or the next session of yourself) will want. Don't dump everything — `current.md` is for the operational layer (what's happening NOW), not the architectural layer (CLAUDE.md). If the session's output is "feature shipped, plan closed" then `current.md` doesn't need to change.

2. **Commit your changes.** Including the `current.md` edit if you made one. This is what makes the change visible to other agents — they only see committed state, never your uncommitted working tree.

3. **Run `indusk agent done`.** Removes your presence file. Other agents stop seeing you within seconds. Silent no-op if the file is already gone.

4. **Fire the eval trigger.** So the eval agent processes any unprocessed highlights before the session ends. Highlights written after the last `git commit` would otherwise sit in the queue until the next session's first commit.

   ```bash
   node .claude/hooks/eval-trigger.js --source handoff
   ```

   The trigger spawns the evaluator in the background and returns immediately — it never blocks the session close. If the hook isn't installed or Node isn't on PATH, the highlights remain queued for the next `git commit` in a future session.

## When this skill fires

- `/handoff` explicitly (legacy users running the old command)
- The user says "wrap up", "hand off", "let's stop here"
- About to run out of context

In any of those cases, walk the four-step ritual above. Do not write a `handoff.md` file. Do not edit any other agent's presence file. The whole point of this rewrite is that there is no shared mutation surface at session end.

## Why this changed

The old handoff model had two failure modes against concurrent agents:

1. `/catchup` mutated `.claude/handoff.md` (a checkbox state machine). While one agent was mid-catchup, the other agent's gate hook saw a partial file and either froze or behaved inconsistently.
2. `/handoff` overwrote a single shared `.claude/handoff.md`. Whichever agent ran handoff second silently destroyed what the first one wrote.

Both failures are structurally impossible in the new model: catchup is pure-read except for the agent's own presence file, and there is no singleton handoff file at all. See the ADR for the full rejected-alternatives list (lock-and-snapshot state machine, in-repo bulletin, distributed locks, per-worktree presence).
