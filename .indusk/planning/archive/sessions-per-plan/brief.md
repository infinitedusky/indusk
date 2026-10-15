---
title: "Sessions per plan"
date: 2026-10-14
status: accepted
workflow: feature
description: "Lets several plans have an agent at once: a session belongs to its plan, so starting one no longer waits on another plan's, and a machine-wide cap keeps the number sane."
---

# Sessions per plan — Brief

*Opened 2026-10-14. Sandy tried to start a new plan while `component-content` had a
planning session open and was refused: "a session is already running: planning for
component-content — stop it first". Sandy: "we need to scope agents so that we can run
things in parallel." The first small plan of the parallel-first direction
(`approve-then-improve`'s draft). A draft; nothing is declared.*

## Expectations

1. **Several plans move at once.**
   - Measure: the most sessions running together on this machine in a day, and how
     often a start is refused, over the week after landing against the week before.
   - Look: one week after this plan lands.

## Promises

### This plan makes

1. **`a-session-belongs-to-its-plan`** (state). A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same plan is refused, naming the session already running, so a plan can have a planning session and a build at the same time.
2. **`sessions-are-capped`** (state). The number of sessions running together on a machine is capped by sessions.max in the InDusk home's config.json (~/.indusk/config.json), 4 by default; a start beyond the cap is refused, naming the sessions running and how to stop one.

### Existing promises

**Must not break**

- **`a-session-can-be-stopped`**. Each running session is stopped on its own; stopping
  one leaves the others running.
- **`a-session-says-how-it-ended`**. Each session's end is recorded for its own plan.

**Changes**

None.

**Replaces**

None.

### Not promised

- One agent docked beside every page of a plan, following the person between the plan
  page, the brief and the looks. It is the next plan; this one only lets plans run
  side by side.
- Warning when two plans in flight touch the same files or promises.

## Looks

### This plan makes

1. **`agent-panel.already-running`**. The plan's agent panel when a session of the same kind is already running on the plan: the refusal, "A planning session is already running on this plan. Do you want to continue that session here?", and **Continue it here**, which attaches the panel to the running session (added 2026-10-14 at Sandy's request during the build; the rest of the plan changes no screen).

### Existing looks

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

## Depends On

None.

## Blocks

- The docked plan agent (not yet opened).
