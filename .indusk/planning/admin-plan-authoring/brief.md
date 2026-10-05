---
title: "Plan authoring from the admin — New plan and Build, through your own Claude Code"
date: 2026-10-04
status: draft
workflow: feature
---

# Admin plan authoring — Brief

*Revised 2026-10-05 after the demo script was reviewed: building a plan from
the same panel was added (Sandy's decision), one wrong claim about live
refresh was corrected, and the unknowns and a spike were written down.*

## Problem

The admin shows plans but cannot start one or build one. The demo's centre is
writing the first plan from the UI, watching it appear, and building it
without leaving the page.

## Direction

- A **New plan** action in the admin starts the developer's own `claude` CLI
  headless (`claude -p`, streaming JSON in and out) in the project directory
  with the planner request. Auth is whatever that developer's Claude Code is
  logged into (Claude Max for Sandy); the admin holds no credentials.
- A **Build** action on a plan whose impl is approved runs `/work <plan>` the
  same way, in the same panel. The demo script goes from writing the plan to
  deploying it, and something has to build the code in between; this is it.
  One mechanism, two prompts.
- The session streams into a side panel. The planner's questions are answered
  there. The plan's documents appear in the sidebar as they are written, and
  its phase bars move as items are checked off.
- The skills and hooks (planner, impl validator, gates, trunk-guard) apply as
  they do in a terminal, because it is the same Claude Code. A build runs in
  the plan's worktree, as `/work` does anywhere.
- This reverses the admin's read-only stance for these two actions; every
  other page stays a viewer.

## What the admin does not have today

Each of these is a first for the admin, which is why this plan is larger than
its two buttons:

- **No request handler of any kind.** `apps/indusk-admin/src/app` has no
  `route.ts`; every page is a server-rendered read. Starting a session and
  streaming it needs the first one.
- **No write path and no child process.** The admin has never started a
  process or caused a file to change. A session outlives the request that
  started it, so it needs an owner: where the process is tracked, how it is
  stopped, and what happens to it when the admin daemon restarts.
- **Only two pages refresh themselves.** The plan page and the Promises page
  poll (`LiveRefresh`); the sidebar and the project page do not. A new plan
  appearing in the sidebar "as it is written" needs the page holding the panel
  to refresh as the session reports writes. The first draft of this brief said
  the existing live refresh covered it; it does not.

## Unknowns, and the spike that settles them

The mechanism itself is known to work: the VS Code extension drives the same
`claude` binary over streaming JSON on the developer's own login. What is not
known is whether three things work through that stream from our own process:

1. **A question answered.** The planner asks questions mid-session. Does a
   reply written to the stream reach it as the next turn, and does the
   question tool (`AskUserQuestion`) work headless or only plain-text
   questions?
2. **A permission prompt answered.** `/work` edits files and runs commands.
   Headless, a prompt has nobody to click it. Which of the supported ways fits
   — a permission mode set for the session, or prompts relayed to the panel?
3. **A long session survived.** A build runs for many minutes. Does the
   session keep streaming while the browser tab reloads, and can it be stopped
   cleanly from the panel?

**Spike first, one day**, before the test plan is written and before
[promise-timeline](../promise-timeline/brief.md) is built: a throwaway script
that starts `claude -p` in a scratch project, sends the planner request,
answers one question, and lets one file edit through. If any of the three
cannot be made to work, the demo's script changes, and it is cheaper to learn
that before building around it.

## Out of scope for the demo

A broader visual overhaul, editing documents in place, hosting the admin,
more than one session at a time, running the close-out rituals from the UI.

## Success criteria

- From the admin, a person starts a plan, answers its questions, and sees the
  brief appear, without touching a terminal.
- From the admin, a person builds an approved plan and watches its phases
  close, without touching a terminal.
- A session can be stopped from the panel, and nothing is left running when
  the admin daemon stops.

## Part of

[indusk-demo](../indusk-demo/master.md), step 3 in its build order; script
steps 2 (write the first plan) and 3 (build it).
