# Bugfix Workflow

Bugfixes skip the ADR, and need no research document — the problem is known and the fix is straightforward. They do not skip the test plan: its first assertion is the failing test that proves the bug.

What is broken, how it shows and how to reproduce it are not the brief's. When that takes more than the title says, write it in a research document's Background; a bugfix may carry one without requiring it.

## Documents Created
- `brief.md` — the promise the bug broke, or the one it shows was never made
- `test-plan.md` — what must be true once it is fixed, starting with the failing test (template in the planner skill)
- `impl.md` — the fix checklist

## Brief Template

A brief holds what the conversation produced: expectations, promises and looks, in the shape `indusk promises contract` reads (the planner skill has the full template and the rules). A bug is a promise that broke, or one that was never made. A fix that changes a file under an app's interface lists the look it touches under `## Looks`, or says why it has none. If a promise in the registry covers what broke, list it under **Must not break** and let the failing test's row name it. If nothing covers it and it should stay fixed, make the promise here.

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
workflow: bugfix
---

# {Title} — Brief

## Expectations

None — {a bugfix: the promise holding again is the point}

## Promises

### This plan makes

1. **`{promise-name}`** ({behaviour | state | structure}). {What will be true once this is fixed, and stay true.}

{Or `None.` when an existing promise already covers it.}

### Existing promises

**Must not break**

- **`{promise-name}`**. {It is broken today; this plan makes it hold again.}

{Or `None.`}

**Changes**

None.

**Replaces**

None.

### Not promised

- {Related improvements that are separate work.}
```

## Impl Template

```markdown
---
title: "{Title}"
date: {YYYY-MM-DD}
status: draft
phase_summary: required
---

# {Title}

## Goal
{Fix the bug described in the brief.}

## Checklist
### Phase 1: Fix

{A paragraph saying what this phase does for the whole plan, written for someone who has worked on the project but knows none of this plan's shorthand.}

- [ ] {One plain instruction saying what to do to fix the bug, such as "Make the prompt box's text area use the app's font".}
  <details><summary>Technical</summary>

  {The fix, be specific: names, paths and code go here.}

  </details>

#### Phase 1 Verification
- [ ] {One plain statement of what must hold: the bug is fixed.}
  <details><summary>Technical</summary>

  {Command that proves the bug is fixed}

  </details>
- [ ] {One plain statement of what must hold: the bug stays fixed.}
  <details><summary>Technical</summary>

  {Regression test if applicable}

  </details>

## Files Affected
| File | Change |
|------|--------|
| `{path}` | {description} |
```
