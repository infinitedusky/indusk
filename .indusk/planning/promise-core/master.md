---
title: "Promise core"
description: "Makes the promise the first thing a person meets in InDusk; plans and gates are extras for larger work."
date: 2026-10-05
status: living
# Ordered children, grouped under the eight headline children (comments). Since
# 2026-10-15 every open plan sits here: Dawn, Day and the demo masters are closed.
# A name with no folder renders as a placeholder.
subplans:
  # 0. run-the-master — questions by cost, the daily list, the graph scheduler
  - run-the-master
  # 1. mark-first — a plan is one promise; clauses proved by marks
  - mark-first
  - telemetry-destinations
  - workbench-watch-provisioning
  - demo-scenarios
  - embedded-browser
  # 2. expectations-loop — expectations read back into what is built next
  - expectations-loop
  - plan-premises
  # 3. looks-as-promises — visual promises; the design system
  - looks-as-promises
  - stories-replace-mockups
  - mockup-matching
  - looks-check-speed
  - approvals-merge-cleanly
  - owned-changes
  - plan-page-shows-its-looks
  # 4. open-core-boundary — the core ships on its own
  - open-core-boundary
  - house-rules-out
  - context-reaches-every-session
  - instance-ports
  - indusk-release
  - release-preconditions
  - clean-release-build
  # 5. workbench-server
  - workbench-server
  # 6. adopt-existing-project
  - adopt-existing-project
  # 7. the cockpit, organised around promises
  - one-conversation-view
  - contract-ui
  - cockpit-audit-fixes
  - decided-prompts-stay-closed
  - template-reload-on-cold-cache
  # 8. workflow-builder
  - workflow-builder
---

# Promise core — Master

What a conversation on 2026-10-05 settled about what InDusk is at its centre,
what must change to make it true, and which existing plans it touches. The
measurements behind it are in [research.md](research.md). The aim it serves is
the seven sentences in [plan-premises/aim.md](../plan-premises/aim.md).

Nothing here is built and no plan below is created. On 2026-10-05 this
master was reconciled with the [Day master](../archive/indusk-v4-day/master.md): three
decisions are recorded under Decided, and `planner-promises`' brief and the Day
master were edited to match. No other plan has been edited. This is the record
to work from.

## Settled 2026-10-14/15 — the promise is proved by watching it

A conversation during `new-project-flow`'s close (Sandy) sharpened the
primitive. Where this section and the older text below disagree, this section
holds; the older text is kept as the record of 2026-10-05.

**The primitive**

