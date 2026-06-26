# Handoff

**Deprecated** as of the [handoff-multi-agent](/decisions/multi-agent-coordination) plan. The singleton `.claude/handoff.md` file no longer exists; there is no session-end document to write.

The work that the old handoff was trying to do has been split across surfaces that are already in place:

- **Operational state** (in-flight work, open questions, cursor position) lives in `.indusk/current.md`. Working agents edit it during the session as things solidify. There is no end-of-session snapshot ceremony — the file is current at every moment because agents keep it that way.
- **Presence** (who is currently working) lives in `.indusk/agents/<sessionId>.md`, written on [`indusk agent register`](/reference/cli/agent#agent-register) and removed on [`indusk agent done`](/reference/cli/agent#agent-done). There is no session-end broadcast ceremony — the presence file just exists while the agent is alive.

## What to Do at Session End

The skill is retained as a four-step ritual rather than an artifact:

1. **Promote operational state.** Edit `.indusk/current.md` only if the session produced in-flight reasoning, open hypotheses, or cursor-position context the next agent will want. If the session shipped a feature and closed a plan, `current.md` may not need to change at all.
2. **Commit your changes.** Including the `current.md` edit if you made one. Other agents only see committed state — your working tree is invisible to them.
3. **Run `indusk agent done`.** Removes your presence file. Other agents stop seeing you within seconds.
4. **Fire the eval trigger.** So the eval agent processes any unprocessed highlights before the session ends:
   ```bash
   node .claude/hooks/eval-trigger.js --source handoff
   ```
   The trigger spawns the evaluator in the background and returns immediately.

## Why This Changed

The old handoff model had two failure modes against concurrent agents:

1. `/catchup` mutated `.claude/handoff.md` (a checkbox state machine). While one agent was mid-catchup, the other agent's gate hook saw a partial file and either froze or behaved inconsistently.
2. `/handoff` overwrote a single shared `.claude/handoff.md`. Whichever agent ran handoff second silently destroyed what the first one wrote.

Both failures are structurally impossible in the new model: catchup is pure-read except for the agent's own presence file, and there is no singleton handoff file at all. See the [ADR](/decisions/multi-agent-coordination) for the full rejected-alternatives list.

## Source

The canonical skill lives at `apps/indusk-mcp/skills/handoff.md`. Auto-synced to consumer projects' `.claude/skills/handoff/SKILL.md` via `globSync("*.md")` in `init.ts` and `update.ts`.

## See also

- [Multi-Agent Coordination ADR](/decisions/multi-agent-coordination)
- [Catchup skill](/reference/skills/catchup)
- [`indusk agent` CLI reference](/reference/cli/agent)
