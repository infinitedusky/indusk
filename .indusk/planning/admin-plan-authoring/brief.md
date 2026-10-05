---
title: "Plan authoring from the admin — New plan, through your own Claude Code"
date: 2026-10-04
status: draft
workflow: feature
---

# Admin plan authoring — Brief

## Problem

The admin shows plans but cannot start one. The demo's centre is writing the
first plan from the UI and watching it appear.

## Direction

- A **New plan** action in the admin starts the developer's own `claude` CLI
  headless (`claude -p`, streaming JSON) in the project directory with the
  planner request. Auth is whatever that developer's Claude Code is logged into
  (Claude Max for Sandy); the admin holds no credentials.
- The session streams into a side panel. The planner's questions are answered
  there, and the plan's documents appear in the sidebar as they are written,
  through the admin's existing live refresh.
- The skills and hooks (planner, impl validator, gates) apply as they do in a
  terminal, because it is the same Claude Code.
- This reverses the admin's read-only stance for this one action; every other
  page stays a viewer.

## Out of scope for the demo

A broader visual overhaul, editing documents in place, hosting the admin.

## Success criteria

- From the admin, a person starts a plan, answers its questions, and sees the
  brief appear, without touching a terminal.

## Part of

[indusk-demo](../indusk-demo/master.md), step 3.
