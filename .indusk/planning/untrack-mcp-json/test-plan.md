---
title: "Untrack .mcp.json — Test Plan"
date: 2026-10-11
status: draft
---

# Untrack .mcp.json — Test Plan

## Purpose

The behavioral assertions that, together, mean this repository no longer versions a machine's MCP config and a checkout without one gets one from a command. Grouped by the promise in the [brief](brief.md) they prove; each names the smallest level that proves it.

## Behavioral Assertions

### `the-mcp-config-is-not-tracked` — `.mcp.json` is not tracked in this repository, and the ignore rule that says so holds.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T1 | `git ls-files .mcp.json` lists nothing in this repository. | unit |
| T2 | `git check-ignore .mcp.json` reports it as ignored, so a regenerated copy shows up as nothing in `git status`. | unit |

### `a-clone-without-an-mcp-config-gets-the-keep-list` — one command writes `.mcp.json` from the project's declared servers, and never overwrites one.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T3 | In a checkout with no `.mcp.json`, running `indusk update` leaves one that names the `indusk` server. | unit |
| T4 | In the same checkout with an enabled extension that declares an MCP server to add (a fixture extension), `indusk update` also leaves that server in the file. | unit |
| T5 | In a checkout where `.mcp.json` already exists with a server the person added by hand, running `indusk update` leaves that server and its settings exactly as they were. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| T6 | A telemetry daemon restart that moves the jaeger port leaves `git status` clean in a checkout that has no tracked `.mcp.json`. | unit | the expectation this plan exists for: the churn stops; a regression guard over the daemon's sync |

## Untestable Assertions

None.

## Notes

- T1 and T2 read this repository's own git state; T3–T5 and T6 run `update` and the sync against a temp checkout built in the test.
- The measurement that motivated T3 (update creates nothing today) is in [research.md](research.md).
