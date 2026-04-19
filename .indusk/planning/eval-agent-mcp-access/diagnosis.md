---
title: "Eval Agent MCP Access — Diagnosis"
date: 2026-04-19
plan: eval-agent-mcp-access
phase: 1
---

# Diagnosis

## Confirmed Root Cause

**Hypothesis 2 (MCP servers need explicit flag) — confirmed.**

The `claude --print` invocation in [persistent-evaluator.ts:215-247](apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts#L215-L247) does NOT pass `--mcp-config .mcp.json`. Without that flag, `claude --print` does NOT auto-discover the project's `.mcp.json` from cwd. It only loads global/user-level MCP servers (in this environment: `context7`, `tmux`, `playwright`). The project's MCP servers — `indusk`, `graphiti`, `codegraphcontext`, `dash0`, `excalidraw` — are absent from the subprocess's tool inventory regardless of what's in `--allowed-tools`.

Secondary issue (suspected but not yet definitive): the `--resume` code path also omits `--permission-mode acceptEdits`. If permission-mode doesn't carry across resume, tool calls would be denied even after MCP access is restored. The fresh-session path already has `--permission-mode acceptEdits`, so this only matters for the resume path.

## Evidence

### Test B: `claude --print` WITHOUT `--mcp-config`

**Command:**
```
echo "Call mcp__indusk__get_system_version with no arguments and return the exact result. \
If you cannot call that tool, say 'TOOL NOT AVAILABLE' and list which tools you do have access to." \
  | claude --print --output-format json \
    --allowed-tools "Read,Grep,Glob,mcp__graphiji__*,mcp__indusk__*,mcp__codegraphcontext__*"
```

**Result excerpt** (full output in `test-b-no-mcp-config.json`):
```
"TOOL NOT AVAILABLE

The `mcp__indusk__get_system_version` tool is not available. Here are the MCP tools I have access to:

**context7:**  - mcp__context7__resolve-library-id, mcp__context7__query-docs
**tmux:**      - mcp__tmux__list-sessions, ... (15 tmux tools)
**playwright:** - Multiple browser automation tools

The `indusk` MCP server tools (which would include `get_system_version`) are not currently available in this session."
```

This proves the project's `.mcp.json` is NOT auto-loaded by `claude --print`. Only global/user MCP config is honored without explicit `--mcp-config`. The `--allowed-tools` pattern `mcp__indusk__*` permits nothing because no such tools are loaded into the subprocess.

### Test A: `claude --print` WITH `--mcp-config .mcp.json`

**Command:**
```
echo "<same prompt>" \
  | claude --print --output-format json \
    --mcp-config .mcp.json \
    --allowed-tools "Read,Grep,Glob,mcp__graphiti__*,mcp__indusk__*,mcp__codegraphcontext__*"
```

**Result excerpt** (full output in `test-a-with-mcp-config.json`):
```
"I need user permission to call the mcp__indusk__get_system_version tool. Based on the available tools
I have access to, I can see that the mcp__indusk__* tools are available (I can see many MCP tools in
my tool list including indusk-specific ones like mcp__indusk__list_plans, mcp__indusk__get_context,
etc.).

Would you like to grant permission for me to call mcp__indusk__get_system_version?"

permission_denials: [{ tool_name: "mcp__indusk__get_system_version", ... }]
```

This proves:
1. **`--mcp-config .mcp.json` makes the project's MCP servers visible** — `mcp__indusk__*` tools appear in the subprocess's tool inventory.
2. **Without `--permission-mode`, tool calls are denied** — `--allowed-tools` declares what's *allowed* but Claude still requires user-level permission gating in default mode. The `permission_denials` field in the JSON output records the denial.

The existing evaluator's *fresh* spawn already passes `--permission-mode acceptEdits`, which auto-approves tool calls. The *resume* spawn does NOT pass `--permission-mode`, so resumed sessions may behave like Test A — tools visible but calls denied.

## Why the Working Agent Works (and Why This Looked Mysterious)

The working agent (this interactive Claude Code session) gets `.mcp.json` auto-loaded because it's running in the standard interactive mode, not `--print` mode. That's why I can call `mcp__indusk__highlight` from this session but the spawned evaluator subprocess cannot. The two contexts use different config-discovery paths.

## Proposed Minimal Fix

Two-line change to [persistent-evaluator.ts:215-247](apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts#L215-L247):

1. **Resume args** — add `--mcp-config .mcp.json` AND `--permission-mode acceptEdits`:
   ```diff
     args: [
       "--print",
       "--output-format",
       "json",
       "--resume",
       session.sessionId,
   +   "--mcp-config",
   +   ".mcp.json",
   +   "--permission-mode",
   +   "acceptEdits",
       "--allowed-tools",
       ALLOWED_TOOLS.join(","),
     ],
   ```

2. **Fresh args** — add `--mcp-config .mcp.json` (permission-mode already present):
   ```diff
     args: [
       "--print",
       "--output-format",
       "json",
       "--model",
       "opus",
       "--permission-mode",
       "acceptEdits",
   +   "--mcp-config",
   +   ".mcp.json",
       "--allowed-tools",
       ALLOWED_TOOLS.join(","),
     ],
   ```

The `.mcp.json` path is relative to the spawn's `cwd`, which is `projectRoot` per [eval-trigger.js:296](apps/indusk-mcp/hooks/eval-trigger.js#L296). So a relative `.mcp.json` resolves to the right file without needing absolute paths.

## What Was NOT Tested

- **H3 (resume restores tool inventory)** — not tested because H2 alone is sufficient. If H3 also applies, adding `--mcp-config` to the resume path likely overrides it; if not, future evidence will show.
- **H4 (handshake timing)** — not tested because Test A succeeded synchronously, ruling out a startup race.
- **`--strict-mcp-config` flag** — not used in proposed fix. Without it, both `--mcp-config .mcp.json` AND user/global MCP servers load (additive). That's fine for the evaluator's needs (no conflict). If isolation becomes important later, `--strict-mcp-config` can be added.

## Cost of Diagnosis

Two `claude --print` invocations consumed ~$0.49 in API costs (Test B: $0.16; Test A: $0.33). Cheap enough for confirmation; ran no further variants.
