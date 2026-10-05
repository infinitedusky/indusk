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
[promise-timeline](../archive/promise-timeline/brief.md) is built: a throwaway script
that starts `claude -p` in a scratch project, sends the planner request,
answers one question, and lets one file edit through. If any of the three
cannot be made to work, the demo's script changes, and it is cheaper to learn
that before building around it.

## Spike findings (2026-10-05)

Run against `claude` 2.1.197 on Sandy's Max login, in a scratch project with
InDusk installed (`indusk init --local`), from a 100-line Node script that
starts `claude -p --input-format stream-json --output-format stream-json
--verbose --permission-prompt-tool stdio` and plays the person's part. All
three unknowns work.

1. **A question answered — works, including the real planner.** A call to
   `AskUserQuestion` arrives on stdout as a `control_request` (`subtype:
   can_use_tool`, `tool_name: AskUserQuestion`) carrying the questions and
   their options as structured data. The script answers with a
   `control_response` whose `updatedInput.answers` maps each question's text
   to the chosen label, and Claude continues with it ("Your questions have
   been answered"). Driven through `/planner`, the skill loaded, asked two
   questions, received both answers, and wrote its brief.
2. **A permission prompt answered — works.** Any tool call that needs
   permission arrives as the same `can_use_tool` request; `behavior: allow`
   or `deny` in the response decides it. Two cautions:
   - **Which calls ask is the developer's own settings.** Sandy's global
     settings allow most commands, so few were asked. The admin must pass
     `--permission-mode default` explicitly: without it the session inherits
     the developer's `defaultMode` (Sandy's is `auto`), nothing is asked, and
     in the first run a write to a mistyped path outside the project went
     through unasked.
   - **A new project is untrusted.** `claude` printed "Ignoring 9
     permissions.allow entries from .claude/settings.json: this workspace has
     not been trusted". A project created in the demo must be trusted
     (`hasTrustDialogAccepted` in `~/.claude.json`) or its own allow-list is
     ignored — the same cause as half of
     `i-2026-10-03-every-commit-evaluated`.
3. **A long session — works.** A `control_request` with `subtype: interrupt`
   stops a running session cleanly: an acknowledgement, a final result
   (`error_during_execution`), and the process exits. A new process started
   with `--resume <session_id>` continues the same conversation: asked what it
   had been doing, it answered correctly. A browser reload is irrelevant,
   because the admin server owns the process; an admin restart resumes by
   session id.

Also observed:

- **Hooks run headless.** `trunk-guard` refused a write on `main` exactly as
  in a terminal, and Claude asked how to proceed, through the same question
  relay.
- **`--permission-prompt-tool stdio` is not in `claude --help`.** It is the
  protocol the Agent SDK uses underneath, so it is maintained, but it is not
  a documented CLI contract. Two options for the build, to decide in the ADR:
  drive the CLI directly, pinned by a test that runs these three exchanges
  against the installed `claude`; or use the official Agent SDK
  (`@anthropic-ai/claude-agent-sdk`, `canUseTool`), which wraps exactly this
  protocol — if it runs on the developer's own login, which this spike did
  not check. The brief's "no Agent SDK" was written before the protocol was
  known and should be revisited, not assumed.
- **`indusk init`'s closing instructions are stale.** They say `indusk infra
  start` and `init` writes a `.cgcignore`, both left over from the retired
  Graphiti/CGC setup. The demo's first step shows that output; fix it before
  recording.

The driver script is not kept in the repository; the protocol shapes above are
what the build needs.

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
