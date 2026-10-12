---
title: "Looks check speed — research"
date: 2026-10-12
status: draft
---

# Looks check speed — Research

## The problem

Found at storybook-components' live check (Build Phase 8, 2026-10-12).
`indusk looks check` opens every approved look at every reference device in
both colour schemes, each in a fresh browser context: 354 page loads for the
admin today. Against `next dev` on a loaded machine a run took about six
minutes and a single 30-second timeout threw the whole run away; runs also
disagreed, because a story was measured before it had drawn. storybook-components
fixed what was a defect (stories eight at a time, a timed-out look reported
unchecked rather than ending the run, a story measured once drawn: 162s
against a production build). What is left is design: the cost grows with
every look × device × scheme, so an app with 60 components in 4 states is
about 1,440 loads, about eleven minutes as built.

## Where the time went (2026-10-12, measured)

A run against a production build of the admin, sampled every 10s: 162s in
all — about 130s on the screens, one at a time, with the admin's server at
70–115% CPU (about 66 page loads at roughly 2s each); about 27s on the 342
story looks, eight at a time, Chromium at about 330% CPU and 1.1 GB. Against
`next dev` the Looks page alone took 86s per load while the machine's swap
was full (17.7 of 18.4 GB).

## Directions

- **Check only what changed.** Every story and mockup already has hashes
  (snapshot, foundation, declarations) that approvals bind to; a result kept
  per hash lets an unchanged look be skipped.
- **One page load per look.** Resize the viewport and switch the colour
  scheme in place, measuring after each, instead of a fresh context for each
  device × scheme: about 6× fewer loads.
- **Never against a dev server.** Refuse it, or build and serve the app.
- **Sample in production.** A bounded slice per watcher pass, in rotation, so
  coverage is guaranteed within N passes; a random draw can miss a break for
  a long time.

## Open questions

- Does resizing a page in place give the same computed values as a fresh load at that size? It does for media queries; a component that measures itself on mount (`LookFrame.tsx`) may not. The research step checks this before the ADR.
- Where is the last result kept: next to the approvals in `.indusk/mockups/<app>/` (committed, shared), or in machine state (`~/.indusk/projects/…`)? A committed result lets a reviewer trust it without rerunning; a stale one is the risk.
- How many looks per production pass, and how often: a cost the person deploying sets, with a default.
