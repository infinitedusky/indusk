---
title: "Promise core — the promise is the first primitive"
date: 2026-10-05
status: living
# Ordered children. None is created yet; a name with no folder renders as a
# placeholder. The names are provisional until each is opened with /planner.
subplans:
  - house-rules-out
  - promise-first-build
  - workflow-extensions
---

# Promise core — Master

What a conversation on 2026-10-05 settled about what InDusk is at its centre,
what must change to make it true, and which existing plans it touches. The
measurements behind it are in [research.md](research.md). The aim it serves is
the seven sentences in [plan-premises/aim.md](../plan-premises/aim.md).

Nothing here is built. No plan below is created, and no other plan has been
edited. This is the record to work from.

## The primitive

Sandy, 2026-10-05. A ticket tracker is one primitive, a thing that can be
marked with a status, and everything else is layered on it. Cycles are
optional. Dependencies come from it. That works because task management is a
solved shape: the tracker's job is the experience, not a new idea.

InDusk's primitive is the promise: a contract with the running system, and the
proof that it is kept. That should be the first thing a person meets, and it
should be enough to start building with.

**Starting from a promise alone looks like this.** A person states a promise.
The agents write the tests that describe it, run them, and confirm they fail.
Then they build until the tests pass. Nothing else is required: no written
plan to approve, no implementation checklist. Writing the test first is not a
step someone chose. It is what building from a promise means.

Plans, phases, gates and rituals are what a person adds when a promise is too
large to build in one go.

## What is settled

**Three layers.**

1. **Core.** A promise and its evidence: the tests that prove it before
   release, and the mark that watches it after.
2. **Workflows.** How work toward a promise is organised. InDusk provides the
   steps; a person composes them. The `feature` workflow ships as the default.
   A workflow is an extension.
3. **House.** How this repository itself is run. It never ships.

**What the core requires, whatever the workflow.** Every promise is named by a
test. That test is seen failing before the code is written. Work is not done
while it is missing or failing. A user can design a workflow with no test
step, so this cannot live in a step.

**One promise object.** The person writes the sentence. How it is proven
before release and how it is watched after are the agents' to write and keep.
There is no separate test plan or telemetry plan for a person to maintain.

**Types decide the evidence.** A promise's kind says what evidence it needs. A
promise about behaviour needs tests and a mark in production. One about
structure needs tests only. Its lifetime says for how long. Almost every
promise holds for as long as the system runs. Only a change that cannot be
undone is ever finished, and a promise about behaviour never is.

**Search discovers, tests pin.** An agent reading the code can find what no
test looks for. Its finding counts only once it is a test anyone can rerun.

**The agent proposes, the person decides.** Whether something deserves a
promise is the person's call. A proposal that is declined is recorded and not
raised again.

**What we will not do.**

- Ship the release step, the conduct rules, the writing skills or a linter
  into other people's projects.
- Strip the method out to look neutral. It is the opinion being sold. A person
  composes the steps InDusk provides; a new kind of step takes an extension.
- Count an agent's reading as evidence.
- Treat an expectation of how people will use something as a kind of promise.
  When it fails, that is information, not a defect.

## The work

Three plans, in this order. Sizes are estimates, confidence moderate.

| # | Plan | What it does | Size |
|---|---|---|---|
| 1 | `house-rules-out` | This repository's own practice leaves the package, and a scan keeps it out | days |
| 2 | `promise-first-build` | A promise can be declared, proven and watched with no plan anywhere | about a week |
| 3 | `workflow-extensions` | Plans become one workflow among several, supplied by an extension | weeks |

### 1. `house-rules-out`

The package tells agents in other projects to do things that are only true
here. The clearest case is the retrospective skill, whose last step bumps
InDusk's own package and runs InDusk's release guard. This plan moves that
layer into this repository and adds a test that fails when a shipped file
names this repository's paths, people or history.

<details>
<summary>What moves, and what it is measured against</summary>

- Out of the shipped skills: the release step and the docs-site paths in
  `retrospective.md`; the docs location in `document.md`; the same path in
  `planner.md` and `work.md`. Where a project needs such a path, it is read
  from that project's config.
- Out of the defaults: the conduct rules in `templates/AGENTS.md`, the
  `write` and `brainstorm-fiction` skills, the `papers` command, Biome added
  by `init`, lessons about one machine.
- A decision for Sandy inside this plan: whether the background evaluator and
  the trunk guard stay on by default.
- The scan follows the single-definition tests already in the suite: it reads
  `skills/`, `templates/`, `hooks/` and `lessons/` and names the file.
- Counts and line references: [research.md](research.md), findings 2 and 3.

</details>

### 2. `promise-first-build`

Today a promise cannot exist without a plan folder to own it. This plan makes
the owner optional, so a promise can be declared in an empty repository,
marked in code, broken, and reported. It then adds the short path described
under "The primitive": state a promise, the tests are written and seen to
fail, the code is built until they pass.

Done means: in a repository that has never had a plan, a person states a
promise and ends with working code, a passing test that was first seen
failing, and a mark that reports a break.

<details>
<summary>What it changes</summary>

- A promise with no `owner` is valid. When it breaks, the incident is
  recorded and announced; nothing is reopened. The response path already has a
  `no-owner` branch; the registry and the check are what refuse.
