---
title: "Impl tasks are written as instructions"
date: 2026-10-17
status: draft
workflow: bugfix
description: "A task in a new impl reads as work to do — \"Make the prompt box's text area use the app's font\" — and a verification item as what must hold once it is done. The planner and the ritual templates say so; impls written before still validate."
---

# Impl tasks are written as instructions — Brief

Moved out of `mark-first` (Tests and telemetry linked to clauses) on
2026-10-17 so it lands without waiting on it (Sandy). Settled by Sandy on
2026-10-15: today the planner tells a task to say "what will be true when it is
done", so a checklist reads as a list of outcomes, and a person reading a phase
cannot tell the work from the checks.

## Expectations

1. **A phase's checklist reads as work to do.**
   - Measure: in impls approved after this lands, the share of task lines that open with an instruction ("Make…", "Add…", "Move…") rather than a state ("The prompt box draws…"); expect nearly all.
   - Look: at the next three impls approved.

## Promises

### This plan makes

None — the promise it keeps exists; its sentence changes to say more.

### Existing promises

**Must not break**

- **`hidden-detail-is-only-read`**. A task's folded technical detail is still only read; the wording change touches the task line alone.

**Changes**

- **`an-impl-phase-explains-itself`**. Every phase of a new impl opens with a plain summary saying what it does for the whole plan; every task is one plain instruction saying what to do, and every verification item one plain statement of what must hold, each with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused.

**Replaces**

None.

### Not promised

- A check that refuses a task written as a state. Whether a sentence is an instruction is a person's call at approval, as whether it is plain is today.
- Rewriting impls already written.

## Looks

None — the change is to the planner's instructions and templates; no screen changes, and the plan page draws a task line as it does today.

## Depends On

- None.

## Blocks

- None.
