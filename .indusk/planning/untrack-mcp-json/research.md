---
title: "Why .mcp.json is tracked here, and whether a clone can rebuild it"
date: 2026-10-11
status: in-progress
workflow: bugfix
---

# untrack-mcp-json — Research

## Background

`.mcp.json` is tracked in this repository although `.gitignore` line 25 lists it and `indusk init` writes that rule in full mode ("contains auth tokens"). It was committed in the initial scaffold (2026-03-19, `02c0c36a`); the ignore rule arrived six days later, and git keeps tracking a file once it is tracked. 26 commits touch it, among them "jaeger MCP port resynced by the daemon restart" and "indusk update to 1.55.1". The telemetry daemon rewrites the `jaeger` URL's port in every registered project's file on each start (`telemetry.ts` `syncAllRegisteredProjectsMcp`), so the file is dirty most of the time.

## Findings

- Its content today: `indusk` (stdio, `indusk serve`, `PROJECT_ROOT: "."`), `jaeger` (http, a port that changes per daemon start), `posthog` (http). Only the jaeger port is machine-specific. No token is in it now; the ignore rule's reason is for projects that add one.
- **Measured 2026-10-11, in a throwaway clone with `.mcp.json` removed:** `indusk update` creates **no** `.mcp.json` (its MCP handling is guarded by the file existing, and the extensions it prints "MCP server setup — see SKILL.md" for have no `add_command`); `indusk init` creates one holding **only** the `indusk` server (it also scaffolds OpenTelemetry files, which is why `init` is the wrong command to tell an existing clone to run). So the second promise is not true today and the plan has to make it true. Which servers a clone should get follows from which extensions it has enabled, and `.indusk/config.json` is itself per machine, so the command can only promise `indusk` plus each *enabled* extension's declared server.
- **Regeneration machinery that exists.** `init` adds the indusk server with `claude mcp add -s project -e PROJECT_ROOT=.` (`init.ts` ~line 685); `update` re-registers each enabled extension's declared MCP server idempotently (`update.ts` ~line 652); the telemetry start path upserts the `jaeger` entry. Whether a checkout with no `.mcp.json` ends up with all three after one command is **not yet measured**; the plan's first test does that.

## Decisions

- Untrack rather than template (Sandy, 2026-10-11, "just don't version it"): the file is per machine; a clone generates its own.

## Open Questions

- Does `indusk update` (or `init`) on a checkout with no `.mcp.json` produce the full keep-list, including `jaeger` and `posthog`? If not, what is missing, and does it belong in a tracked default (a `.mcp.json.example`) or in the command?
- Pulling the untracking commit deletes the file from every existing clone's working tree (git removes a path dropped from tracking). Whatever regenerates it must be what a person runs after pulling, and the retrospective should say so.
