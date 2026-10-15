---
title: "Story-first impl phases"
date: 2026-10-14
status: accepted
workflow: feature
description: "Every impl phase opens by saying, in plain words, what it does for the whole plan, and every task reads as one plain sentence with its technical detail folded beneath it. A person can follow a plan's phases without reading code, and open the detail when they want it."
---

# Story-first impl phases — Brief

## Expectations

1. **Sandy can say what a phase does without opening any technical detail.**
   - Measure: Sandy's word at approval of the next three plans written in this shape; a "what does this phase do?" asked at approval counts against it
   - Look: at each of the next three plan approvals

## Promises

### This plan makes

1. **`an-impl-phase-tells-its-story`** (state). Every phase of a new impl opens with a plain paragraph saying what it does for the whole plan, and every task is one plain sentence with its technical detail beneath it, written for someone who has worked on the project but knows none of its shorthand: no row labels, no abbreviations, nothing named by a nickname or an unclear pronoun; an impl that leaves out the paragraph or the sentence, or puts a row label in either, is refused.
2. **`technical-detail-opens-on-request`** (state). On a plan's page, a phase shows its paragraph and its tasks' plain sentences, and each task's technical detail stays hidden until a person opens it, then shows formatted, code included.
3. **`hidden-detail-is-only-read`** (state). What is written in a task's hidden detail is only read: it never ticks a box, skips a check or adds a task.

### Existing promises

**Must not break**

- **`gates-ran-at-every-checkoff`**. The checkoff counting in `check-gates.js` changes so detail text no longer counts; every real checkoff must still run the gates.
- **`a-model-override-says-why`**. The phase paragraph sits between the Tier line and the tasks; the Tier line must still be found and checked.
- **`a-plan-page-shows-the-parts-of-its-brief`**. The plan page's phase list changes beside the parts it already shows.

**Changes**

None.

**Replaces**

None.

### Not promised

- That the writing is actually plain. The check that runs when an impl is saved can see that a paragraph and a sentence are there and that no row label is in them; it cannot see a nickname, an abbreviation or an unclear pronoun. Those are the planner's writing prompt's job and a person's judgement at approval, and the expectation above measures them.
- Rewriting impls other than component-content. Existing impls keep validating unchanged; the shape is opted into in the frontmatter, as `trajectory:` and `test_phases:` are.

## Looks

### This plan makes

None.

### Existing looks

**Must not break**

- **`plan.phases`**. The plan page's phases view places the phase row; it changes only through the row.

**Changes**

- **`phase-row.open`**. An open phase shows its paragraph, then its tasks as plain sentences, each with a closed "Technical" disclosure that opens to the formatted detail; the approved look stays held until a person approves this one.

**Replaces**

None.

## Depends On

- None.

## Blocks

- `.indusk/planning/component-content/` — its impl is converted to this shape as this plan's last item.
