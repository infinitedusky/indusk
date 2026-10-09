---
title: "VS Code extension — Test Plan"
date: 2026-10-08
status: accepted
---

# VS Code extension — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows this document is constrained by "what makes all these assertions true?" rather than invented from intuition.

A `unit` row feeds the editor's rules a file's text, a registry, the health a reader returns and a clock, and reads what the editor would show; nothing starts VS Code. A `contract` row runs the packaged extension in a real VS Code. A `live check` row is run once by hand against the demo app and recorded in the plan.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** Describe what the user sees, what the API returns to a caller, what an external observer measures — never internal function calls, return types, or method signatures. If a non-engineer stakeholder couldn't read an assertion and understand it, rewrite it.

### `a-promise-shows-where-it-is-kept` — every line that carries a promise's token shows the promise's name and its state

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A line carrying a promise's token shows, at the end of the line, the promise's name and its state: holding, broken, not seen, or watched by the tests. | unit |
| A2 | A line carrying the token of a promise the project does not have says so, rather than showing nothing. | unit |
| A3 | A line in a test that carries a promise's token shows that the test proves the promise, not that the line keeps it. | unit |
| A4 | Hovering a marked line shows the promise's sentence, its state for each source, and when it last held or broke. | unit |
| A5 | With the extension installed, opening the demo app's telemetry file in VS Code shows its promise on the line that marks it. | live check |

### `the-editor-shows-the-same-health-as-the-admin` — the editor's state is the admin's, from one reader

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A6 | For the same project and the same recorded marks, the editor, the admin and `indusk promises status` give every promise the same state for each source. | unit |
| A7 | Promise health is worked out in one place that the admin, the CLI and the editor all use; a second copy fails the build. | unit |

### `a-break-reaches-the-editor` — a break shows within ten seconds of being readable, without a reload

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A break that becomes readable from its source shows within two reads (ten seconds at the five-second cadence) on the line that keeps the promise, in the Problems list, and in one notification, with no reload. | unit |
| A9 | A break read again on the next pass does not notify again; a break that is fixed clears from the line and the Problems list. | unit |
| A10 | When a source cannot be read, or reads watcher blind, the editor says so for that source, never "holding". | unit |
| A11 | With the demo app running, turning on its fault switch makes the editor show the promise broken within ten seconds. | live check |

### `a-break-opens-a-fix-in-one-click` — one action starts the developer's own `claude` with the break's facts

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | The fix action on a broken promise opens a terminal in the project running `claude`, whose first message names the promise, its symptom, its trace link and the tests that prove it. | unit |
| A13 | Where `claude` is not installed, the fix action says how to install it and opens nothing. | unit |
| A14 | On the demo break in VS Code, one click starts `claude` with those facts. | live check |

### `the-editor-only-shows` — the extension writes nothing to the project

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | After the extension reads a project, shows a break and runs the fix action, the project's files are exactly as they were. | unit |

### `every-promise-is-listed-in-the-editor` — a panel lists every promise with its state, broken first

Added 2026-10-08 with the promise, after Sandy tried the build.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A23 | The panel lists every promise in the project with its state; broken promises come first as cards, the latest break first, with the source and symptom; the rest follow by name. | unit |
| A24 | Opening a promise in the panel shows its tests and the places that keep it, each with its file and the line its token is on; a file that no longer carries the token is listed without a line. | unit |
| A25 | On the demo app in VS Code, the panel shows the demo's promise, and choosing its telemetry location opens `src/telemetry.ts` at the token's line. | live check |

### `the-editor-shows-each-run-as-it-happens` — an activity section adds each run as it arrives

Added 2026-10-08 with the promise.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A26 | Each health line names the newest recorded runs of every promise, each with whether it held or broke, its source, its time and, for a break, its symptom; the same run is named the same way on every line. | unit |
| A27 | The activity section adds only runs it has not shown, newest first, keeps a bounded number, and says when no run has arrived yet. | unit |
| A28 | On the demo app, holding a seat adds a "held" run to the activity section, and a faulted hold adds a "broke" run. | live check |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A16 | The packaged extension installs into VS Code with one `indusk` command, activates in a project that has InDusk, and stays inactive in one that does not. | contract | the install path the demo and every new developer take; VS Code is not ours |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | The same package installs and works in Cursor. | Cursor's extension host is not scriptable here, and its compatibility with VS Code's API is Cursor's to keep. | Installed and opened by hand on the demo app at the rehearsal, recorded in the plan; the install command names Cursor's CLI when it finds it. |

## Notes

- A6 and A7 decide the ADR's main question: health has to come from one reader the admin and the editor share, wherever it lives.
- A8's ten seconds count from "readable from its source"; how long a production server takes to index a mark is not the editor's.
