---
title: "Cursor support for InDusk — research"
date: 2026-06-28
status: complete
---

# Cursor support for InDusk — Research

## Question

What does it take to run InDusk's planning/work/verify/document/retrospective discipline inside Cursor — both Cursor's desktop IDE and its cloud Background Agents — without losing the gate-enforcement, presence-bulletin, and eval-on-commit behaviors that Claude Code currently provides via hooks?

## Findings

### 1. Cursor has a hooks API that is more granular than Claude Code's

**Source:** [cursor.com/docs/hooks](https://cursor.com/docs/hooks) (fetched 2026-06-28).

Cursor exposes 21 hook events across three categories:

- **Agent hooks (Cmd+K / Chat):** `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeShellExecution`, `afterShellExecution`, `beforeMCPExecution`, `afterMCPExecution`, `beforeReadFile`, `afterFileEdit`, `beforeSubmitPrompt`, `preCompact`, `stop`, `afterAgentResponse`, `afterAgentThought`.
- **Tab hooks (inline completions):** `beforeTabFileRead`, `afterTabFileEdit`.
- **App lifecycle:** `workspaceOpen`.

Multiple events are richer than what Claude Code currently exposes:
- `beforeShellExecution` / `afterShellExecution` split out from generic `preToolUse` / `postToolUse`, giving cleaner pattern matching (eval-trigger fires on `afterShellExecution` matching `git commit` with no false-positive risk).
- `beforeReadFile` has no Claude Code equivalent — opens redaction / blocking of sensitive files before they reach the model.
- `subagentStart` / `subagentStop` open subagent orchestration that Claude Code doesn't surface.
- `sessionStart` can inject env vars into the rest of the session — see Finding 3.

### 2. Wire protocol is near-identical to Claude Code's

Hooks are spawned processes communicating over **stdio with JSON** in both directions.

Exit codes:
- `0` — success; use JSON output
- `2` — block the action (equivalent to `permission: "deny"`)
- other — fail-open by default; `failClosed: true` per-script for security-critical hooks

Permission outputs for blocking hooks (`preToolUse`, `beforeShellExecution`, `beforeMCPExecution`, `beforeReadFile`, `subagentStart`, `beforeSubmitPrompt`):

```json
{
  "permission": "allow" | "deny" | "ask",
  "user_message": "<shown in UI>",
  "agent_message": "<sent to agent when denied>"
}
```

`preToolUse` can modify tool input via `updated_input`. `postToolUse` can replace MCP tool output or inject `additional_context`. `stop` and `subagentStop` can auto-submit a `followup_message` (loop_limit-capped, default 5).

InDusk's existing hook scripts (`check-gates.js`, `validate-impl-structure.js`, `eval-trigger.js`, `check-catchup.js`) already speak this exact protocol — exit codes, stdio JSON, the same shape of outputs. Translation to Cursor reduces to:

1. New config file location: `.cursor/hooks.json` (vs `.claude/settings.json` `hooks` block).
2. Different input shape per hook event — Cursor's `tool_name` values differ (`Shell` vs `Bash`), and the `tool_input` schema is per-tool not per-event-uniform. Needs a thin adapter (~50 lines).
3. Different matcher syntax (regex/keyword on `tool_name` or shell command text).

### 3. Cursor provides `CLAUDE_PROJECT_DIR` as an env-var alias

Hook environment includes both `CURSOR_PROJECT_DIR` AND `CLAUDE_PROJECT_DIR` pointing at the same path. Every existing InDusk hook script that reads `process.env.CLAUDE_PROJECT_DIR` runs unmodified in Cursor.

### 4. `sessionStart` can inject `CLAUDE_CODE_SESSION_ID` transparently

`sessionStart` input includes a `session_id` field. The hook can return `{"env": {"KEY": "value"}}` to inject environment variables into every subsequent tool execution within that session.

A one-line `sessionStart` hook returning `{"env": {"CLAUDE_CODE_SESSION_ID": "<session_id>"}}` makes `getSessionId()` in `apps/indusk-mcp/src/lib/agents/session.ts` work transparently in Cursor. The multi-agent presence bulletin and `mcp__indusk__update_current_section` need zero code changes.

Cloud agent caveat: `sessionStart` does NOT fire in Cursor Background Agents (no VM on startup). Cloud agents would fall back to the existing `pid-<N>` fallback in `getSessionId()`. Acceptable for v1 — Background Agents are short-lived; the fragmented bulletin entries age out via the stale TTL.

### 5. Config file lookup follows a four-level priority

Enterprise → Team → Project → User:

| Level | Path | Cloud agent? |
|---|---|---|
| Enterprise | `/Library/Application Support/Cursor/hooks.json` (macOS), `/etc/cursor/hooks.json` (Linux), `C:\ProgramData\Cursor\hooks.json` (Windows) | yes |
| Team | Web dashboard at `cursor.com/dashboard/team-content?section=hooks`; synced every 30 min | yes |
| Project | `<project-root>/.cursor/hooks.json` | yes |
| User | `~/.cursor/hooks.json` | no |

For InDusk: project-level (`.cursor/hooks.json`) is the right home. Travels with the repo, loads in cloud agents, doesn't depend on per-developer machine setup. Mirrors the current "init writes hooks into `.claude/settings.json`" pattern.

### 6. Cloud agent hook support is partial

Hooks that run in Cursor's cloud Background Agents:
- `beforeShellExecution`, `afterShellExecution`, `beforeReadFile`, `afterFileEdit`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `preCompact`

Hooks that do NOT run in cloud agents:
- `sessionStart`, `sessionEnd` — no VM on startup
- `beforeSubmitPrompt` — prompt submitted before VM exists
- `beforeTabFileRead`, `afterTabFileEdit` — IDE-only feature
- `workspaceOpen` — IDE lifecycle
- `beforeMCPExecution`, `afterMCPExecution`, `afterAgentResponse`, `afterAgentThought`, `stop` — "not yet wired"

Practical consequence for InDusk in cloud agents:
- ✅ Gate-enforcement validators work (preToolUse + afterFileEdit cover edits)
- ✅ eval-trigger works (afterShellExecution matching `git commit`)
- ⚠️ Session-ID injection falls back to `pid-<N>`
- ⚠️ `beforeMCPExecution` blocking unavailable (so any future hook that wanted to gate MCP calls won't fire in cloud)

### 7. MCP support is native and unchanged

Cursor reads MCP from `.cursor/mcp.json` (and other locations). Same protocol as Claude Code, same server configs. Every InDusk MCP tool — `indusk`, `graphiti`, `dash0`, `jaeger`, etc. — works in Cursor without modification by copying or symlinking `.mcp.json` to `.cursor/mcp.json`.

### 8. Skills don't have a direct equivalent; Cursor offers two near-analogs

Cursor's skills-adjacent surfaces:

- **Rules (`.cursor/rules/*.mdc`)** — auto-included context with glob matching. Closest to "the agent has this knowledge available." Good for ambient conventions ("use pnpm not npm", "follow the planner lifecycle").
- **Commands** — custom invocable prompts (their slash-command equivalent). Closest to "user explicitly fires this skill."

InDusk skills split naturally:
- Process skills (planner, work, verify, document, retrospective, falsify, catchup, handoff, highlight) → Cursor Commands. User invokes them.
- Domain skills (typescript, testing, jj, git, otel) → Cursor Rules with `globs` matching the file types they apply to. Auto-attached.

Both surfaces accept markdown. The canonical sources at `apps/indusk-mcp/skills/*.md` could generate `.cursor/commands/*.md` + `.cursor/rules/*.mdc` via a thin transform.

### 9. No documented headless CLI for Cursor agents

The hooks doc does not mention a `cursor-agent` CLI with `--mcp-config` or `--resume` capabilities (the surface InDusk's eval agent uses against Claude Code via `claude --print`). Cloud agents are accessed via [cursor.com/agents](https://cursor.com/agents) web interface or API.

Unverified — needs a separate spike. If absent, the eval agent stays a Claude CLI subprocess (cleanest). If present with parity, the eval agent gains a configurable driver (`eval.driver: "claude" | "cursor"`).

## Comparison: Claude Code vs Cursor hook capabilities

| Capability | Claude Code | Cursor | Notes |
|---|---|---|---|
| Pre-tool hook | `PreToolUse` | `preToolUse` | Both block-capable |
| Post-tool hook | `PostToolUse` | `postToolUse` | Both can inject context |
| Shell-specific hook | via PreToolUse + matcher | `beforeShellExecution` / `afterShellExecution` | Cursor cleaner |
| File-edit hook | via PostToolUse-on-Write | `afterFileEdit` (+ `beforeReadFile`) | Cursor more granular |
| Subagent lifecycle | none | `subagentStart` / `subagentStop` | Cursor exclusive |
| Session start | via wrapper | `sessionStart` (returns env) | Cursor cleaner, but IDE-only |
| Session end | via `/handoff` skill | `sessionEnd` | Cursor cleaner, but IDE-only |
| Stop / auto-continue | none | `stop` + `loop_limit` | Cursor exclusive (not yet in cloud) |
| Read file | none | `beforeReadFile` | Cursor exclusive |
| Compact | none | `preCompact` | Cursor exclusive (observational) |
| Cloud-agent support | n/a | partial (see Finding 6) | InDusk's hooks land in the supported subset |

Net assessment: **Cursor's hook API is a superset of what InDusk currently uses on Claude Code, with the exception of session-lifecycle hooks not firing in cloud agents.** Porting is mostly translation work, not capability work.

## Open Questions

1. **Does a `cursor-agent` CLI exist with `--mcp-config` and `--resume`?** Determines whether the eval agent can run as a Cursor subprocess or must stay on the Claude CLI. Needs a 30-minute spike against a real Cursor install.
2. **Architecture: Cursor-specific port vs general IDE adapter pattern?** The cleanest design might abstract "IDE adapter" so future IDEs (Continue, Aider, Windsurf, JetBrains AI) port through the same seam. Costs more upfront; saves work later. Decision for the ADR.
3. **Skills → Commands vs Rules split — exhaustive map?** Process skills clearly go to Commands; domain skills clearly go to Rules. Some skills are ambiguous (highlight, eval-review, research). Needs a per-skill table in the impl.
4. **Cloud agent input-shape parity?** Hook input shape examples in the doc are from IDE context. Need to confirm cloud agents send the same shape (or document the differences).
5. **Team-distribution story.** Sandy's job uses Cursor with a team. Does the team want InDusk's discipline? If yes, the team-dashboard hook distribution (synced every 30 min) is the right scaling story; if no, project-level `.cursor/hooks.json` is sufficient and team adoption stays per-repo.

## Sources

- [Cursor Hooks API](https://cursor.com/docs/hooks) — primary reference for findings 1-6
- `apps/indusk-mcp/src/lib/agents/session.ts` — `getSessionId()` + sanitizer; the env-var alias makes this a zero-change port
- `.claude/settings.json` (per-project) — current Claude Code hook config to mirror
- `apps/indusk-mcp/hooks/{check-gates,validate-impl-structure,eval-trigger,check-catchup}.js` — existing hook scripts; speak stdio JSON / exit codes natively
- `apps/indusk-mcp/skills/*.md` — canonical skill sources for the Commands + Rules generation step
- Conversation 2026-06-28 with Sandy (session 2c87e7b6) — established the need driven by his new job starting on a Cursor team
