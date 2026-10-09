---
title: "Clean release build — Test Plan"
date: 2026-10-09
status: accepted
---

# Clean release build — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the fix is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove.

## Behavioral Assertions

### `a-release-ships-only-its-own-source` — a release ships only its own source

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A compiled file left in the build folder from a deleted source is gone after the next build. | unit |
| A2 | A release refuses, naming the files, when the package it would publish holds a compiled file with no source in the repository. | unit |
| A3 | After a clean build, the `indusk` command is executable and runs. | unit |
| A4 | The package a release would publish holds no graph-tools, Graphiti, semantic-graph, beam or `infra` code. | unit |

### `commands-take-values-as-arguments` — values reach commands as arguments

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | Removing an extension whose MCP server name contains `"; touch pwned; "` removes the server by that name and creates no `pwned` file. | unit |
| A6 | An eval task named with quotes and `$(…)` makes its baseline commit with the task's name as written, and runs nothing else. | unit |
| A7 | Fetching an extension by a URL or package name holding shell characters passes it to `curl` or `npm` as one argument and runs nothing else. | unit |
| A8 | No source file in the package builds a shell command from a template with a value in it; a new one fails the build. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A9 | The changelog's entry for this release credits Timur Juraev (casablanka) for reporting the graph-tools injection. | unit | a regression guard over the credit the reporter asked for |

## Notes

- A5–A7 run the real commands against stub binaries on a temporary `PATH`, so nothing installs, fetches or commits for real; they record the arguments each stub received.
