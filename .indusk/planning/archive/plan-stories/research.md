---
title: "Plan titles and stories — Research"
date: 2026-10-14
status: in-progress
workflow: feature
---

# Plan titles and stories — Research

## Question

Plans are shown by handle (`cockpit-redraw`), lowercase and dashed, and a master plan with subplans tells no story of what it is doing. What is each plan that is not archived, what did it do and why does it exist — and what should it be called?

## Background

- A plan has a handle (its folder), a `title:` in its brief (today usually a long sentence, e.g. "cockpit-redraw — the nav from the original cockpit, the brief page drawn, re-approval a person's") and, since brief-as-the-contract, a `description:` (one to three sentences; most older plans have none).
- Sandy (2026-10-14): a plan should have a **handle**, a **title** (short, properly written) and a **description**; what `title:` holds today is really a description.
- A master plan (`master.md`) lists its subplans by handle and has no goal line the admin can show; Day's lists 26.
- The nav's *Needs you* does not count a plan waiting only on an amendment (`planWaiting`), while the plan page does (cockpit-redraw's audit and falsification).

## Findings — every plan not archived (2026-10-14)

Read by three readers from each plan's worktree copy where one exists, else the trunk's. "Proposed" is a draft for Sandy to correct.

### Master plans

| Handle | Stage | Proposed title | Proposed description |
|---|---|---|---|
| indusk-v2-dawn | master; 5 of 8 subplans archived, 3 not started | InDusk v2: Dawn | Runs a plan's work through whichever AI model or tool you already use, and checks the result can be trusted. |
| indusk-v4-day | master; 17 of 26 archived, 2 open, the rest queued | InDusk v4: Day | Watches your software running and checks it against the promises you made; when one breaks, it reopens the plan that owns it. |
| indusk-demo | master; 13 of 18 archived; its text still names a finished step as next | InDusk demo | Builds the recorded demo of starting a new project with InDusk and watching its promises hold in production. |
| promise-core | master; 0 of 3 subplans; design record only | Promise core | Makes the promise the first thing a person meets in InDusk; plans and gates are extras for larger work. |

### In flight (approved or building)

| Handle | Stage | Proposed title | Proposed description |
|---|---|---|---|
| sessions-per-plan | 25 of 26 items done | Sessions per plan | Lets several plans each have an agent working at once, with a cap for the whole machine. |
| decided-prompts-stay-closed | approved, not started | Decided prompts stay closed | The cockpit shows an Allow/Deny prompt only when a person must choose, and once decided it stays closed. |
| clean-release-build | approved, not started (security fix) | Clean release build | A published package holds only code built from today's source, and no command is assembled from text. |
| cockpit-audit-fixes | approved 2026-10-10, not started | Cockpit audit fixes | Fixes four places the cockpit showed less than it claimed: history, multi-question prompts, plans awaiting approval, promise grouping. |
| story-first-phases | brief accepted, impl drafted | Story-first phases | Each phase opens with a plain paragraph and each task is one plain sentence, the technical detail folded beneath. |
| mark-first | brief accepted, no impl | Mark first | A promise counts as kept when the running system says so; each part reports separately, so a break points at its cause. |
| mockup-matching | brief accepted, no impl | Mockup matching | Checks each screen looks like its approved mockup on every device, and shows the difference when it drifts. |

### Drafts

| Handle | Stage | Proposed title | Proposed description |
|---|---|---|---|
| approve-then-improve | draft brief (untracked on main) | Approve then improve | Approve something as good enough to build on, then improve it in small stated steps. |
| context-reaches-every-session | draft brief, 2026-10-06 | Context in every session | An agent sees the rules for the folder it works in even when Claude Code does not load them itself. |
| looks-check-speed | draft brief + research | Faster look checks | The look check re-checks only what changed, loads each page once, and samples in production. |
| adopt-existing-project | draft (frontmatter only) + research | Adopt an existing project | Brings a project built without InDusk in: names its parts, writes its founding brief, gives each part its first promises. |
| demo-scenarios | draft + research | Demo scenarios | Every plan gets a local demo where each promise can be seen holding, and switched to a fault and seen breaking. |
| embedded-browser | spike draft + research | Embedded browser | Works out how a running demo shows its plan's promises beside it, on the page or drawn inside the cockpit. |
| instance-ports | draft + research | Instance ports | Every running InDusk gets its own port, kept out of tracked files, so restarts stop dirtying the project. |
| one-conversation-view | draft | One conversation view | Every agent session in the cockpit reads as one tidy conversation, the agent's working folded away. |
| owned-changes | draft | Owned changes | Before changing a shared part of the look, the agent says who must approve it and which screens it touches. |
| stories-replace-mockups | research; brief a stub | Stories replace mockups | A mockup is a proposal; an approved story is the lasting definition the app is checked against. |
| telemetry-destinations | draft, backlog | Telemetry destinations | A project sends telemetry to any vendor while InDusk always keeps its own copy. |
| contract-ui | draft; waits on plan-premises | Contract UI | The admin opens on why the project exists, then its promises, then the work building each. |
| plan-premises | draft brief | Project premises | One place for why a project exists and how that is judged, scored over time, never blocking work. |
| workbench-watch-provisioning | draft, parked | Watched from day one | A new workbench gets its own watching server when it is created, so it is watched from its first commit. |
| indusk-release | draft, 2026-09-17, mostly overtaken | Release names its plans | A release records which finished plans it carried, with nothing typed by hand. |
| release-preconditions | empty brief | (unknown) | Nothing written; started 2026-10-10. |

### Research only

| Handle | Stage | Proposed title | Proposed description |
|---|---|---|---|
| user-zero | research, parked on purpose | User Zero | A product that keeps being built, steered by the people using it, held honest by a written contract. |
| jev-decision-model | research, complete | Jev decision model | Looks at a new fast decision model and where InDusk could use it; nothing planned. |

### Flags — decisions for Sandy

- **Close or archive candidates**: `release-preconditions` (empty, purpose unknown), `indusk-release` (overtaken by `release-ritual` and `release-records-its-failures`, both archived), `jev-decision-model` (finished research, no plan).
- **Overlaps**: `stories-replace-mockups` and `mockup-matching` (what a screen is checked against); `embedded-browser` serves `demo-scenarios` and could fold into it; `instance-ports` may overlap the recently approved `untrack-mcp-json` (not read).
- **Stalled**: `clean-release-build` (a security fix, approved, nothing started); `cockpit-audit-fixes` (approved 2026-10-10, nothing started).
- **Nearly done**: `sessions-per-plan` (one item left).
- **Stale text**: `indusk-demo`'s master still names a finished step as next; Day and Dawn both list `dawn-workbench-execution`.
- **Parked on purpose**: `user-zero`, `workbench-watch-provisioning`, `telemetry-destinations`, `contract-ui` (on `plan-premises`).

## Decisions

- A plan has a handle, a title and a description (Sandy, 2026-10-14). What `title:` holds today is a description.
- Archived plans are left as they are for now (Sandy, 2026-10-14).

## Open Questions

- The master plan page's horizontal progress at the top: keep, drop, or replace with the story?
- Where a plan with no title written gets one: its handle turned into words, or nothing until written?
- Who writes a master's story lines: the agent from each subplan's brief, the person, or the agent with the person approving?