- "Seen failing" is recorded by the system, not typed by the author. This is
  row 4 of the pull-request shape, "red observed", specified and unbuilt. The
  core needs it, so it comes forward from `day-claim-evidence`, component 5 in
  the Day master plan, which was to build it.
- Two small rules join `promises check`: a behaviour promise cannot be
  `established`, and a promise whose mark has never fired in any source is
  reported.
- The person does not choose a kind. The agent assigns it from the sentence
  and the person can correct it.
- Line references: [research.md](research.md), findings 4 and 5.

</details>

### 3. `workflow-extensions`

The owner of a promise becomes something a workflow supplies. The core asks an
owner three questions: does it exist, is it open, and reopen it for this
incident. InDusk's own plans answer them the way they do today. A tracker
could answer them by reopening an issue.

Workflows become data an extension provides. The four that exist today,
feature, bugfix, refactor and spike, are already one table that the planner,
the templates and the admin are pinned to; a fifth is a new row. The steps
themselves stay InDusk's: six documents, a fixed set of gates, two closing
rituals. That vocabulary is closed in several parsers and their hook copies,
and opening it to composition is most of the work.

<details>
<summary>What it changes</summary>

- `owner` becomes a reference with a kind, for example `plan:<name>`.
- The plan-folder lookup, the Maintenance phase and the archival rules move
  behind that reference as the InDusk-plans implementation.
- A scan asserts that nothing under `promises/`, `telemetry/` or
  `always-on/` imports the plan parser or the impl code.
- `WORKFLOW_DEFINITIONS` in `workflow-types.ts` is read from extensions
  instead of being a constant.
- The Linear substrate, component 8 of the Dawn master plan and not yet
  created, becomes the first owner that is not an InDusk plan.

</details>

## Plans this changes

Each row names a plan, where it stands, and what this would change in it.
None has been edited.

| Plan | Stands | What changes |
|---|---|---|
| [planner-promises](../planner-promises/brief.md), demo step 6: the planner asks what a plan promises | brief draft | It writes each promise "with this plan as owner". Owner becomes optional. It is also where "every test row names a promise" lands for the `feature` workflow. |
| [test-kinds](../test-kinds/brief.md): five kinds of test, each run at its own moment | brief draft | Agrees on substance: watching is what promises are for. Two vocabularies now use the word "kind", one for promises and one for tests. One needs another word. |
| [admin-plan-authoring](../admin-plan-authoring/brief.md), demo step 3: New plan and Build from the admin | brief draft, spike done | The panel starts a plan. Under this direction the first thing a person writes is a promise, and building from one needs no plan. The mechanism is unchanged; what it launches is not. |
| [contract-ui](../contract-ui/brief.md): the admin organised around premises, promises and phases | brief and manifesto draft | The lowest level is "phases". A promise built with no plan has none. That level becomes the work toward a promise, which may be a phase or only a test run. |
| [indusk-demo](../indusk-demo/master.md): a new project, start to finish, recorded | living | Script step 2 is "write the first plan". Whether the demo shows the short path from a promise instead is Sandy's decision, below. |
| `day-contract`, component 4c in the Day master plan: promises declared in planning | not created | Its rule that a test row must name a promise moves to the core as "a test names a promise". What remains is the change rule, that touching a promise's code without naming it is recorded, and confirmation at close. |
| `day-claim-evidence`, component 5 in the Day master plan: red observed, amendments recorded | not created | "Red observed" moves forward into `promise-first-build`. The amendment log stays. |
| `day-claim-binding` and `day-uncovered-surface`, components 6 and 7 in the Day master plan | not created | Both are specified per change and per test row. The audit this conversation described is the same two checks run per promise across the registry, when a promise's test or marked code changes. |
| [incident-recording](../incident-recording/brief.md): recording on a schedule, landed as a pull request | brief draft | The pull request carries "the owner's Maintenance phase". With no owner it carries the incident alone; with another kind of owner the reopening goes through that owner. |
| [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md): every workbench gets a server | brief draft | It ties a server to a workbench. A workbench is house. The server belongs to a project. |
| [plan-premises](../plan-premises/brief.md): the aim, premises, intakes scored by a person | brief draft | Two sources of intake are named: an expectation of use that turned out wrong, and what people said in their own words. |
| [indusk-release](../indusk-release/brief.md): a release names the plans it carries | brief draft | Depends on an open question: whether releasing is part of the method or only this repository's practice. |
| [user-zero](../user-zero/research.md): research on software steered by use | research in progress | The narrowed version from 2026-10-03, three inputs and an advisor, is not yet written into it. |

## Decisions that are Sandy's

1. **Before the demo or after it.** The demo's remaining plans are in flight.
   `house-rules-out` is independent of them. `promise-first-build` changes
   what the demo could show.
2. **What the demo's first act is.** A plan written in the admin, as scripted,
   or a promise stated and built with no plan.
3. **Defaults.** Whether a new project starts with promises alone and adds a
   workflow, or starts with `feature` switched on.
4. **Releasing.** House or method.
5. **Names.** `promise-core` and the three plan names are provisional.

## What this does not change

The watcher, the always-on server, the promise sources and the timeline are
already free of plans and stay as they are. The gates, the trajectory and the
closing rituals keep working exactly as they do; they become the `feature`
workflow's, not the core's.
