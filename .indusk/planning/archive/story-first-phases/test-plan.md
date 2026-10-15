---
title: "Phase summaries — Test Plan"
date: 2026-10-14
status: accepted
---

# Phase summaries — Test Plan

## Purpose

The behavioural assertions that, taken together, mean a plan's phases open with a
summary and carry their technical detail folded away, and that the folded detail
changes nothing decided by the two scripts that check an impl file (one when
it is saved, one when a box is ticked). Grouped by the promise in the brief each
proves; each becomes a row of the impl's Test Trajectory.

## Behavioral Assertions

### `an-impl-phase-explains-itself` — Every phase of a new impl opens with a plain summary saying what it does for the whole plan, and every task is one plain sentence with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Writing an impl that has opted in, with a phase that goes straight from its Tier line to its tasks, is refused, and the refusal names the phase. | unit |
| A2 | Writing an opted-in impl whose task line carries code (a backticked name, a path, a command) is refused, naming the task and saying the code belongs in its detail. | unit |
| A3 | The rule holds for every kind of task: a test phase's tasks and a Verification, Context or Document task with its command on the line are refused the same way. | unit |
| A4 | The impl template the planner hands out is itself written in this shape and passes the save check as written. | unit |
| A14 | Writing an opted-in impl whose phase paragraph or task sentence contains a row label (such as A4 or T3) is refused, naming the phase or the task and the label. | unit |
| A15 | A Verification task whose sentence names no row label, with its row labels in its folded detail, satisfies the rule that every Verification section names the tests it proves. | unit |
| A16 | The planner's instructions for writing an impl tell it to write each paragraph and sentence for someone who has worked on the project but knows none of its shorthand, with a before-and-after example. | unit |

### `technical-detail-opens-on-request` — On a plan's page, a phase shows its paragraph and its tasks' plain sentences, and each task's technical detail stays hidden until a person opens it, then shows formatted, code included.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | An open phase on the plan page shows the phase's paragraph above its tasks. | unit |
| A6 | Each task shows only its sentence until "Technical" is opened; opened, the detail shows code as code, a fenced block included, and never shows a `<details>` or `<summary>` tag as text. | unit |
| A7 | A code block inside a task's detail reaches the page whole: nothing in the detail is dropped on the way from the impl to the page. | unit |
| A8 | The open phase row drawn from the real component matches the mockup Sandy approved for it. | live check |

### `hidden-detail-is-only-read` — What is written in a task's hidden detail is only read: it never ticks a box, skips a check or adds a task.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A9 | Editing a task's detail so it contains a ticked box (`- [x] …`) is not treated as a checkoff: no gate is judged and the edit goes through. | unit |
| A10 | A Verification, Context or Document section whose only real task has a detail containing `(none needed)` or `skip-reason:` is still held as a real task, not as a skipped gate. | unit |
| A11 | A box-shaped line inside a task's detail adds no task: the phase's count on the plan page and the count kept by the script that checks a box being ticked both stay the same. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A12 | Every impl in the repository that has not opted in validates exactly as it did before. | unit | a regression guard over the existing plans: the shape is opt-in and must break none of them |
| A13 | component-content's impl, rewritten in this shape, passes the save check and reads on its plan page as the mockup shows. | live check | the first plan converted, the example Sandy asked for |

## Notes

- Code on the line and a row label are the only mechanical readings of "one plain sentence for someone without the shorthand". Whether the sentence is actually plain is a person's judgement at approval, which the brief's expectation measures.
