---
title: "Enforce Plan Execution Gates"
date: 2026-03-21
status: accepted
---

# Enforce Plan Execution Gates

## Y-Statement

In the context of **an AI-assisted dev system where the agent executes impl checklists with verification, context, and documentation gates per phase**,
facing **the agent bypassing gates by editing impl.md checkboxes directly without validating gate completion, as demonstrated in the poker-agent-runner-1 incident**,
we decided for **a PreToolUse hook on Edit|Write that blocks phase transitions when gates are incomplete, plus a PostToolUse reminder to call advance_plan**
and against **relying solely on skill instructions, making advance_plan mandatory via prompt injection, or using an agent hook for validation**,
to achieve **deterministic enforcement that the agent cannot skip gates, with specific feedback about what's missing**,
accepting **a small performance cost on every Edit/Write operation and the complexity of bundling and installing hook scripts**,
because **hooks are the only mechanism in Claude Code that provides system-level enforcement rather than LLM-level suggestions, and the postmortem proved that instructions alone are insufficient**.

## Context

The poker-agent-runner-1 postmortem revealed that all gate enforcement was advisory. The agent executed 7 phases without calling `advance_plan` once, skipped context updates for 6 phases, and skipped all documentation. The skill text said "REQUIRED" but nothing enforced it.

Claude Code hooks provide deterministic control: PreToolUse fires before every tool call and can block it (exit code 2). This is a system constraint, not an LLM instruction.

See `planning/enforce-plan-gates/research.md` for the hooks infrastructure analysis and `brief.md` for the enforcement approach.

## Decision

### Hook Architecture

Two hooks, both triggered by `Edit|Write` operations:

**1. `check-gates.js` (PreToolUse — hard block)**

Fires before every Edit or Write. Logic:

```
1. Read tool_input from stdin (JSON with file_path, old_string/new_string or content)
2. If file_path doesn't match **/impl.md → exit 0 (allow)
3. Detect if a checkbox is being changed from [ ] to [x]
4. If no checkbox change → exit 0 (allow)
5. Determine which phase the checked item belongs to
6. If the item is in a gate section (verification/context/document) → exit 0 (allow — checking off gates is fine)
7. If the item is an implementation item, check if all previous phases' gates are complete
8. If all previous gates are complete → exit 0 (allow)
9. If any previous gate is incomplete → exit 2 with message listing missing items
```

The message format:
```
Phase 3 blocked: complete these items first:
  [verification] pnpm turbo test --filter=@infinitedusky/indusk-mcp passes
  [context] Update Current State: Phase 2 complete
  [document] Write reference page at apps/indusk-docs/...
```

**2. `gate-reminder.js` (PostToolUse — soft nudge)**

Fires after every Edit or Write. Logic:

```
1. Read tool_input and tool_output from stdin
2. If file_path doesn't match **/impl.md → exit 0 (silent)
3. Parse the impl file after the edit
4. Check if the current phase is now fully complete (all items including gates)
5. If yes → stdout a reminder message: "Phase N complete. Call advance_plan to validate gates before starting Phase N+1."
6. If no → exit 0 (silent)
```

This is advisory — it doesn't block. The reminder appears in the conversation as additional context.

### Parsing Logic

The hook scripts import the impl-parser directly from the installed package. The parser already handles:
- Phase detection (`### Phase N: Name`)
- Gate sections (`#### Phase N Verification|Context|Document`)
- Checkbox state (`- [ ]` vs `- [x]`)
- Blocker detection (`blocker:` lines)

For the PreToolUse hook, we need to additionally determine:
- Which item is being checked (from the Edit's old_string → new_string diff)
- Which phase that item belongs to
- Whether it's an implementation item or a gate item

### Hook Installation

`init` installs hooks by:

1. Copying `check-gates.js` and `gate-reminder.js` to `.claude/hooks/`
2. Adding hook configuration to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/check-gates.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/gate-reminder.js"
          }
        ]
      }
    ]
  }
}
```

`update` syncs the hook scripts (by content hash) but doesn't touch user-added hooks.

### Performance

The hooks fire on every Edit/Write, but the fast path (file isn't impl.md) exits immediately after a string match. Only impl.md edits trigger parsing. The parser is fast — 21 tests run in 35ms.

### Edge Cases

- **New impl being written** — no previous phases exist, so no gates to check. The hook allows all edits.
- **Editing impl text without changing checkboxes** — no checkbox transition detected, allowed.
- **Checking off the very first item** — Phase 1 has no previous phase, so no gates to validate. Allowed.
- **Force override** — if the user explicitly says "skip gates", the agent can add a `<!-- skip-gates -->` comment to the edit. The hook checks for this and allows it. This is an escape hatch, not a default.

## Alternatives Considered

### Rely on skill instructions alone
Rejected — the postmortem proved this doesn't work. The agent ignored "REQUIRED" instructions across 7 phases.

### Agent hook calling advance_plan
Rejected — agent hooks spawn a subagent (slow, 60-second timeout) and add complexity. The parsing logic is simple enough to run directly in a command hook.

### Make advance_plan output mandatory in conversation
Considered as a lighter alternative. The user can see when it's missing. But this still relies on the agent choosing to call it — a softer version of the same problem. Kept as a complement, not a replacement.

### Block every individual checkbox change
Rejected — too restrictive. Checking off implementation items within the current phase should be free-flowing. Only phase transitions need gating.

### PostToolUse only (no blocking, just reminders)
Rejected — reminders are ignorable. The postmortem showed the agent will skip things that aren't enforced. The hard block on phase transitions is the core fix.

## Consequences

### Positive
- Agent cannot skip gates — enforcement is deterministic, not advisory
- Specific feedback tells the agent exactly what's missing
- Soft reminder after phase completion encourages advance_plan usage
- Installed automatically by init — no manual setup
- Fast — non-impl edits exit immediately
- Escape hatch via `<!-- skip-gates -->` for legitimate overrides

### Negative
- Small latency added to every Edit/Write (microseconds for the fast path)
- Hook scripts must be maintained alongside the impl-parser
- If the parser has a bug, it could incorrectly block valid edits

### Risks
- **Parser mismatch** — the hook's parsing must stay in sync with the MCP tool's parsing. Mitigate by importing the same parser module.
- **False blocks** — the hook blocks a valid edit. Mitigate with the `<!-- skip-gates -->` escape hatch and clear error messages.
- **User confusion** — hooks are new to most users. Mitigate with clear documentation and init output explaining what was installed.

## References
- `planning/enforce-plan-gates/research.md`
- `planning/enforce-plan-gates/brief.md`
- Claude Code hooks documentation
- poker-agent-runner-1 postmortem
