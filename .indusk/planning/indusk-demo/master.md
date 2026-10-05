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

## The script

1. **Start a new project.** The local environment and its own always-on
   server come up, and you have a UI.
2. **Write the first plan in the UI.** A "New plan" button runs your own
   Claude Code (Max login, headless CLI) through the planner. The plan
   requires promises, and they appear in the admin as they are written.
3. **Deploy it.** The app's promises show holding in production, live, next to
   the local ones.
4. **A second plan fails locally before deployment.** The local loop catches
   it; the plan reopens; it is fixed before it ships.
5. **In production, one of the original promises breaks.** Slack hears; the
   admin shows it red against the production source; the incident is recorded
   and the owning plan reopens; it is fixed; the timeline shows red, then the
   fix.

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

## Order

| # | Plan | What it adds to the demo |
|---|---|---|
| 0 | [day-always-on-deploy](../day-always-on-deploy/brief.md) | the server, verified on Fly (impl complete; close-out) |
| 1 | [promise-sources](../archive/promise-sources/brief.md) | local and production read side by side (closed 2026-10-05) |
| 2 | [promise-timeline](../promise-timeline/brief.md) | promises holding over time — the visual |
| 3 | [admin-plan-authoring](../admin-plan-authoring/brief.md) | "New plan" in the UI, through the CLI |
| 4 | [demo-app-template](../demo-app-template/brief.md) | an app with promises to deploy and break |
| 5 | [server-provisioning](../server-provisioning/brief.md) | one command gives a project its server |
| 6 | [planner-promises](../planner-promises/brief.md) | the planner asks for promises |
| 7 | demo-rehearsal | run the script end to end, fix what it trips on |
