---
title: "Demo app template — a working app to promise about, deploy and break"
date: 2026-10-04
status: draft
workflow: feature
---

# Demo app template — Brief

*Revised 2026-10-05 after the demo script was reviewed: the template ships
without promises (Sandy's decision), and how it is delivered is said.*

## Problem

The only things that mark promises today are the evaluator and the smoke
script. The demo needs a real, small application that a new project starts
from: something worth making promises about, deployable, with a way to break
one promise on cue.

## Direction

- **A minimal working service (Node) with no promises.** It has two or three
  operations a person would naturally promise something about, and exports
  plain OpenTelemetry to whatever OTLP endpoint its environment names: the
  local daemon on a laptop, the project's server when deployed. The first plan
  written in the demo adds the promises — their marks at the sites and their
  tests. A template that shipped them already marked would leave that plan
  nothing to promise.
- **A fault switch on those operations** (an env var), so one of them can be
  made to misbehave on cue. Once the first plan has marked the operation, the
  switch is what makes the demo's production break reproducible. It belongs
  to the template rather than the plan, so the plan does not have to build its
  own sabotage.
- **A Fly config** for the app, beside the always-on server's.
- **Delivered as a repository to clone.** `indusk init` has no template
  mechanism and the demo does not need one: clone the repository, run
  `indusk init` in it. A `--template` flag can come later if starting from
  templates becomes a habit.

## Success criteria

- A clone of the template runs locally and deploys to Fly with no promise in
  its registry and no promise mark in its code.
- After a plan adds a promise to one operation, flipping the fault switch on
  the deployed app produces a violation of that promise on the project's
  server.

## Part of

[indusk-demo](../indusk-demo/master.md), step 4 in its build order; script
step 1 (start a new project) and the break in script step 6.
