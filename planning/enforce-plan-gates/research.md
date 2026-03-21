---
title: "Enforce Plan Execution Gates"
date: 2026-03-21
status: complete
---

# Enforce Plan Execution Gates — Research

## Question

How can we enforce that the agent calls `advance_plan` and completes all gates (verification, context, document) before advancing phases — rather than relying on skill instructions the agent can ignore?

## Findings

### The Problem (from poker-agent-runner-1 postmortem)

During a 7-phase implementation, the agent:
- Never called `advance_plan` once
- Partially skipped verification items
- Skipped CLAUDE.md context updates for 6 of 7 phases
- Skipped all documentation items
- Edited impl.md checkboxes directly, bypassing the gate system

Root cause: `advance_plan` is opt-in. The agent calls it voluntarily. If it doesn't, nothing happens. The skill text says "REQUIRED" but that's an instruction, not a constraint.

### Claude Code Hooks Infrastructure

Claude Code supports 21 hook events. The relevant ones for enforcement:

**PreToolUse** — fires before any tool executes. Can block the action (exit code 2). Receives:
- `tool_name` — which tool is being called (Edit, Write, Bash, etc.)
- `tool_input` — the tool's arguments (file_path, old_string, new_string for Edit)
- `session_id`, `cwd`

**PostToolUse** — fires after a tool succeeds. Cannot block (already executed). Good for side effects.

Hook types available:
1. **Command hooks** — shell scripts, communicate via stdin/stdout/exit codes
2. **Agent hooks** — spawn a subagent with full tool access (can call MCP tools)
3. **Prompt hooks** — single LLM call for yes/no decisions
4. **HTTP hooks** — POST to a remote endpoint

Configuration locations:
- `.claude/settings.json` — project-level, committable
- `~/.claude/settings.json` — global
- Plugin `hooks/hooks.json` — component-level

Matcher patterns: regex on tool name. `"matcher": "Edit|Write"` catches both edit and write operations.

### Enforcement Approach: PreToolUse on Edit|Write

A **PreToolUse** hook with `"matcher": "Edit|Write"` fires before every file edit. The hook:

1. Checks if the file being edited matches `**/impl.md`
2. If not an impl file, allows the edit (exit 0)
3. If it is an impl file, compares old vs new content for checkbox changes (`- [ ]` → `- [x]`)
4. If no checkboxes are being checked, allows the edit (exit 0)
5. If checkboxes are being checked, runs gate validation
6. If gates pass, allows (exit 0). If gates fail, blocks with message (exit 2)

### Gate Validation Options

**Option A: Command hook calling CLI**
- Hook is a shell script that calls `npx @infinitedusky/indusk-mcp check-gates --file <path>`
- The CLI command reuses impl-parser to check gate completion
- Pros: simple, no MCP dependency
- Cons: needs a new CLI command, can't access MCP tools directly

**Option B: Agent hook with MCP access**
- Hook spawns a subagent that calls `advance_plan`
- Pros: reuses existing tool, full MCP access
- Cons: slower (spawns subagent), 60-second timeout, complex

**Option C: Command hook with direct parsing**
- Hook is a Node.js script bundled with the package
- Directly parses impl.md using the same logic as impl-parser
- No MCP or CLI dependency — pure file parsing
- Pros: fastest, self-contained, no external calls
- Cons: duplicates parser logic (or imports it)

### What the Hook Needs to Detect

Not every impl.md edit should be gated. The hook should only block when:

1. A checkbox in a **gate section** (verification, context, document) is being checked without the preceding gate items being complete
2. An **implementation item in the next phase** is being checked while the current phase has unchecked gate items

The hook should NOT block:
- Checking off implementation items in the current phase
- Editing impl.md text (adding notes, updating descriptions)
- Checking off gate items themselves (that's the point)

### Simpler Alternative: Phase Boundary Detection

Instead of validating every checkbox change, only block **phase transitions**:

Detect when the agent starts working on Phase N+1 items while Phase N has unchecked gates. This is simpler because:
- Implementation items can be checked freely within a phase
- Gate items can be checked freely (that's completing the gate)
- Only the transition to the next phase requires all previous gates to pass

Detection: if the edit checks an item that belongs to Phase N+1, check if Phase N's verification/context/document items are all complete.

### Hook Installation

The hook config goes in `.claude/settings.json`. The `init` command can install it:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/check-gates.js"
          }
        ]
      }
    ]
  }
}
```

The `check-gates.js` script would be bundled with the package and referenced by absolute path from the installed location, or copied to `.claude/hooks/` during init.

## Open Questions

- Should the hook be installed by default or opt-in (`init --enforce-gates`)?
- Should we use a command hook (fast, simple) or agent hook (can call MCP tools)?
- Should the hook validate every checkbox or only phase transitions?
- How do we handle the first run where no gates exist yet (new impl being written)?

## Sources

- Claude Code hooks documentation (21 events, PreToolUse can block)
- poker-agent-runner-1 postmortem (the incident that prompted this)
- InDusk impl-parser source (`apps/indusk-mcp/src/lib/impl-parser.ts`)
