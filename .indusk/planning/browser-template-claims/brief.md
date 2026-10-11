---
title: "Browser template claims — an entry covers what it names"
date: 2026-10-11
status: accepted
workflow: bugfix
---

# Browser template claims — Brief

What the falsification of `browser-telemetry-leftovers` found, and what was
decided on the way, is in the conversation recorded here and in the archived
retrospective of that plan.

## Expectations

None — this corrects behaviour and one documentation line; nothing is expected to follow that needs measuring.

## Promises

### This plan makes

1. **`a-propagation-entry-covers-what-it-names`** (state). An entry in the browser template's propagation setting sends the click's trace to the requests it names and to no others: an entry with a path covers that path and what is under it, an entry with a default port matches a request whose URL leaves the port off, and an exact entry and a pattern entry treat both the same way.

### Existing promises

**Must not break**

- **`a-click-and-its-server-work-share-a-trace`**. This plan changes how entries are compiled in the template that keeps it; its sentence already says only what holds (in the click's call, not after a native `await`).
- **`init-writes-no-vendor-into-an-app`**. Not touched; `init`'s output does not change.

**Changes**

None.

**Replaces**

None.

### Not promised

- A click's trace across a `.then()` chain, a timer or a native `await`: that needs a context manager the template does not install (zone.js was tried and declined; it does not follow native `async`/`await`). The limit is documented, and the follow-up is in `known-issues.md`. This plan corrects the documentation that said a `.then()` chain follows the click.

## Depends On

- None.

## Blocks

- None.
