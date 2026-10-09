---
title: "Display names — promises and plans read as words"
date: 2026-10-09
status: draft
workflow: feature
---

# Display names — Brief

## Expectations

1. **A person knows what a promise or plan is from the panel, without opening it.**
   - Measure: asked of Sandy at demo-rehearsal, reading the Promises panel cold.
   - Look: at demo-rehearsal.

## Promises

### This plan makes

1. **`a-promise-reads-as-words`** (state). Wherever the editor names a promise in prose — its card, its row in the panel, the activity and the hover — it reads as words with its product names capitalised, and its full sentence is one click away.

2. **`a-plan-reads-by-its-title`** (state). Wherever the editor names a plan, it shows the plan's title from its brief, the part before the dash, rather than its folder name.

3. **`display-names-are-defined-once`** (structure). How a promise or a plan is named for a person is worked out in one place in the package, which the editor reads and the admin can.

### Existing promises

**Must not break**

- **`every-promise-is-listed-in-the-editor`**. The panel's cards, groups and order stay as they are; only the names change.
- **`the-editor-shows-the-same-health-as-the-admin`**. Names come from the same health line.

**Changes**

None.

**Replaces**

None.

### Not promised

- A `title` field on promises — a third name that could drift; revisit if names read as words turn out wrong (research, Decisions).
- The admin's pages using the names — plan-cockpit, the next step.
- The end-of-line marker: it keeps the handle, since it sits beside the token that spells it.

## Depends On

- [vscode-extension](../archive/vscode-extension/brief.md) — the panel this names.

## Blocks

- plan-cockpit, which uses the same names on the admin's pages.
