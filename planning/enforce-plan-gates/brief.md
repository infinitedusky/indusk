---
title: "Enforce Plan Execution Gates"
date: 2026-03-21
status: accepted
---

# Enforce Plan Execution Gates — Brief

## Problem

The agent can bypass plan execution gates by editing impl.md checkboxes directly. During poker-agent-runner-1, all 7 phases were executed without calling `advance_plan` once — verification was partial, context updates were skipped for 6 phases, and documentation was skipped entirely. Skill instructions say "REQUIRED" but that's a suggestion, not a constraint.

## Proposed Direction

Use a Claude Code **PreToolUse hook** on `Edit|Write` that intercepts impl.md edits. When the agent tries to check off an item in the next phase while the current phase has unchecked gates, the hook blocks the edit and tells the agent what's missing.

The hook is a Node.js script bundled with the package, installed by `init` into `.claude/hooks/`. It reuses the impl-parser logic to check gate completion. No MCP calls needed — pure file parsing.

**Two enforcement layers:**

1. **Phase transition gate** (hard block) — cannot start Phase N+1 items until Phase N's verification, context, and document items are all checked. The hook blocks the edit with exit code 2 and a specific message.

2. **Advance plan reminder** (soft nudge) — PostToolUse hook on Edit that checks if the agent just completed all items in a phase. If so, injects a message: "Phase N complete — call `advance_plan` to validate before proceeding." This is advisory, not blocking.

## Context

Claude Code hooks fire deterministically — they're not LLM instructions that can be ignored. A PreToolUse hook with `"matcher": "Edit|Write"` fires before every file edit. Exit code 2 blocks the edit and sends stderr to the agent as feedback.

See `planning/enforce-plan-gates/research.md` for the full hooks infrastructure analysis.

## Scope

### In Scope
- PreToolUse hook script (`check-gates.js`) that blocks phase transitions with incomplete gates
- PostToolUse hook script (`gate-reminder.js`) that nudges after phase completion
- Hook installation in `init` (copies scripts to `.claude/hooks/`, adds to settings.json)
- New CLI command `check-gates` for manual gate validation
- Updated work skill to reference the enforcement

### Out of Scope
- Blocking individual checkbox edits within a phase (too restrictive)
- Remote/HTTP hooks (local-only enforcement)
- Enforcing that `advance_plan` is actually called (the hook validates gates directly)
- Retroactive validation of already-checked items

## Success Criteria
- Agent cannot check off Phase N+1 implementation items while Phase N has unchecked gates
- Agent receives specific feedback: "Phase 3 blocked: verification item 'pnpm check passes' unchecked"
- Agent receives a reminder when a phase is fully complete
- Hook is installed automatically by `init`
- Hook does not interfere with normal non-impl edits
- Hook does not block gate items themselves from being checked

## Depends On
- `planning/gsd-inspired-improvements/` (blocker protocol, forward intelligence in impl-parser)
- `planning/mcp-dev-system/` (impl-parser, advance_plan tool)

## Blocks
- None currently
