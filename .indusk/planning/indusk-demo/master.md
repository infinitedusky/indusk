---
title: "Demo — a new project, start to finish"
date: 2026-10-04
status: living
# Ordered children: the demo path, in build order. Each child is a small plan
# of its own; the parent holds only the script and the order.
subplans:
  - day-always-on-deploy
  - promise-sources
  - promise-timeline
  - admin-plan-authoring
  - demo-app-template
  - server-provisioning
  - planner-promises
  - demo-rehearsal
---

# Demo — a new project, start to finish

**Audience** (Sandy, 2026-10-04): people Sandy wants to join the build effort.
**What they should see**: how you would start a new project with InDusk, and
promises visibly holding in production while it is built. The admin UI is what
gets people excited, so the demo runs through it.
**Format** (Sandy, 2026-10-05): a recorded video, sped up in the edit. Every
wait in it is real — a plan being built, a server being created — and is
shortened afterwards, never faked.

## The script

1. **Start a new project.** It starts from the demo app template: a small
   working app with no promises yet. The local environment and its own
   always-on server come up, and you have a UI.
2. **Write the first plan in the UI.** A "New plan" button runs your own
   Claude Code (Max login, headless CLI) through the planner. The plan
   requires promises, and they appear in the admin as they are declared.
3. **Build it from the same panel.** The panel runs the plan (`/work`). The
   promises go from declared to enforced as their tests pass.
4. **Deploy it.** The app's promises show holding in production, live, next to
   the local ones.
5. **A second plan breaks a promise locally, before it ships.** The local
   chip goes red beside production's green. It is fixed in the second plan and
   the local chip goes green again. No incident is recorded and no plan
   reopens: a local break during development is work in progress.
6. **In production, one of the original promises breaks.** Slack hears; the
   admin shows it red against the production source; `promises watch --source
   deployed` records the incident and the plan that owns the promise reopens;
   it is fixed; the timeline shows red, then the fix.

## Decisions (2026-10-04)

- **Solo developer setup for now.** Multi-developer recording, checkout of
  incidents and per-person credentials wait until after the demo.
- **The admin stays local, next to the code**, connected to the server, never
  running on it. Each developer runs their own admin; it is the IDE of the dev
  system.
- **Authoring from the UI runs the developer's own `claude` CLI** headless in
  the project, on their own login (Claude Max). No API key, no Agent SDK; the
  skills and hooks apply to UI-written plans exactly as in the terminal.
- **Deferred until after the demo**: incident-recording automation (watch is
  run by hand), workbench-watch-provisioning beyond one server, plan-premises,
  the rest of Day, the evaluator-in-worktree fix.

## Decisions (2026-10-05)

Made after reviewing the script against what is built (Sandy chose each).

- **The plan is built from the same UI panel that wrote it.** The first
  version of the script went from "write the plan" to "deploy it" with nothing
  building the code. The panel runs `/work <plan>` through the same headless
  `claude`; it is part of
  [admin-plan-authoring](../admin-plan-authoring/brief.md).
- **The template has no promises.** It is a working app; the first plan adds
  the promises. A template that shipped them would leave the UI-written plan
  nothing to promise.
- **A local break is shown, not recorded.** Today a local violation keeps the
  local chip red for the whole seven-day window, fix or no fix, and recording
  it (`promises watch --source local`) reopens the plan that owns the promise,
  not the plan whose work broke it. So the local chip follows the newest run:
  red when the newest mark is a violation, green again once a newer run
  upholds. The rule is written in
  [promise-timeline](../promise-timeline/brief.md), beside the chip's
  fixed-incident rule.
- **promise-timeline is needed for both break steps, not only for the
  visual.** Its chip rules are what let script steps 5 and 6 end on something
  other than red.
- **The waits are recorded as they are.** Building a plan and creating a Fly
  app each take minutes. Nothing is pre-built or pre-provisioned; the edit
  shortens them.

## Order

| # | Plan | What it adds to the demo |
|---|---|---|
| 0 | [day-always-on-deploy](../archive/day-always-on-deploy/brief.md) | the server, verified on Fly — closed 2026-10-04 |
| 1 | [promise-sources](../archive/promise-sources/brief.md) | local and production read side by side — closed 2026-10-05 |
| 2 | [promise-timeline](../promise-timeline/brief.md) | promises holding over time, and the chip rules both break steps end on |
| 3 | [admin-plan-authoring](../admin-plan-authoring/brief.md) | "New plan" and "Build" in the UI, through the CLI |
| 4 | [demo-app-template](../demo-app-template/brief.md) | a working app to promise about, deploy and break |
| 5 | [server-provisioning](../server-provisioning/brief.md) | one command gives a project its server |
| 6 | [planner-promises](../planner-promises/brief.md) | the planner asks for promises |
| 7 | demo-rehearsal | record a dry run of the script end to end, fix what it trips on |

**Spike before step 2 is built**: one day on step 3's mechanism — a headless
`claude` started from the admin, a question answered through it, a permission
prompt answered through it. It is the one piece whose failure changes the
script, so it is tried first. The spike's questions are in
[admin-plan-authoring's brief](../admin-plan-authoring/brief.md).
