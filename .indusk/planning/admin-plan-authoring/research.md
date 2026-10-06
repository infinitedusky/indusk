---
title: "Plan authoring from the admin — Research"
date: 2026-10-06
status: complete
---

# Plan authoring from the admin — Research

## Question

Can the admin run a plan from end to end (the planning conversation, an
unattended build in its own worktree, a review, and a release) through the
developer's own Claude Code, and what does it need that it does not have?

## Background

The admin shows plans but cannot start or build one. The demo's centre is
writing the first plan from the UI, watching it appear, and building it
without leaving the page (indusk-demo, build-order step 3; script steps 2 and
3). The first brief (2026-10-04, revised 2026-10-05) proposed two actions, New
plan and Build, each starting the developer's own `claude` headless with the
planner or `/work` request, streaming into a side panel. That brief was written
before planner-promises; its problem, direction, unknowns and spike move here.

What the admin does not have today, each a first:

- **No request handler.** `apps/indusk-admin/src/app` has no `route.ts`; every
  page is a server-rendered read.
- **No write path and no child process.** A session outlives the request that
  starts it, so it needs an owner: where the process is tracked, how it is
  stopped, what happens when the admin daemon restarts.
- **Only two pages refresh themselves** (`LiveRefresh` on the plan and Promises
  pages). A plan appearing in the sidebar as it is written needs the page
  holding the panel to refresh as the session reports writes.

## Findings

### The spike (2026-10-05)

Claude 2.1.197 on Sandy's Max login, in a scratch project with InDusk
installed (`indusk init --local`), from a 100-line Node script starting
`claude -p --input-format stream-json --output-format stream-json --verbose
--permission-prompt-tool stdio`. All three unknowns worked.

1. **A question answered.** `AskUserQuestion` arrives on stdout as a
   `control_request` (`subtype: can_use_tool`) carrying the questions as
   structured data; a `control_response` whose `updatedInput.answers` maps each
   question to a label continues the session. Driven through `/planner`, the
   skill asked two questions, received both answers and wrote its brief.
2. **A permission prompt answered.** Any tool call needing permission arrives
   as the same `can_use_tool` request; `behavior: allow` or `deny` decides it.
   The admin must pass `--permission-mode default`: without it the session
   inherits the developer's `defaultMode` (Sandy's is `auto`), nothing is asked,
   and in the first run a write to a mistyped path outside the project went
   through unasked. A new project is untrusted, and its own allow-list is
   ignored until `hasTrustDialogAccepted` is set.
3. **A long session.** A `control_request` with `subtype: interrupt` stops a
   session cleanly. `--resume <session_id>` continues it in a new process. A
   browser reload is irrelevant, since the admin server owns the process.

Also observed: hooks run headless (`trunk-guard` refused a write on `main`);
`--permission-prompt-tool stdio` is the protocol under the official Agent SDK
(`@anthropic-ai/claude-agent-sdk`, `canUseTool`) but is not in `claude --help`;
`indusk init`'s closing instructions name the retired `indusk infra start`.

### Headless sessions and context (2026-10-05/06)

Measured in a scratch project with a root and a subdirectory `CLAUDE.md`, on
Claude Code 2.1.288 and 2.1.289:

- **Nested `CLAUDE.md` files load in headless runs when the Read tool reads a
  file beneath them.** They do not load when the file is read through Bash
  (`cat`, `sed`, `grep`); with the developer's global permissions allowing
  Bash, `--allowedTools Read` does not stop a session reading that way. With
  Bash disallowed the subdirectory's file loaded every time. The nested-context
  probe went red for this reason, not because loading changed.
- **Project hooks fire in headless runs, and a PostToolUse hook's
  `additionalContext` reaches the model.** A hook passed with `--settings`
  instead did not run at all.

So a session the admin starts gets the planning rules and the gates, provided
it reads with the Read tool.

### Where the stops are today

`/work` hands back to the person at impl completion for `/falsify`, `/cleanup`
and `/retrospective` (autopilot calls them "human-gated by design"); under the
default `ask` gate policy it asks before skipping a gate; it pauses on a
declared judgement item (a deferred-verification row, a manual or visual
check). In planner-promises Sandy accepted the test plan, ADR and impl with one
word each, and falsification found fifteen defects without him.

## Decisions

- **Build runs unasked to review, then stops** (Sandy, 2026-10-06). An approved
  plan gets its own worktree and is built through its phases, falsification and
  cleanup without approvals; it then says it is done and shows what it built
  and the evidence. The person tries it (a smoke test, playing with it), and
  only when they accept does the release run: the retrospective, merging to
  `main`, and whatever else the project's release needs. "You don't merge to
  main until you've approved. That's part of the whole thing."
- **Falsify and cleanup are under the hood** (Sandy): they are how the system
  improves its own output, not steps a person approves.
- **One release workflow, built in, for now** (Sandy): workflows are to be
  configurable later, and a workflow may auto-accept a build. Configuring the
  release workflow belongs to `release-checks-run-once`; choosing the plan's
  workflow to `workflow-builder` in the promise-core master.
- **What InDusk is** (Sandy): "a planning and release workflow system and an
  implementation system that's all built on this idea of maintaining promises
  over time."
- **A plan is written on its own branch** (Sandy, 2026-10-06). Starting a plan
  with its type and name creates its branch and worktree; the documents and
  declared promises merge to `main` when the plan is approved, and the build
  continues on the same branch. Why: several people or agents planning on
  `main`'s working tree at once collide (on 2026-10-05 another session's
  unsaved `current.md` edits sat in the way of a landing). Per plan rather than
  one personal planning branch: approving one merges just that plan, and
  dropping a draft is deleting a branch. Approved promises reach `main` before
  any code, so every other plan sees them. Today the worktree is created at
  implementation start, and the trunk guard allows plan documents on `main`;
  both change.
- **Trust is automatic for a trusted project's worktrees** (Sandy, 2026-10-06:
  "Trust automatic"). Found building the session: every plan worktree is a
  path Claude Code has never trusted (`~/.claude.json` held each of this
  repository's worktrees as untrusted, the repository itself as trusted), so
  ADR D1's refusal would have refused every plan. A worktree of a trusted
  project is now trusted like it; a project nobody trusted never is.
- **The planning documents keep their steps.** The approvals discussed were the
  implementation's, not the test plan's or the ADR's.

## Open Questions

- Drive the CLI directly, pinned by a test of the three exchanges, or use the
  Agent SDK, if it runs on the developer's own login? The ADR's.
- How the panel shows evidence: which views, in what order.
- What "cannot continue" means precisely, so a build stops rather than loops.

## Sources

- The first brief, in git history before 2026-10-06.
- planner-promises' retrospective and the 2026-10-05 conversation.
- code.claude.com/docs/en/memory (subdirectory `CLAUDE.md` loading).
