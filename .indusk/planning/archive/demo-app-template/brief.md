---
title: "Demo app template — a seat-holds app whose promise breaks on cue"
date: 2026-10-07
status: accepted
workflow: feature
---

# Demo app template — Brief

*Rewritten 2026-10-07 from the 2026-10-04 draft, after the master's new order
("Now — show the promise loop"). What changed and why is in
[research](research.md).*

## Expectations

1. **People who see the demo understand the promise loop.**
   - Measure: at the Lazer showing, how many people ask to try it, or ask how the break was caught; after launch, stars and clones of the example.
   - Look: after the Lazer showing, and a week after launch.
2. **The break shows up fast.**
   - Measure: in the recorded rehearsal, the time from opening the example to the promise showing broken, under two minutes.
   - Look: at the demo rehearsal.

## Promises

### This plan makes

1. **`the-demo-app-starts-with-its-promise-holding`** (state). Copying the seat-holds example and running its start command gives a project that runs locally: a page for holding and booking seats, one promise already marked and tested, and that promise shown holding in the admin.
2. **`the-demo-break-is-caught-locally`** (state). Turning on the seat-holds example's fault switch makes its promise show broken in the admin within seconds, with the span that broke it, and it stays broken after the switch is off, until the break is recorded and fixed.

### Existing promises

**Must not break**

- **`everyday-tests-never-wait`**. The example is tested with the package; a test that starts it, the daemon or a browser belongs in the system tier.

**Changes**

None.

**Replaces**

None.

### Not promised

- **A production break.** The Fly config ships in the example and its deployed page is promised to answer; the break in production is the demo's second act, with [server-provisioning](../server-provisioning/brief.md).
- **Recording the break as an incident without a command.** That is [incident-recording](../incident-recording/brief.md).
- **Seeing the break in the editor.** That is the VS Code extension, its own plan.
- **The example's own promises**, `a-held-seat-is-released-in-time` (a seat held and not booked is released when its hold window passes; the window is a few seconds in the demo) and `the-deployed-demo-page-answers` (after the example is deployed to Fly from its own config, its page answers at the deployed address). They live in the example's registry, not InDusk's; this plan ships them, and the planner adds more on camera. The deploy promise was made here first and moved to the example's registry at Build Phase 4 (2026-10-07): the code that keeps it is the example's Dockerfile and `fly.toml`, and a copied example may carry only its own tokens.

## Depends On

- None. The promise mark, the local daemon and the admin's promise page exist (day-monitor, promise-sources, promise-timeline).

## Blocks

- [incident-recording](../incident-recording/brief.md) and the VS Code extension use the example as their test bed; demo-rehearsal records it.
