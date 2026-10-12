---
title: "Untrack .mcp.json — a machine's MCP config is not versioned, and a clone gets its own"
date: 2026-10-11
status: accepted
workflow: bugfix
---

# Untrack .mcp.json — Brief

What was found and decided is in [research.md](research.md).

## Expectations

1. **A daemon restart no longer dirties this repository.**
   - Measure: `git status --short` after `indusk telemetry restart` lists no `.mcp.json`; and commits touching `.mcp.json` on `main` stop (26 so far)
   - Look: the first week after it lands

2. **Someone who clones the repository reaches a working MCP setup for the indusk server with one command.**
   - Measure: a fresh clone, `indusk update` (or `init`), then `claude mcp list` shows the indusk server
   - Look: the next fresh clone, on another machine

## Promises

### This plan makes

1. **`the-mcp-config-is-not-tracked`** (structure). `.mcp.json` is not tracked in this repository, and the ignore rule that says so holds.
2. **`a-clone-without-an-mcp-config-gets-the-keep-list`** (state). In a checkout with no `.mcp.json`, one `indusk` command writes one that names the `indusk` server, and never overwrites a `.mcp.json` that exists.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

### Not promised

- Several telemetry instances at once, each with its own port: the backlog plan `instance-ports`. This plan only stops the file being versioned.
- Registering other servers (jaeger, posthog) from `indusk update`: jaeger arrives when the `local-telemetry` extension is enabled or the daemon syncs, and posthog needs its token set up by hand; no built-in extension declares a server for `update` to add. A mechanism for that is a separate plan.
- A tracked `.mcp.json.example`: only if the regeneration test shows the command cannot rebuild the keep-list from what is already tracked (see research).

## Depends On

- None.

## Blocks

- None.
