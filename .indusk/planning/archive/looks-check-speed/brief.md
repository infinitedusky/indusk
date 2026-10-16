---
title: "Faster look checks"
description: "Check what changed, load each page once, sample in production."
date: 2026-10-12
status: accepted
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


## Promises

### This plan makes

1. **`a-look-check-costs-what-changed`** (state). A look check takes time in proportion to what changed, not to how many looks there are.

Its clauses — written as prose until `plans-are-promises` teaches the brief to
hold clauses: **an unchanged look is not reopened** — a look whose snapshot,
foundation, declarations and device set are unchanged since it last held is
reported held from that result, named as reused, without a browser opening it;
**a page loads once per look** — every device and colour scheme is measured on
that one page, resized and switched in place; **the check refuses a dev
server** — against a development server it refuses, naming the command that
builds and serves the app, instead of crawling through it; **a slow look never
ends the run** — one that does not load or draw in time is reported unchecked
with the reason, and every other look is still judged (shipped in
storybook-components as `openWithinTime`, declared here); **one look can be
asked for** — `--only <look>` checks just the named looks.

### Existing promises

**Must not break**

- **`tokens-are-held-exactly`**. Reusing a result must never hide a token change: the foundation's hash is part of what a result is reused on.
- **`everyday-tests-never-wait`**. The browser check stays in the system tier.

### Not promised

- **Production looks sampled in rotation** — the watcher runs continuously, so by `promise-core`'s sorting rule it belongs to `workbench-server` (Sandy, 2026-10-16).

- Pixel comparison: [mockup-matching](../mockup-matching/brief.md).
- Making the admin's own pages render faster under `next dev`.

## Looks

None — this plan changes how looks are checked, not how any screen looks.

## Depends On

- [storybook-components](../storybook-components/) — stories, snapshot hashes, and the timeout and draw fixes this builds on.
