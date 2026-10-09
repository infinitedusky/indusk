---
title: "VS Code extension — promises in the editor, the break where the fix happens"
date: 2026-10-08
status: accepted
workflow: feature
---

# VS Code extension — Brief

## Expectations

1. **A production break reaches a working fix fast.**
   - Measure: on the rehearsal recording, the time from a production break to `claude` working on it in the editor.
   - Look: at demo-rehearsal, step 7 of the demo; under fifteen seconds expected, the editor reading every five seconds as the admin does.

2. **Developers see promises while they code, not only when one breaks.**
   - Measure: asked of the first developers who join after the launch, whether the markers changed what they did before a break.
   - Look: a month after the launch.

## Promises

### This plan makes

1. **`a-promise-shows-where-it-is-kept`** (state). In a project with promises, every line that carries a promise's token shows the promise's name and its state.

2. **`the-editor-shows-the-same-health-as-the-admin`** (structure). A promise's state in the editor is the one the admin and `indusk promises status` report, for each source, from one reader, never computed separately.

3. **`a-break-reaches-the-editor`** (state). A broken promise shows in the open editor within ten seconds of the break being readable from its source, at the line that keeps it, without a reload.

4. **`a-break-opens-a-fix-in-one-click`** (state). From a broken promise, one action starts the developer's own `claude` in the project with the promise, its symptom, its trace link and its tests already given.

5. **`the-editor-only-shows`** (state). The extension writes nothing to the project; recording and fixing happen through the CLI and the Claude it starts.

6. **`every-promise-is-listed-in-the-editor`** (state). The editor has a panel listing every promise in the project with its state; broken ones come first as cards, the latest break first, and each opens to its tests and the places that keep it, any of which opens the file at that line.

7. **`the-editor-shows-each-run-as-it-happens`** (state). The panel has an activity section that adds each recorded run of a promise as it arrives, newest first, saying whether it held or broke and in which source.

<!-- Promises 6 and 7 added 2026-10-08, after Sandy tried the build: the markers show a promise's state only in a file that is open, and nothing shows runs as they pass. -->

### Existing promises

**Must not break**

- **`a-project-has-one-contract`**. The editor reads promises through the same resolver as every other reader.
- **`the-demo-break-is-caught-locally`**. The editor shows the local break the admin shows, never instead of it.

**Changes**

None.

**Replaces**

None.

### Not promised

- Recording an incident or reopening a plan from the editor — the CLI and Claude do that (incident-recording).
- A Marketplace listing — after the launch.
- Editors other than VS Code and Cursor.
- Promise DevTools in the browser — after the launch, its own plan.

## Depends On

- [promise-sources](../archive/promise-sources/brief.md) — local and production read side by side.
- [server-provisioning](../archive/server-provisioning/brief.md) — a production source to read.
- incident-recording — how a break is named and recorded, so the fix prompt carries the same facts.

## Blocks

- demo-rehearsal, step 7 of [indusk-demo](../indusk-demo/master.md).