- **A plan is one promise.** Its goal is to build whatever fulfils it.
- **A promise is made of clauses**: *splits* — progress against a budget on the
  way to the promise's goal, worked backward from it (the 100 m dash's split
  times) — and *limits* — bounds that always hold (an engine's heat).
- **Every clause has a mark**: telemetry in the running system that reports it
  upheld or broken. A clause is upheld only when its mark says so in real use. The
  mark is the proof.
- **A clause may also have tests**: the rehearsal before release and the guard
  while code changes. Needed to build it; never enough to call it upheld.
  Removing them would leave nothing to say, before a deploy, that a change
  broke a clause — "the regression is fucked if you remove the tests" (Sandy).
- **A plan is done when every clause's mark has reported**, its tests passing
  on the way.
- **Every break a mark finds becomes a test on that clause** as part of fixing
  it: telemetry discovers, tests pin (the principle below, *search discovers,
  tests pin*, applied to production). Tests grow from what really broke, not
  only from guesses made in advance.
- **Promises build up.** A clause can be the promise of the part beneath it;
  the marks share a trace, so a break leads down to its cause. Depth grows
  where incidents land.

**The words** (Sandy, 2026-10-15): a promise, and each clause, is **upheld**
or **broken** — the words people use of promises.

| Use | Good | Bad |
|---|---|---|
| A state — a dot, a record, a mark | **upheld** | **broken** |
| Right now — a live page | **holding** | **broken** |
| What happened | **held** | **broke** |

The system *upholds* a promise; a promise *holds* or *breaks*. Never *failed*,
*passed* or *violated* — the words of tests and tickets. Today InDusk mixes
them: a mark reports `upheld`/`violated` and the registry's state is
`known-violated`. `mark-first` moves both to upheld/broken; a mark's
`violated` is still read, so applications already marked keep working.

**What people think about** (Sandy, 2026-10-15): promises and clauses, and
whether they hold — that is what wakes anyone at night. Tests, regressions and
their upkeep are fully automated and the agents' alone: written, run, grown
from breaks and kept passing without a person deciding, approving or reading
them. A person approves promises and clauses; the cockpit shows clause health,
never a test list. Tests exist to help the system keep its promises, not to be
looked at.

**Everything is a promise** (an advisor's point, adopted by Sandy, 2026-10-15).
Promises are polymorphic: one concept, with types that prove themselves their
own way. A **visual promise** is what a "look" is today — one per screen or
component, its approved mockup as its statement, each state on each device and
scheme a clause, upheld when the rendered page matches by value; its mark is the
looks check (later, real browsers); its stories are its tests, the agents'
alone. One list, one health view, one approval flow; the brief has one Promises
section. Expectations stay separate — they decide what to build, not what is
true. Built as its own child, third (`looks-as-promises`).

**Approvals happen on the plan page** (Sandy, 2026-10-15). Every promise a plan
makes or changes — visual ones included — is approved on that plan's page, one
line each, opened on demand. A shared component that reopens screens other plans
own shows them on the page of the plan that changed it. The **looks page becomes
the design system**: the foundation, components and their states, screens as
they are — browsed and linked, with no approvals, no proposed queue, no checkout
switching.

**How the work runs** (Sandy, 2026-10-15)

- **The person's job is briefs.** A plan starts as a conversation and ends with
  a brief the person approves: the promises and their clauses. That is where
  the person's time goes. From an approved brief, execution runs on its own.
- **Every decision carries a cost, and the cost sets how long it waits:**
  *cheap* — proceeds on the agent's recommendation after five minutes
  unanswered; *moderate* — after an hour; *expensive* — waits for the person,
  shown bright red and flashing. Expensive is: what to promise, anything
  outward-facing or permanent (publishing, a public repository, deleting,
  spending), and a look the person would reject. The agent classifies each
  decision; the person can reclassify. Most of today's approvals — test plans,
  ADRs, impls, stories, re-approving a brief already agreed — are cheap.
- **Questions, not approval screens.** Every decision arrives as a question in
  one place — a thread beside everything — carrying the agent's
  recommendation. The person answers when it comes, or adds context.
- **A daily list replaces sitting in a plan:** what is building, what is
  breaking, what needs the person today, across every plan.
- **The work is a graph, run in parallel.** Nodes are plans and, within a plan,
  phases; each declares what it depends on and what it touches. Every node
  whose dependencies are met and whose files no running node touches runs at
  once (up to the machine's session limit). An unanswered question blocks only
  the nodes downstream of it, never the rest. The graph is re-evaluated
  continuously as answers, landings and touched files change. Dependencies come
  from promises — a clause resting on another promise — with `Depends On` for
  what promises do not express.
- **Main cascades.** Whenever something lands on `main`, every open worktree
  merges it (merge, never rebase), so every branch stays in step. A worktree
  with no running session merges at once; one with a running phase merges when
  that phase ends, and its next phase does not start until it has. A merge
  that conflicts becomes a question (its cost set by its size); the agent
  proposes the resolution. On the workbench server there is one copy, so the
  cascade is the box's; locally, each machine's open worktrees.
- **The graph is seen** (a look in `run-the-master`'s brief): plans and promises
  as nodes, starting tiny — a plan is one node with its state, opened on
  demand. A broken promise turns red with its broken clause and symptom; every
  promise resting on it dims to *at risk*; the line down the shared trace leads
  to the cause; the fix appears as a new node, and the red turns green only when
  the mark reports holding again in real use. Built on React Flow (xyflow) with
  an ELK or dagre layout. A replay of a real run — Homework Gate's milestones —
  is for the product page, a follow-up once that run exists.

**Two loops read the telemetry back**

- **Promises → fixing.** A broken clause becomes an incident carrying its trace
  and an agent's diagnosis and proposed fix.
- **Expectations → deciding.** At its look time an expectation's measure is
  read back and proposes what to build next. An expectation is not a promise;
  a miss is information, not a defect. Expectations exist in every brief
  today; nothing reads them back yet.

**How it ships** — see `.indusk/research/open-core-and-workbench-server.md`

- **Open core** — local, no server, free: it detects, when you run it.
- **Workbench server** — a team's own box, a subscription, each person on their
  own Claude account: it closes both loops continuously.
- **The sorting rule:** server only if it must run continuously or know more
  than one person; the server holds nothing the files do not.

**The plans, in order** — each headline child below gathers the open plans
listed under it in `subplans:`.

0. **`run-the-master`** — first: decisions as questions with a cost (cheap
   five minutes, moderate an hour, expensive waits, red); one question thread;
   the daily list; main cascading into every worktree; the graph of plans and phases run in parallel, blocked only
   downstream of an unanswered question, re-evaluated continuously. Its first
   master to run is Homework Gate's milestones, not this one. Built first on
   `Depends On`; promise-derived dependencies arrive with `mark-first`.
1. **`mark-first`** — merged with `promise-first-build`: clauses, marks
   (server and browser), the close rule, layering, the diagnosis; and a plan
   being one promise. Proved on Homework Gate, not on dusk. Its accepted brief
   is reworked around "a plan is one promise" and approved again.
2. **`expectations-loop`** — expectations read back at their look time into
   what is built next.
3. **`looks-as-promises`** — visual promises; approvals on the plan page; the
   looks page becomes the project's **design system** — the foundation,
   components and their states, screens, browsed and linked. Folds in
   `stories-replace-mockups` (its research holds today's story-viewing
   findings: stories framed like pages, drawn without the app's base reset,
   a placed story differing from its screen's drawing).
4. **`open-core-boundary`** — the core works without the admin daemon or a
   machine-global home; `house-rules-out` is folded in (dusk's own practice
   leaves the package). Ships with visual promises in the core.
5. **`workbench-server`** — one box per team, per-person Claude accounts,
   sync; Anthropic's own cloud sessions checked first.
6. **`adopt-existing-project`** — bringing an existing codebase (Numero) in:
   name its parts, its founding brief, first promises with marks.
7. **The cockpit, organised around promises** — `one-conversation-view` (on a
   plan, one agent present on every page, rendered the same everywhere, and
   matching the new-project conversation's thread), `contract-ui` (the admin
   organised around premises, promises and phases), and the in-flight
   `cockpit-audit-fixes`, `decided-prompts-stay-closed`,
   `template-reload-on-cold-cache`.
8. **`workflow-builder`** — kept, not yet reconsidered against the above.

**What changes in what exists:** the test plan becomes the clause plan (each
clause and its mark, its tests beside); `a-closed-plan-kept-its-promises` closes
on marks; the planner's "assertions must be behavioural" rule moves to clauses.
Open: whether a *structure* promise's mark is a check run at build time.

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
large to build in one go. This is called the short path below.

## What is settled

**Three layers.**

1. **Core.** A promise and its evidence: the tests that prove it before
   release, and the mark that watches it after.
2. **Workflows.** How work toward a promise is organised. InDusk provides the
   steps; a person selects the ones they want. The kinds of plan that exist
   today are selections already.
3. **House.** How this repository itself is run. It never ships.

**What the core requires, whatever the workflow.** *(Superseded 2026-10-15:
every clause has a mark; tests are its rehearsal and guard — see above.)* Every promise is named by a
test. That test is seen failing before the code is written. Work is not done
while it is missing or failing. A person can select a workflow with no test
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
  selects from the steps InDusk provides; a new kind of step takes an
  extension.
- Count an agent's reading as evidence.
- Treat an expectation of how people will use something as a kind of promise.
  When it fails, that is information, not a defect.

## The work

Three plans, in this order (Sandy, 2026-10-05: the short path is wanted, comes
last, and needs the builder first). Sizes are estimates, confidence moderate.

| # | Plan | What it does | Size |
|---|---|---|---|
| 1 | `house-rules-out` | This repository's own practice leaves the package, and a scan keeps it out | days |
| 2 | `workflow-builder` | A simple screen where a person selects the steps they want. Today's kinds of plan become presets | about a week |
| 3 | `promise-first-build` | The short path: the workflow with nothing selected | about a week, after 2 |

### 1. `house-rules-out`

The package tells agents in other projects to do things that are only true
here. The clearest case is the retrospective skill, whose last step bumps
InDusk's own package and runs InDusk's release guard. This plan moves that
layer into this repository and adds a test that fails when a shipped file
names this repository's paths, people or history.

It does not depend on the other two and can run at any time.

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

### 2. `workflow-builder`

InDusk already has different kinds of plan, and each is a selection from the
same steps. A feature takes all six documents. A bugfix or a refactor takes
four. A spike takes one. Other choices exist too, scattered across a plan's
header and the project's config: skip a closing ritual with a reason, turn the
worktree off, relax how gate skips are handled.

The builder gathers those into one screen in the admin. A person ticks the
steps they want and saves the result as a workflow. The four kinds that exist
become presets. No new kind of step is invented here.

One thing cannot be unticked: the core's requirement that every promise is
named by a test that was seen failing.

<details>
<summary>What it changes</summary>

- The table of what each kind of plan requires, `WORKFLOW_DEFINITIONS` in
  `src/lib/workflow-types.ts`, is a constant with four rows. It becomes data a
  project holds, with the four as built-in presets.
- The steps offered: the six documents (research, brief, test plan, ADR,
  implementation checklist, retrospective); the two closing rituals
  (falsification, cleanup); the per-phase gates for context and
  documentation; a worktree per plan; the background evaluator.
- The planner skill's table, the four workflow templates and the docs
  reference page are pinned to that module by a parity test. They would read
  the project's workflows, or the pin would cover only the presets.
- The admin has no request handler today.
  [admin-plan-authoring](../admin-plan-authoring/brief.md), the demo's plan
  for starting and building a plan from the admin, adds the first. The builder
  is the second screen that writes, and follows it.

</details>

### 3. `promise-first-build`

The short path is the workflow with nothing selected: a promise, its tests
seen failing, the build. It comes last because it needs the builder to offer
it, and because it is the one that reaches into the core.

Today the tests a piece of work commits to, and whether each was seen failing,
are rows in the implementation checklist. With no checklist selected, that
record has nowhere to live. So in this plan the promise carries its own
evidence, and a promise no longer needs a plan to own it.

Done means: in a repository that has never had a plan, a person states a
promise and ends with working code, a passing test that was first seen
failing, and a mark that reports a break.

<details>
<summary>What it changes</summary>

- A promise with no `owner` is valid. When it breaks, the incident is
  recorded and announced; nothing is reopened. The response path already has a
  `no-owner` branch; the registry and the check are what refuse.
- "Seen failing" is recorded by the system, not typed by an author into a
  checklist. This is row 4 of the pull-request shape, "red observed",
  specified and unbuilt. `day-claim-evidence`, component 5 in the Day master
  plan, builds it (Sandy, 2026-10-05; first written here as coming forward
  into this plan), where both a test row and a promise can read it. This plan
  reads that record for a promise that has no plan.
- Two small rules join `promises check`: a behaviour promise cannot be
  `established`, and a promise whose mark has never fired in any source is
  reported.
- The person does not choose a kind. The agent assigns it from the sentence
  and the person can correct it.
- Line references: [research.md](research.md), findings 4 and 5.

</details>

### Later, not scheduled

**Other kinds of owner.** Work tracked somewhere other than InDusk's plan
folders, a ticket in a tracker for example. The core would ask any owner three
questions: does it exist, is it open, and reopen it for this incident. This is
where the Linear substrate, component 8 of the Dawn master plan and not yet
created, would land. It needs `promise-first-build` and nothing above needs
it.

**New kinds of step.** A step InDusk does not provide would come from an
extension. The step vocabulary is closed in several parsers and their hook
copies, and opening it is a large change that nothing here requires.

## Plans this changes

Each row names a plan, where it stands, and what this would change in it.
Edited so far, on 2026-10-05: `planner-promises`' brief, and the Day master's
rows for `day-contract` and `day-claim-evidence`. The rest have not been.

| Plan | Stands | What changes |
|---|---|---|
| [planner-promises](../archive/planner-promises/brief.md), demo step 6 and component 4c in the Day master plan: the brief is the expectations and the promises | closed 2026-10-05 | It is where "every test row says what it is for" lands for workflows that have a checklist, where a closing plan confirms its promises, and where a plan says which existing promises it keeps, changes or replaces. It writes each promise "with this plan as owner"; owner becomes optional in `promise-first-build`. It also renames the test `Kind` column to `Level`, and adds expectations to the brief: why the work is done, each with its measure. An expectation is not a kind of promise, as this master already rules. |
| [test-kinds](../archive/test-kinds/brief.md): five kinds of test, each run at its own moment | closed 2026-10-05 | Agrees on substance: watching is what promises are for. Two vocabularies used the word "kind", one for promises and one for tests. Decided 2026-10-05: tests have a level, promises keep kind; `planner-promises` does the rename. |
| [admin-plan-authoring](../admin-plan-authoring/brief.md), demo step 3: New plan and Build from the admin | brief draft, spike done | Unchanged for the demo. Afterwards, starting a plan asks which workflow, and the builder reuses its request handling. |
| [contract-ui](../contract-ui/brief.md): the admin organised around premises, promises and phases | brief and manifesto draft | The lowest level is "phases". A promise built on the short path has none. That level becomes the work toward a promise, which may be a phase or only a test run. |
| [indusk-demo](../archive/indusk-demo/master.md): a new project, start to finish, recorded | living | The script stands as written. The short path is added at the end. |
| `day-contract`, component 4c′ in the Day master plan: the check at change time | not created; after the demo | Everything else first proposed for it is `planner-promises`, including changing or replacing a promise. What remains is the check: code that touches a promise's site, in a plan that does not name it, is recorded. |
| `day-claim-evidence`, component 5 in the Day master plan: red observed, amendments recorded | not created | Decided 2026-10-05: it keeps "red observed" and builds it once, recorded by the system; `promise-first-build` reuses it. The amendment log and the gate ledger stay. |
| `day-claim-binding` and `day-uncovered-surface`, components 6 and 7 in the Day master plan | not created | Both are specified per change and per test row. The audit this conversation described is the same two checks run per promise across the registry, when a promise's test or marked code changes. |
| [incident-recording](../incident-recording/brief.md): recording on a schedule, landed as a pull request | brief draft | The pull request carries "the owner's Maintenance phase". With no owner it carries the incident alone. |
| [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md): every workbench gets a server | brief draft | It ties a server to a workbench. A workbench is house. The server belongs to a project. |
| [plan-premises](../plan-premises/brief.md): the aim, premises, intakes scored by a person | brief draft | Two sources of intake are named: an expectation of use that turned out wrong, and what people said in their own words. |
| [indusk-release](../indusk-release/brief.md): a release names the plans it carries | brief draft | Depends on an open question: whether releasing is part of the method or only this repository's practice. |
| [user-zero](../user-zero/research.md): research on software steered by use | research in progress | The narrowed version from 2026-10-03, three inputs and an advisor, is not yet written into it. |

## Decided

- **The short path is wanted, and it comes last** (Sandy, 2026-10-05). The
  demo's script and its plans are not disturbed.
- **It needs the workflow builder first**, and the builder is a simple screen
  for selecting steps, not a new mechanism.
- **Reconciled with the Day master** (Sandy, 2026-10-05):
  - `planner-promises` is the contract entering planning (Day's 4c) and is
    built next. `day-contract` keeps only the check at change time.
  - The brief is what the planning conversation produced: expectations and
    promises. Everything else is research.
  - A partial change improves a promise in place and the changing plan takes
    it over; a replacement retires it.
  - `day-claim-evidence` builds "seen failing, recorded by the system";
    `promise-first-build` reuses it and does not wait on it being rebuilt.
  - Tests have a level, promises have a kind. The rename is
    `planner-promises`'.

## Still Sandy's to decide

1. **Whether the short path is the demo's closing scene.** If so it is built
   before `demo-rehearsal`, the demo's last plan. If not, after the demo.
2. **Defaults.** Which workflow a new project starts with.
3. **Releasing.** House or method.
4. **Names.** `promise-core` and the three plan names are provisional.

## What this does not change

The watcher, the always-on server, the promise sources and the timeline are
already free of plans and stay as they are. The gates, the trajectory and the
closing rituals keep working exactly as they do; they become steps a workflow
selects, not the core's.
