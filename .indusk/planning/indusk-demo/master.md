---
title: "Demo — a new project, start to finish"
date: 2026-10-04
updated: 2026-10-08
status: living
# Ordered children: the demo path, in build order. Each child is a small plan
# of its own; the parent holds only the script and the order. A name with no
# folder renders as queued until it is opened with /planner.
subplans:
  - day-always-on-deploy
  - promise-sources
  - promise-timeline
  - planner-promises
  - admin-plan-authoring
  - demo-app-template
  - incident-recording
  - vscode-extension
  - display-names
  - plan-cockpit
  - demo-rehearsal
  - server-provisioning
  - contract-ui
---

# Demo — a new project, start to finish

> **Where we are (2026-10-08).** Steps 0–4 and step 8 are closed: the server,
> both promise sources, the timeline, the planner's promises, planning and
> building from the UI, the demo app, and
> [incident-recording](../archive/incident-recording/retrospective.md) — the
> admin records a production break unasked (16 s, nothing typed, on the real
> server) and the running agent hears it. **The next step is the VS Code
> extension**; after it, in order: plan-cockpit (stage 1 of the promise UI),
> the rehearsal. After the launch: server provisioning, then contract-ui
> (stage 2: the hierarchy above stage 1's pages). The sequence is the one the root
> [master](../master.md)'s "Now — show the promise loop" sets out; this file
> is its demo-side copy and the one the admin's sidebar reads.

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
  [promise-timeline](../archive/promise-timeline/brief.md), beside the chip's
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
| 2 | [promise-timeline](../archive/promise-timeline/brief.md) | promises holding over time, and the chip rules both break steps end on — closed 2026-10-05 |
| 3 | [admin-plan-authoring](../archive/admin-plan-authoring/brief.md) | "New plan" and "Build" in the UI, through the CLI — closed 2026-10-06 |
| 4 | [demo-app-template](../archive/demo-app-template/brief.md) | a working app to promise about, deploy and break — closed 2026-10-07 |
| 5 | [server-provisioning](../archive/server-provisioning/brief.md) | `indusk server connect` and `server deploy`; the image published with each release — closed 2026-10-08, built ahead of order |
| 6 | [planner-promises](../archive/planner-promises/brief.md) | the planner asks for promises — closed 2026-10-05 |
| 7 | demo-rehearsal | record a dry run of the script end to end, fix what it trips on — after step 10 |

**Built out of this order** (Sandy, 2026-10-05): `planner-promises` goes
next, ahead of steps 3–5. It depends on none of them, it edits the planner
and trajectory files [test-kinds](../archive/test-kinds/brief.md) just
changed, and it is also component 4c of the
[Day master plan](../indusk-v4-day/master.md). The step numbers stay as they
are, because other documents cite them.

**Spike before step 2 is built**: one day on step 3's mechanism — a headless
`claude` started from the admin, a question answered through it, a permission
prompt answered through it. It is the one piece whose failure changes the
script, so it is tried first. The spike's questions are in
[admin-plan-authoring's brief](../archive/admin-plan-authoring/brief.md).

## Decisions (2026-10-08)

Sandy, after small-fixes closed: the goal is to show a promise breaking and
the system catching it, as fast as possible, for the launch and for showing at
Lazer. The demo's remaining path is the root master's "Now" sequence, and
this file now carries it so the sidebar and the numbers agree.

- **incident-recording comes back into the demo**, as the next step. The
  2026-10-04 decision deferred it because `watch` could be run by hand; the
  demo's script step 6 is the watcher catching a production break on its own,
  which is what the step builds. Its brief is at
  [incident-recording/brief.md](../archive/incident-recording/brief.md) (draft).
- **Two steps are declared and not yet opened**, so they show as queued in the
  sidebar until `/planner` opens each with its brief:
  - **vscode-extension** — promise markers on the code that carries each
    promise, live health from telemetry, "fix with Claude" on a break. The
    break moment, where the fix happens.
  - **plan-cockpit** — stage 1 of the promise UI: the promise dashboard,
    broken first and counted in the nav; the promise page with its proof;
    the plan page as its two workflows with the decision it is waiting on.
    The pages. Its mockup and draft brief are in
    [`.indusk/research/promise-ui/`](../../research/promise-ui/README.md).
- **demo-rehearsal follows plan-cockpit**: the dry run is recorded once the
  views it records exist.
  - For its brief (found 2026-10-08 by vscode-extension's live checks): the
    seat-holds demo tags no project on its runs, and an untagged run counts
    for every project, so two demos on one machine, or an old session's demo,
    show each other's runs and breaks. Rehearse from one demo, or have the
    demo tag its project.
- **server-provisioning moves after the launch.** The demo's server already
  exists (step 0, deployed on Fly); one command per project is for the people
  the demo brings in, not for the recording. Its brief stays where it is.
- **contract-ui joins the demo as stage 2 of the promise UI, after the
  launch**: the home view as the hierarchy — premises above promises above
  phases — opening onto stage 1's pages and changing nothing inside them;
  plan documents as drill-down; every hand-set status derived or removed. It
  waits for plan-premises, which gives it its top level. The two stages do
  not overlap: a page is stage 1, the arrangement of pages is stage 2; its
  [brief](../contract-ui/brief.md) says so.
- **Build order is 4 → 8 → 9 → 10 → 7 → 5 → 11.** The step numbers stay as
  they are, because other documents cite them.

| # | Plan | What it adds to the demo |
|---|---|---|
| 8 | [incident-recording](../archive/incident-recording/retrospective.md) | the watcher runs by itself; a break becomes an incident and announces itself — closed 2026-10-08 |
| 9 | [vscode-extension](../archive/vscode-extension/retrospective.md) | the break moment in the editor: markers, the Promises panel, "fix with Claude" — closed 2026-10-09 |
| 9a | [display-names](../display-names/brief.md) | promises read as words, plans by title with their start, landing and release dates, from one package module plan-cockpit reuses — approved 2026-10-09 |
| 10 | plan-cockpit | stage 1 of the promise UI: the dashboard, the promise page with its proof, the plan page — being opened |
| 11 | [contract-ui](../contract-ui/brief.md) | stage 2: the home view as the hierarchy above stage 1's pages, statuses derived — after the launch, after plan-premises |
