---
title: "Display names — Test Plan"
date: 2026-10-09
status: accepted
---

# Display names — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove.

## Behavioral Assertions

### `a-promise-reads-as-words` — a promise reads as words wherever the editor names it in prose

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | The promise `a-break-reaches-the-editor` reads "A break reaches the editor" on its card, its row in the panel, its activity lines and the heading of its hover. | unit |
| A2 | Product names keep their capitals: `a-fly-deploy-is-one-command` reads "A Fly deploy is one command", and `indusk-leaves-main-clean` reads "InDusk leaves main clean". | unit |
| A3 | A project can name its own product words, and they keep their capitals the same way. | unit |
| A4 | Opening a promise in the panel shows its full sentence. | unit |

### `a-plan-reads-by-its-title` — a plan reads by its brief's title

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | The panel's plan group and a broken card's plan read by the brief's title, the part before " — ": `vscode-extension` reads "VS Code extension". | unit |
| A6 | A plan with no brief, or a brief with no title, still reads by its folder name. | unit |
| A7 | Each health line names each promise's plan title alongside the plan, so the editor names plans without reading plan files. | unit |

### `a-plan-shows-when-it-shipped` — a plan shows when it started, landed and was released

Added 2026-10-09 at Sandy's request, after this document was accepted.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A plan's group in the panel shows the date it started (its brief's date) and the date it landed (its retrospective's landing line). | unit |
| A12 | A landed plan shows the release that shipped it — the first release whose changelog names the plan — with its version and date; `vscode-extension` shows 1.68.0, 2026-10-09. | unit |
| A13 | A plan not landed shows only its start date; one landed but in no release yet says "not released yet". | unit |

### `display-names-are-defined-once` — names for people are worked out in one place

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | How a promise or plan is named for a person, and a plan's dates, are defined once, in the package; a second definition in the admin or the extension fails the build. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A9 | The marker at the end of a code line still shows the promise's handle. | unit | a regression guard over a decision in the brief: the marker sits beside the token that spells the handle |
| A10 | On the dusk project in VS Code, the panel's groups read by plan titles and its cards and rows by promise words. | live check | the whole story once, by eye and by the probe |

## Notes

- A7 is the boundary choice the ADR makes concrete: the plan title travels on the health line, as `plan` did.
