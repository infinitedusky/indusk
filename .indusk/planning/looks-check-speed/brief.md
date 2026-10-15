---
title: "Faster look checks"
description: "Check what changed, load each page once, sample in production."
date: 2026-10-12
status: draft
workflow: feature
---

# Looks check speed — Brief

Why, and what storybook-components already fixed, are in
[research.md](research.md).

## Expectations

1. **A change to one or two components is checked in seconds.**
   - Measure: after a change to one component, `indusk looks check admin` finishes in under 15 seconds on this machine, and names every look it skipped as unchanged
   - Look: when this plan's build closes, and at the next UI plan's live check

2. **A full check of the admin finishes in under a minute.**
   - Measure: `indusk looks check admin --all` against a production build, timed, under 60 seconds
   - Look: when this plan's build closes

3. **A deployed app's look is watched without a full run.**
   - Measure: each pass of the production watcher opens a bounded number of looks (a rotation, not a random draw), and every approved look is opened at least once within a stated number of passes
   - Look: at the first deploy of an app with looks after this plan lands

## Promises

### This plan makes

1. **`an-unchanged-look-is-not-reopened`** (state). A look whose snapshot, foundation, declarations and device set are unchanged since it last held is reported held from that result, named as reused, without a browser opening it.
2. **`a-page-loads-once-per-look`** (structure). Each look's page is loaded once; every device and colour scheme is measured on that page by resizing it and switching the scheme in place.
3. **`a-slow-look-never-ends-the-run`** (state). A look that does not load or draw in time is reported unchecked with the reason; every other look is still judged. (Shipped in storybook-components as `openWithinTime`; this plan declares it.)
4. **`the-check-refuses-a-dev-server`** (state). `looks check` against a development server refuses with the command that builds and serves the app, rather than timing out against it.
5. **`production-looks-are-sampled-in-rotation`** (state). The production watcher checks a bounded slice of the approved looks each pass, in rotation, so every look is checked within a known number of passes.

### Existing promises

**Must not break**

- **`tokens-are-held-exactly`**. Reusing a result must never hide a token change: the foundation's hash is part of what a result is reused on.
- **`everyday-tests-never-wait`**. The browser check stays in the system tier.

### Not promised

- Pixel comparison: [mockup-matching](../mockup-matching/brief.md).
- Making the admin's own pages render faster under `next dev`.

## Depends On

- [storybook-components](../storybook-components/) — stories, snapshot hashes, and the timeout and draw fixes this builds on.
