---
title: "Impl tasks are written as instructions — Test Plan"
date: 2026-10-17
status: accepted
---

# Impl tasks are written as instructions — Test Plan

## Purpose

The planner's instructions are the product, so the tests read what they say,
in the style of `planner-impl-summary-template.test.ts`.

## `an-impl-phase-explains-itself` (changed)

Every task is one plain instruction saying what to do, and every verification
item one plain statement of what must hold.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | The planner's instructions for writing an impl say a task is one plain instruction saying what to do and a verification item one plain statement of what must hold, with a before-and-after pair, and no longer say a task states what will be true. | unit |
| A2 | Every task placeholder in the impl template the planner hands out, and in the falsify and cleanup phase templates, asks for an instruction; every verification placeholder asks for what must hold. | unit |
| A3 | The planning rules a project is shipped say the same, and the project's copy is the same text as the package's. | unit |

## `hidden-detail-is-only-read` (must not break)

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A4 | The impl template and both ritual templates still pass the save check as written, and an impl written before this change still validates. | unit |
