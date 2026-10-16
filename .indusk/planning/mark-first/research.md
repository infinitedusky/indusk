---
title: "Mark first — Research"
date: 2026-10-14
status: complete
workflow: feature
---

# Mark first — Research

## Question

How does InDusk become telemetry-driven: a promise proved by what the running
system reports, with tests as support, and an outer loop that narrows a break
to its cause?

## Background

Settled in conversation with Sandy on 2026-10-14, during `new-project-flow`'s
Build Phase 4, after two bugs found by using the project conversation: a
message that restarted the agent showed only after the next one, and Stop also
sent the half-typed reply.

**Where InDusk is today.** Of 127 promises in the registry, 4 are `behaviour`
(watched by a mark in the running system). Every other promise is proved by
tests: `a-closed-plan-kept-its-promises` — "a plan cannot close while a
promise it made has no passing test that names it" — and `indusk promises
confirm` refuses a promise whose rows name no test file. Nothing requires a
mark. The planner's own rule assigns `state` to anything a test with chosen
inputs can prove, so almost everything becomes a test. Expectations are the
one part already measured from telemetry.

What exists to build on:

- **Marks** (Day 4b, `/decisions/day-monitor`): `indusk.promise`,
  `indusk.promise.outcome` (`upheld` / `violated`) and an
  `indusk.promise.violated` event carrying `indusk.promise.symptom`, set with
  plain OpenTelemetry; Jaeger through the local daemon; `promises watch` turns
  a violation into an incident and reopens the owning plan.
- **Browser traces for projects** (`a-click-and-its-server-work-share-a-trace`):
  a project `indusk init` instrumented carries a click's trace into its server
  work. The admin itself sends nothing from the browser.
- **Incidents reach the agent** (`a-break-reaches-the-working-agent`) and name
  their tests (`an-incident-names-its-tests`); the promise page shows tests,
  marks and thirty days (`a-promise-page-shows-its-proof`).

## Findings

### A test needs the cause known in advance; a mark does not

Sandy: to write a test you have to know why the thing would break. A mark
measures the outcome where it happens, so a break nobody predicted still shows.
Both bugs above were found by use, not by any test written before them.

### Splits and limits: the 100 m dash

Sandy's picture: a robot must run 100 m in under 10 s. Rather than guess which
tests prove it can, measure its speed at points along the way, each with the
speed it must have there to finish in time — split times worked backward from
the goal. A missed split says where; the first missed split is where to look.

And limits beside the splits: the engine's heat never above a bound. When heat
breaks, the "why" (friction in a bearing, a badly wound coil, the wrong
material) is not missing from telemetry — it is the next layer down, with its
own marks. **Telemetry builds up**: every component has its promises, a
component's clause can be the promise of the part beneath it, and the marks
share a trace, so a break cascades down to its cause.

### Where marks go

The lag bug was invisible to the server — the server did everything right; the
break was in what the page drew. A mark belongs **where the promise is felt**,
often the browser. The admin needs a way to send marks from its pages to the
local daemon.

### Build it in, don't retrofit it

Sandy: decomposing a big existing codebase into useful telemetry is very hard;
building component by component from the bottom gives telemetry that cascades.
A project born through `new-project-flow` with marks as part of each
component's definition starts instrumented.

### Traffic and the counter-arguments

Raised and answered:

- "Telemetry needs traffic." The need to catch bugs grows with traffic, and so
  does the signal; a busy application has the most edge cases and the most data
  on them. Rare paths inside busy applications (month-end billing, restore,
  migrations) get marked harder; a release that reaches everyone at once is
  answered by gradual rollout watched by marks.
- Low-traffic mission-critical systems (rockets, F1) are the most instrumented
  machines there are; a static fire is a run read through its channels against
  budgets, and a test flight that explodes is a success if the data shows where
  the curve left its budget.
- "Splits say where, not why" — answered by layering: why is the next layer's
  marks.

### Cost

A span is on the order of a microsecond or a few in Node plus export; a metric
increment tens to hundreds of nanoseconds, aggregated before export (moderate
confidence; to be measured, see expectation 3). A span per line or per loop
iteration is too costly and floods storage. So: **splits are spans at
component boundaries, limits are metrics checked against their bound, depth is
added where incidents land**, and line-level "where" comes from a sampling
profiler (typically a percent or two) rather than marks on every line. The cost
is mostly data volume: **tail sampling** keeps every trace with a broken mark
and a share of the healthy ones.

### Why now: agents

Agents make tests cheap to write, so tests are no longer the scarce part. What
is scarce is an agent that reads a broken mark in production, walks the trace to
the cause, fixes it, and watches the mark return to kept — the outer loop.
Testing is a solved problem with an industry behind it; telemetry in the outer
loop is not, and it is what InDusk will be known for.

### The first worked example: the project conversation

The promise "a message you send gets a visible reply in the thread":

- **Splits** — the page draws the message (< 100 ms); the server hands it to
  the agent (< 200 ms); the agent shows it is working (< 1 s); its first words
  arrive (< 15 s); its reply is drawn in the thread (< 30 s).
- **Limits** — one agent session at a time; nothing is sent that the person did
  not type; a session ends only when the person stops it or the agent finishes.

The lag bug would have been the first split never marked kept; the Stop bug, a
message arriving with no agent running — before anyone knew a button was the
cause.

### Carried from `new-project-flow`'s audit (2026-10-14)

A fresh reader's audit of `new-project-flow` (its `audit.md`) found two
telemetry gaps; Sandy moved them here.

- **The `new_project.create` span goes nowhere.** Neither the admin nor the
  CLI registers a tracer provider, so the span is exported only if the
  production-break recorder happened to set one up in the same process — and
  then to its endpoint, which may be off the machine. Expectations 1, 2 and 5
  of `new-project-flow`, and the mitigations of its untestable rows U1 (the
  agent asks only what is open) and U2 (replies are short), all read this
  span. The admin needs one tracer provider exporting to the local daemon,
  which `a-page-can-mark-a-promise` needs for the server side anyway.
- **Three promises rest only on the prompt.**
  `an-unkept-project-conversation-leaves-nothing-on-disk`,
  `a-new-project-publishes-nothing-unasked` and
  `a-new-project-is-written-only-under-its-parent` hold because the agent is
  told not to break them. `new-project-flow` Build Phase 7 confines the
  conversation's tools; marks are still what proves them in use: a write
  outside the draft, a `git`/`gh` command, a project made outside the parent,
  each marked broken where it happens.

### First cut — only what `run-the-master` needs (2026-10-15)

Sandy: build this only as far as `run-the-master` needs, in order of
importance. Proposed first cut (to settle in the brief, in the UI):

- `a-plan-is-one-promise`, `a-promise-is-made-of-clauses`,
  `a-promise-can-rest-on-another`, `a-plan-plans-its-clauses`,
  `a-promise-is-upheld-or-broken`;
- `a-clause-is-upheld-by-its-signal` (renamed from `…-kept-by-its-mark`; "a
  passing test never stands in for its signal");
- **`a-clause-is-verified-before-release`** (Sandy: "that's really good"): a
  clause's tests must pass before anything ships; a change that makes one fail
  is stopped before release — verified by its tests before release, proved by
  its signal in use;
- change `a-closed-plan-kept-its-promises` to close on signals.

Two stages, one clause: **before release and on every change** — its tests,
*verified* or the change is stopped; **in use** — its signal, *holding*,
*broken* or *no signal*.

Carried from one-promise-language (Sandy, 2026-10-15): switch InDusk's signal writers and the demo app from writing `violated` to `broken` — every reader accepts both since one-promise-language.

Carried from one-promise-language's falsification (2026-10-15), three more for the same switch:
- **Two writers sit outside `markPromise`.** `apps/indusk-mcp/scripts/suite-speed.js:37` writes `indusk.promise.outcome` itself, and `indusk promises health --json` writes `runs[].outcome` for the editor (`lib/promises/health-line.ts`, kept `violated` this release so an editor installed earlier still reads a break as broke). The switch to `broken` changes both. The health line changes only once the editor extension shipped with this release has been out a release.
- **The registry state carries the same skew.** one-promise-language writes `known-broken` on opening an incident (`lib/promises/incidents.ts:232`), and an InDusk older than it refuses that state. Decide here whether a checkout on an older InDusk matters, and say so in this plan's ADR.
- **No signal drawn green** — returned to `one-promise-language` (Build Phase 5, Sandy 2026-10-15: fixed there, with the `promise-row.no-signal` mockup).

**The clause plan** (replacing the test plan): each clause with its signal
(where it is read, what counts as upheld — a budget for a split, a bound for a
limit — and what it reports when broken), and the tests tied to that clause,
chosen by the agents. The impl may add tests for pieces of implementation
besides. Tests are the agents', automated, never approved.

**Later cut**, after `run-the-master`: `a-break-leads-to-its-cause`,
`a-break-comes-with-a-diagnosis`, `every-broken-trace-is-kept`,
`a-page-can-mark-a-promise` (browser signals), `every-break-becomes-a-test`,
`a-person-sees-promises-not-tests`, and the promise page's clause looks. The
already-declared ones among them, and `a-message-sent-gets-a-reply`, are
withdrawn now (never in force) and re-declared then. "Mark" becomes "signal"
throughout, and the plan may be renamed to match.

### What changed since the brief was accepted (2026-10-16)

Three plans have landed since this brief was written, and the primitive was
reshaped in conversation (Sandy, 2026-10-16; `promise-core`'s master, "The
primitive"). This plan is written against the result, not the first cut above.

- **A plan holds one or more promises** (replaces `a-plan-is-one-promise`).
  Promises whose work shares code are one plan, with one approval, one branch
  and one falsify, cleanup and audit; promises that share none are separate
  plans under a master, which is only for display. A promise is permanent and a
  plan ends. Each promise gets its own clause plan, before the ADR.
- **`plans-are-promises` landed** (merged to `main` at `8235644ff`). It is the
  first of this plan's three origin plans and gives it everything below as
  existing behaviour: a brief states each promise as clauses (`clauses:
  required`; `split`, `limit`, `rests on`); `indusk promises declare --clause`
  records them in the registry and the contract check holds brief and registry
  equal; the clause plan (`test-plan.md`: one section per promise and per
  clause, each with its signal) is checked; a test row names `clause:
  <promise>/<clause>` and its test file carries the same token; closing
  confirms a promise only when every `split` and `limit` clause has a passing
  row and each promise it rests on is in force, including a sibling of the same
  plan; a resting cycle is refused. So `a-promise-is-made-of-clauses`,
  `a-promise-can-rest-on-another`, `a-plan-plans-its-clauses` and
  `a-plan-is-one-promise` from the first cut are done and are not this plan's.
  What it left, by design, is this plan's: its brief's "Not promised" handed
  proving a clause by its signal in use here.
- **`one-promise-language` landed.** The words — upheld, broken, holding, no
  signal — are in every reader; writers still write `violated` until this
  plan's switch (carried above).
- **Phases and clauses are many-to-many** (`run-the-master`, now a parent of
  three plans): one phase can prove clauses of several promises and one clause
  can take several phases. Not this plan's, but its closing rule must not
  assume one phase per clause.

Carried from `plans-are-promises`' audit and retrospective (deferred there, not
fixed, because each one is about the signal, which is this plan's):

- **A promise made only of resting clauses can never close**: no test row names
  it and it has nothing of its own to prove. Under this plan a promise's health
  can be its signal, so it can close on that.
- **Health and standing do not read resting clauses**: the promise page and
  `promises health` read a promise's own marks, not those of the promise a
  clause rests on. A clause "whose health is that promise's health" needs both.
- **`split` and `limit` are treated identically** by closing. They should not
  be here: a split's signal is a budget reached at a point, a limit's a bound
  that holds on every report.
- **No row covers** the MCP `declare_promise` `clauses` argument or the build
  review reading the registry; **`change` and `replace` cannot carry clauses**,
  so a clause cannot be edited after declaration (this plan re-declares its own
  promise for that reason: withdraw, then declare).
- **A clause's proof is by file, not by content.** Closing now requires a test
  file to carry `clause: <promise>/<clause>`, but nothing checks the file
  asserts the clause. That is `verified-before-release`'s to tighten.
- **`indusk plans start` fails under `indusk init --local`** (`.indusk/` is
  git-ignored): outside this plan, its own bug plan.

### How a signal gets written: the audit hands its concerns to the signal loop (Sandy, 2026-10-16)

The question this answers: telemetry should fail where a test could not have
broken, so it cannot be a copy of a test's assertion run in production. Settled
direction, from a summary Sandy pasted from another page:

- **`/audit` gets a seventh question**: "For each concern above, what signal
  would show us if it breaks? If telemetry isn't the answer, say so." The audit
  stays advisory; its `audit.md` shape and the six existing questions are
  unchanged.
- **Three answers per concern.** A **signal**: name the invariant to check and
  the place in the code that emits it (the default for "nothing prevents X"
  findings). A **fix**: a wrong sentence or a missing guard, where telemetry
  cannot help. **Nothing**: too unlikely or too cheap, with the reason stated.
- **Fire rate.** Each signal answer also says how often it would fire. A promise
  with no signal reads unknown, so a signal on a rarely run path leaves its
  promise unknown for a long time.
- **Tests come after**: a test is written when a signal breaks, not up front for
  every failure anyone can imagine. This does not remove the tests that prove a
  clause before release (`verified-before-release`); it says the audit's
  imagined failures are watched, and pinned only when they happen.
- **Example**: `a-finished-ritual-stays-done` would get a signal in the admin's
  plan reader, emitted on each read, reading broken when a ritual's phase is
  closed but its step does not read done.
- **Where it lives**: the audit skill's source is
  `apps/indusk-mcp/skills/audit.md`; the copy under `.claude/skills/` is synced
  from it, never edited directly.

**One word: signal.** `one-promise-language` settled "the telemetry a signal";
"mark" is one of the old words it replaced. This plan already switches the
writers (`violated` to `broken`), so the word cleanup belongs here. Still saying
"mark": the Day 4b entry in the root `CLAUDE.md` and this plan's own name.
Caveat: OpenTelemetry uses "signal" for traces, metrics and logs; in our docs it
always means a promise's signal.

Separate, not this plan's: `finished-rituals-stay-done`'s brief promises that a
skip counts as done, but the behaviour reads `skipped`. A one-line wording fix to
that brief.

### Audit against the goal (2026-10-16)

**The question Sandy put** (after the 1.71.0 release recorded seven test-derived
incidents and a reader found the admin emits no telemetry): is mark-first a real
plan for the goal — telemetry integral to a project built with InDusk from day
one, promises failing in production as a critical part of how the system works,
and eventually decisions taken from expectations and measurements — with
Homework Gate as the proving ground, not InDusk itself? "If we need to do more
than one plan, we can do that."

**How this was read.** A cold audit of 141 agents: seven readers, one subsystem
each (the scaffold, the signal write side, the read side, closing and the
skills, production and measurement, the plan documents and their decisions, the
real projects on this machine); one synthesis into gaps by the stage a new
project reaches; two evidence-only refuters and an owner lookup per gap (a gap
is refuted only by a file:line or a quoted plan line); a completeness critic
that added four readers (the Next.js scaffold's default endpoint, the log
channel, the editor extension, the evaluator) and sixteen more gaps; three
independent plan-structure proposals and a judge. Of 41 gaps, none was refuted;
one is contested (G12, below). The three headline claims were then checked by
hand on trunk: every reader of signals filters to `behaviour` promises
(`sources.ts:296`, `health.ts:505`, `status.ts:40`); Homework Gate exists at
`/Users/the_dusky/code/sandbox/homework-gate-workbench` with the Node scaffold
at the workbench root and `homework-gate/` holding one README; no
`~/.indusk/telemetry.json` exists while seven Jaeger/collector processes run.

**The answer.** mark-first is a sound plan for the *reading* side — how InDusk
closes a plan, keys a break, reads standing, and asks the audit for signals —
and it is honest about what it defers. It does not touch what a new application
is handed or emits. After it lands, a project created tomorrow starts exactly as
today (G25): an unwired instrumentation file at a root where no app runs, no
exporter endpoint, no signal helper, promises declared `state` that no reader
asks Jaeger about, and an otel skill that says to look in Dash0. Three of those
are worse than the plan assumed: the daemon InDusk reads on this machine is not
one of the three running (G11, G31, G32); the planner's kind rule plus the
readers' `behaviour` filter means a `state` promise's signal is written and
never read (G6) — and both of mark-first's own promises are `state`; and the
plan's own six clauses have "signals" read from the suite, the audit file and
the incident, which its own D2/D3 would refuse (first contradiction below). The
work the goal needs is five to seven plans, three of them before Homework
Gate's `indusk init`; mark-first stays one plan with about nine rows added.

#### What mark-first covers well

- Closing reads the system (tests run now, the daemon asked per clause, a stopped daemon a named refusal) — ADR D2, rows A1, A2, A9–A11.
- A signal produced by a test run is not the clause's signal (`indusk.run=test`) — D3, A5, A6.
- A break names its clause, with the plan and phase as a pointer and the tests reached through the clause — D1, A16–A18.
- Silence never reads as health; standing is the worst of a promise's clauses; a resting clause takes the standing of what it rests on; a promise of only resting clauses can close — D4, A12–A15.
- A signal is derived from the clause's sentence, never from a test — D6 (stated, not yet checked: G7).
- The audit becomes the front door for signals: the seventh question, three answers, fire rate, first-break cost, the menu of signal kinds — D5, A19–A24.
- Split and limit semantics are stated (D4, A8), though nothing holds a budget (G22).
- One word, the writers switch, older plans and promises unbroken, the `known-broken` skew decided, imperative tasks — D7–D9, A25–A32.

#### Where it falls short of the goal

Each row is one gap; "mark-first" says whether the plan as written covers it;
"For the goal" is its weight for Homework Gate: *blocks day one* (HG cannot start
instrumented without it), *blocks production* (HG can start but cannot prove
itself in production), *degrades* (the loop works but weaker), *later* (fine to
defer). Evidence is the first citation of several; the full set is in the
session's audit result.

**Day one: what a new project is handed**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G1 | Nothing wires a scaffolded app's exporter to the local daemon (or anywhere); every template falls back to the console (owner today: telemetry-destinations) | no | blocks day one | apps/indusk-mcp/templates/instrumentation.ts:31-40 (OTLP only when env set, else ConsoleSpanExporter); templates/instrumentation.web.ts:52-55,146-155 (same for the browser) |
| G2 | In a workbench, InDusk's telemetry lands at the wrong root: scaffold at the workbench, otel extension red, evaluator blind to the code repo | no | blocks day one | src/bin/commands/init.ts:914-924 (detection at projectRoot), :1000-1032 (Node path into projectRoot); src/lib/new-project/create.ts:390-404 (init run at workbench `root`) |
| G3 | No app-side way to write a signal: the helper is package-internal, the guide writes `violated`, and the clause key and test-run marker mark-first adds have no app-facing form (owner today: mark-first (partial — keys and writer switch only; the app-facing form is owned by no plan)) | partly | blocks day one | src/lib/promises/mark.ts:5,20-37 (markPromise, writes `violated`); package.json exports (no ./promises/mark |
| G4 | The Next.js scaffold carries no `deployment.environment`, no endpoint logic, and an unsafe client-wiring instruction | no | degrades | templates/instrumentation.next.ts:17-21; grep `deployment` over templates/instrumentation*.ts, logger.ts → none |
| G5 | init's day-one guidance is stale and an initialised project never receives a newer template (owner today: known-issues) | no | degrades | src/bin/commands/init.ts:1346 (`indusk infra start`; `indusk --help` has no infra) |
| G26 | `init` renames the service only in the template's comment: every scaffolded Node and Next.js app's spans report as `unknown-service` | no | degrades | apps/indusk-mcp/src/bin/commands/init.ts:947, :992, :1017 use `content.replace('"unknown-service"', `"${projectName}"`)` — a string pattern, first occurrence only; apps/indusk-mcp/templates/instrumentation.ts:12 (docblock) precedes :44 (code), templates/instrumentation.next.ts:8 precedes :19 |
| G31 | The opportunistic daemon auto-start on `init`/`update` bumps ports and spawns a new daemon whenever the record reads 'not running', re-pointing every registered project's `.mcp.json`, while every app-side writer still says 4318 — Homework Gate's own creation spawned this machine's third Jaeger (owner today: instance-ports) | no | blocks day one | apps/indusk-mcp/extensions/local-telemetry/manifest.json hooks.on_enable = `indusk telemetry register $(pwd)`; apps/indusk-mcp/src/bin/commands/telemetry.ts:257-266 (`daemonStart({ allowPortBump: true })` 'on purpose') and :276-281 (`syncAllRegisteredProjectsMcp`), :36-52 |
| G36 | Nothing on the day-one path installs the editor, and `indusk update` does not refresh an installed one | partly | later | grep 'editor install\|indusk editor' over apps/indusk-mcp/src/lib/new-project, src/bin/commands/{init,setup,update}.ts, skills/, templates/ → none; apps/docs/src: only changelog.md, guide/promises-in-your-editor.md, decisions/vscode-extension.md, reference/cli/editor.md |
| G38 | `recommendations[]` from the admin's new-project flow is written and consumed by nothing; creation runs the same `init --workbench` either way and local-telemetry is required by default, so enablement is only the directory under `.indusk/extensions/` | no | later | apps/indusk-mcp/src/lib/new-project/create.ts:206-225 (`recordChoices` writes `recommendations`), :391-404 (`cli.js init --workbench --wrapped-repo … --no-index`, no reference to recommendations); src/lib/config.ts:285-289 (type only) |

**Planning: promises, kinds and the clause plan**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G6 | The planner's kind rule sends nearly every promise to `state`, and every reader of signals filters to `behaviour` — a state promise's signal is written and never read | partly | blocks production | apps/indusk-mcp/skills/planner.md:93 (kind rule); src/tools/promise-tools.ts:53-57 (same wording in declare_promise) |
| G7 | The clause plan's `Signal:` line is free prose checked only for non-emptiness, and the `promise` test level has no runner | partly | degrades | src/lib/promises/clause-plan.ts:14-15,29,59-60 (`signal: string \| null`, SIGNAL_LINE regex, trimmed text); src/lib/promises/clause-rules.ts:88-91 (only `sub.signal === null` refused) |
| G28 | Homework Gate's brief states its measurements as logged events and the otel skill teaches pino INFO as the home of business events, but the promise loop reads span tags and span events only, and no skill says a log line is not a signal | partly | degrades | /Users/the_dusky/code/sandbox/homework-gate-workbench/.indusk/planning/project-brief.md:98 ("Each hint level is logged per problem"), :105 ("the rewrite is logged"), :188 ("leaks logged"); apps/indusk-mcp/extensions/otel/skill.md:135-157 (INFO = business events) and templates/logger.ts:16 |

**Building: gates, phases and the evaluator**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G8 | The per-phase OTel gate asks for span hygiene, never for a clause's signal, and is absent for bugfix, spike and release-drafted fix plans | no | degrades | skills/planner.md:670-676 (OTel gate text: 'manual spans with `otel.category`'); hooks/check-gates.js:296-305,568-586 (checked-or-overridden only) |
| G34 | The editor draws every state and structure promise green 'watched by the tests' by kind alone, before any source is read — a declared promise with no tests and the seven known-broken promises on trunk included — while the admin draws the same promise grey 'no signal yet' and `promises status` says 'watched by the suite' | partly | degrades | apps/vscode-extension/src/core/markers.ts:62-70 (`if (promise.kind !== "behaviour") return { text: "watched by the tests", tone: "ok" }` at :70, before `sourcesInOrder` at :71); hover.ts:12-14 |
| G35 | The editor joins a promise's test and site paths to the workspace root and activates only where `.indusk/config.json` sits; in Homework Gate's workbench those paths are the code repo's, and a window opened on the repo or a plan worktree never activates, silently | no | degrades | apps/vscode-extension/src/extension.ts:41-44 (root = first workspace folder with .indusk/config.json; `if (!root) return;`), :91-96 (`join(root, site)`) |
| G37 | Between approval and close no commit is asked whether it emitted its clause's signal: the eval rubric has no telemetry question, the evaluator may not call the jaeger MCP, usually has no transcript, and sees promise state only on its first run per checkout | no | degrades | apps/indusk-mcp/src/lib/eval/rubric.ts:10-45 (five questions; :4-5 'adding a question is adding a line') |
| G39 | A retired promise's token reads 'not in this project', never 'retired': the line drops retired promises from `promises` and the editor returns before reading the grey row | no | later | apps/indusk-mcp/src/lib/promises/health-line.ts:133-134 (`.filter((p) => p.state !== "retired")` for `promises`) while rows are built over all `registry.promises` (:160-162) and health.ts:485 returns grey for retired; apps/vscode-extension/src/core/markers.ts:66-68 (`if (!promise) return { text: "not in this project" … }` before the row is read) |
| G41 | The outcome-reading rule is copied into the editor because `promises/vocabulary` is not in the package's exports; when D7 flips the wire word a stale copy drifts | partly | later | apps/vscode-extension/src/core/activity.ts:6-7 ('copied from the package's `readOutcome`, which the extension does not import'); apps/indusk-mcp/src/lib/promises/vocabulary.ts:172-176 (`readOutcome`) |

**Local proof: the daemon on the laptop and the local loop**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G9 | No gate or skill ever asks the local daemon whether a clause reported during the build; 'local proof' has no runnable shape before close | partly | degrades | skills/verify.md:58-77,143-154 (grep -i 'trace\|telemetry\|jaeger\|daemon' → none); skills/work.md:59,281-284 |
| G10 | The local loop does not close unasked: a laptop break becomes an incident only by hand, reads red until then, and vanishes on daemon restart | no | degrades | apps/indusk-admin/src/instrumentation.ts:34-39 (hasProduction gate); src/lib/admin/recorder-loop.ts:4-9 |
| G11 | On this machine the daemon InDusk reads is not the one running: no meta file, 'not running', yet three Jaegers and four collectors are up (owner today: known-issues) | no | blocks day one | ls ~/.indusk/telemetry.json → No such file; ps: jaeger 60080, 68711, 69702 and otelcol 50723, 60081, 68712, 69741 on ~/.indusk/telemetry-jaeger.yaml / telemetry-collector.yaml |
| G12 | The one worked example of a signal is red and no live instance shows a signal reaching a daemon and being read back — contested, see below | partly | degrades | .indusk/promises/the-demo-break-is-caught-locally.md and the-demo-app-starts-with-its-promise-holding.md (state: known-broken); .indusk/promises/incidents/i-2026-10-16-the-demo-break-is-caught-locally.md (source: release, tests: A4/A7, release: 1.71.0 at 019d354, no traces:) |
| G27 | The structured-log channel has never carried a record: logs POST to Jaeger's port (404, swallowed), the documented logs port 4319 is never bound, and the port the daemon did take is written to telemetry.json and read by nothing | no | degrades | templates/logger.ts:31-46 (OTLP target only when OTEL_EXPORTER_OTLP_ENDPOINT set; protocol http, no url) |
| G30 | Trace correlation as the otel skill teaches it never reaches the log record (camelCase keys vs the transport's snake_case), and the diagnosis pattern calls `tail_logs` with parameters it does not have | no | degrades | apps/indusk-mcp/extensions/otel/skill.md:171-182 (`getTraceContext` returns `{ traceId, spanId }`) and :246 (checklist: verify `traceId` and `spanId` in log records); otlp-logger@2.0.0 lib/otlp-logger.js:99-110 (destructures trace_id, span_id, trace_flags |
| G32 | The daemon's recovery commands cannot recover the state InDusk itself created, and a read can delete the record that is the daemon's only identity (owner today: known-issues) | no | blocks day one | apps/indusk-mcp/src/lib/telemetry/daemon.ts:352-376 (`assertRequestedPortsFree` throws PortsOccupiedError when 4318/16686 listen; text offers reap / --allow-port-bump / explicit ports) |

**Production: the recording server and what reaches it**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G13 | Production is wired by hand twice and read by nothing mark-first builds: closing reads the local daemon only, and HG would be the first project whose production source is read at all | no | blocks production | src/lib/server/connect.ts:84-90 (writes promises.jaeger, not the app's env); src/bin/commands/server.ts (no application wiring) |
| G14 | The outer loop has no unattended trigger off a laptop: the server detects and notifies only (owner today: workbench-watch-provisioning) | no | degrades | apps/docs/src/decisions/day-always-on.md § Detect and notify only; src/lib/always-on/pass.ts:19-23,131-162,247-318 (query by outcome tag, Slack, no registry) |
| G15 | A failing slow test at release and a production break produce the same incident, registry state and 'A promise broke in production' message | partly | degrades | src/lib/promises/test-incident.ts:135,161 (ensurePromiseCarries → known-broken); src/lib/release/announce.ts:24-34 (kind: 'break') |
| G16 | One production source, one alarm, and no project tag on an application's spans: staging and a second project on a shared server are not told apart | no | later | src/lib/promises/sources.ts:43 (SourceName), :73-75; apps/docs/src/decisions/promise-sources.md:49-50 ('Two sources, not a list') |
| G17 | HG's privacy rule (attribute allowlist, redaction) has no home: the daemon and the always-on image run Jaeger with no processors | no | blocks production | packages/telemetry-binaries-shared/jaeger-config.yaml:23-29,47-51; src/lib/telemetry/server.ts:258-267 (traces pipeline only) |
| G18 | No sampling, tail sampling or per-signal cost control exists, and the reader's cost scales with services × promises × aliases per refresh | partly | later | grep -i sampl over src/lib/telemetry, templates, docker, packages/telemetry-binaries-shared → none; grep MeterProvider\|sdk-metrics over src, templates, examples/seat-holds/src → none |
| G19 | HG's non-Node components and its production-only clauses have no path to a signal or to closing | partly | degrades | src/bin/commands/init.ts:914-924 (single-root detection), templates/ listing (instrumentation.{ts,next.ts,web.ts,py} only); homework-gate-workbench/.indusk/planning/project-brief.md:57-70,149-151 (.NET service, Swift app, enforcers keep enforcing without the server) and master.md:25,30-31 (plan 1 'No server code' |
| G29 | Production stores no logs: the recording server is a traces-only Jaeger pipeline, the always-on image runs `indusk telemetry serve`, and the scaffold posts logs to https://your-server/v1/logs where nothing stores or reads them | no | degrades | apps/indusk-mcp/src/lib/telemetry/server.ts:259-263 (`pipelines: traces:` only), :295-306 (receivers otlp http with basicauth; exporters jaeger_storage_exporter) |
| G33 | A Next.js app with no endpoint set exports to localhost:4318 by SDK default — on the laptop into whatever holds 4318, on Fly into its own machine — and nothing proves the application reached the server: `server connect`'s probe proves the server hears the dev machine | no | blocks production | apps/indusk-mcp/templates/instrumentation.next.ts:17-21 (`registerOTel({ serviceName })` only; header :7-10 states no default) |

**Measurement and decisions: expectations and trends**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G20 | Expectations are write-only: nothing reads a Measure, fires at a Look, records a measurement or revisits them (owner today: expectations-loop) | no | degrades | src/lib/promises/brief-contract.ts:46-51,280-295 (three strings; refusal without Measure/Look) |
| G21 | Nothing exists toward decisions from measurements: no trend, the only aggregate is per promise and per machine, and the server forgets before the 90-day look (owner today: expectations-loop) | no | degrades | grep -i 'chart\|sparkline\|trend\|percentile\|p95\|latency' over apps/indusk-admin/src (non-test) → no files; src/lib/promises/standing.ts:51-55,77-117,157-187,216 (readHeard(home)) |

**Cascade: a break leading down to its cause**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G22 | A split's budget and a limit's bound have no machine-readable home, no reader compares a measurement against one, and the measured value is not carried into a break | partly | degrades | src/lib/promises/registry.ts:43-49 (clause fields), :300-304; src/lib/promises/clause-plan.ts:14-15 |
| G23 | 'Telemetry builds up' — a component's clause as the promise beneath, marks sharing a trace so a break cascades to its cause — has no substrate beyond a registry `rests_on` field (owner today: mark-first (partial: standing read down a resting clause); the trace-walk from a broken clause to its cause is the "later cut" named in mark-first's brief and research, owned by no plan folder; the graph that shows the cascade is activity-and-graph (run-the-master child, no brief)) | partly | degrades | research.md:61-66 ('Telemetry builds up … a break cascades down to its cause'), :95-96; promise-core/master.md:207-214 (the graph: 'the line down the shared trace leads to the cause') |

**The browser: where a web app's promises are felt**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G24 | Signals from where a web app's promises are felt — the browser — are deferred; the web template only traces, defaults to the console, and loses a click across a native `await` | no | degrades | templates/instrumentation.web.ts:146-177 (provider + propagation, no promise attribute); research.md:68-73 ('A mark belongs where the promise is felt, often the browser'), :122-124 (first split '< 100 ms' is page-drawn) |

**Other**

| # | What is missing | mark-first | For the goal | Evidence |
|---|---|---|---|---|
| G25 | mark-first reshapes InDusk's own closing rule, not what a new application is handed or emits — HG's day one is unchanged by it | no | blocks day one | brief.md:38-48,76,91; adr.md:106-113 |
| G40 | Every local Jaeger tries to export its own traces to localhost:4317 and warns repeatedly: 80,230 such lines in the 45 MB telemetry.log the person is told to read (owner today: known-issues) | no | later | `grep -c 4317 ~/.indusk/telemetry.log` → 80230 (file 45,270,317 bytes); apps/indusk-mcp/src/lib/telemetry/daemon.ts:205-209 (`telemetry: … metrics: level: none`, nothing for traces) |

**The five that block day one, in words.**

- **G1 / G33 — the scaffold's exporter goes nowhere a reader reads.** The Node
  and browser templates export to the console unless an env variable is set;
  nothing InDusk ships writes it for a project (only `indusk demo` writes it, for
  the demo's own process). The Next.js template delegates to `@vercel/otel`,
  whose default is `http://localhost:4318` — so HG's server spans would go to
  whichever Jaeger holds 4318 on the laptop (today a stray no reader follows),
  and on Fly to the app's own machine. Either way `promises status` never sees a
  `homework-gate` service.
- **G2 — in a workbench the scaffold lands at the wrong root.** The admin's
  new-project flow runs `indusk init --workbench` at the workbench root, where
  runtime detection finds no `next.config` and writes the Node scaffold for a
  runtime nobody chose; nothing re-runs detection inside the code repo later.
  Observed: `homework-gate-workbench/instrumentation.ts`, `logger.ts`,
  `filtering-exporter.ts` with uninstalled imports; `homework-gate/` empty but
  for README; the otel extension red on its own health check; the evaluator's
  first run failed for want of `.mcp.json` in the code repo.
- **G3 — no app-side way to write a signal.** `markPromise` is internal to the
  package (not in its exports; day-monitor rejected a runtime helper), the
  promises guide shows two hand-set attributes and still writes `violated`, and
  the keys mark-first adds (`indusk.clause`, `indusk.signal.plan/phase`,
  `indusk.run`) have no app-facing form in any template, skill or guide. A typo
  in an attribute name is silent: the clause reads "no signal" forever.
- **G11 / G31 / G32 — the daemon the readers follow is not the one running.**
  `telemetry register`, run by the local-telemetry extension on every
  `init`/`update`, starts a daemon with port bumping whenever the record reads
  "not running", then rewrites every registered project's `.mcp.json` (2,681 of
  them) to the new MCP port; the record itself can be deleted by a read. This
  machine now has three Jaegers and four collectors, no record, and every
  app-side writer says 4318. `telemetry start` refuses (ports held), `reap`
  kills nothing (the configs exist), `stop` finds no record. Homework Gate's
  own creation on Oct 12 spawned the third Jaeger. mark-first's D2 would refuse
  every close on this machine until this is fixed by hand.
- **G25 — the plan reshapes InDusk's closing rule, not the new project's day
  one.** Its documentation plan changes guides and skills for plan authors, not
  `init`, the new-project library, `server`, the templates or the otel skill;
  the brief parks new-project-flow's telemetry gaps in known-issues.

**The four that block production.** G6 (every HG promise the planner calls
`state` — "recreation unlocks only after a passing quiz", "the parent sees the
score within N seconds" — has its signal written and never read); G13
(production is wired by hand twice, app secrets and `promises.jaeger`
separately, and nothing checks they name the same server; closing reads the
local daemon only); G17 (HG's founding brief promises no student content in
telemetry, with an allowlist and a Collector redaction processor; the daemon's
pipeline is `otlp → batch → memory`, the always-on image traces-only, and no
redaction exists anywhere); G33 (nothing proves an application's span reached
the server — `server connect`'s probe proves the server hears the dev machine).

**G12, contested.** The synthesis said the one worked example of a signal (the
demo) is red and nothing shows a signal reaching a daemon and being read back.
The code refuter refuted the headline with the release's own record: the slow
tier's JUnit output shows `indusk demo` working end to end — `promises status`
read "last seen holding … (bd50300e…)" and "1 break in the last 15m … seat 2
released 5.1 s late" from the demo's own daemon. The tests are red because
their expected words are stale: `demo-command.test.ts` expects `/last seen
upheld/` and `/violations?/` where `status.ts` has printed "last seen holding"
and "N break(s)" since one-promise-language (2026-10-15). `monitor-status` A7
failed the same way. So the two demo promises are `known-broken` from a test
file's exit code, their incidents say "Root cause: unwritten", and the loop
they describe works. What the plan refuter upheld: nothing in mark-first fixes
those words, makes the demo a green reference, or reconciles the scaffold's
dead OTel files beside the demo's hand-written `telemetry.ts`.

#### Contradictions the readers found

1. **mark-first cannot close under its own rule.** Four of its six clauses have
   `Signal:` lines read from the suite run, the audit skill's text and
   `audit.md`, or the incident — none is telemetry, and D2 (closing asks the
   daemon per clause) with D3 (a test-run span is not a signal) would refuse
   them. The contract check accepts the lines because it checks non-emptiness
   only (`clause-rules.ts:88-91`).
2. **Both promises are `state`, and no reader reads a state promise's
   signal.** `a-clause-is-proved-twice` is `kind: state`; rows A4 and A12 assert
   a clause reads upheld / no signal on the promise page and in `promises
   status`, which today's readers cannot do for a state promise
   (`behaviourOf`, `health.ts:505`, `status.ts:39-41`).
3. **The primitive says every clause has a signal and a plan is done when every
   clause has reported; D6 says the plan does not force one for pure rules,
   older plans close on tests, and expectation 1 counts clauses still reading
   no signal as an expected population.**
4. **"Expectations are the one part already measured from telemetry"**
   (research) — nothing reads an expectation's Measure; planner-promises said
   building and reading that telemetry is a later plan; the admin's
   `ExpectationRow` has a `due` prop nothing sets (G20).
5. **The telemetry overview says enabling local-telemetry writes the app's
   OTLP endpoint; the extension's own skill says it does NOT configure services
   to emit**, its `.env.example` is headed "NOT CONSUMED BY ANYTHING", and the
   otel skill's checklist says to look for the service in Dash0, which the root
   `CLAUDE.md` disables.
6. **otel-extension (2026-03-31) promised "every project created with init is
   observable from day one"**; the templates default to the console, `--local`
   skips OTel, and a workbench init scaffolds where no app runs.
7. **day-monitor rejected a runtime helper and the guide writes two attributes
   with `violated`; D1/D3/D7 grow what an app must write to five keys with
   `broken`** and the documentation plan leaves the guide's marking section,
   the otel skill and the templates untouched.
8. **The `promise` test level ("continuously, by the watcher") has no runner**;
   mark-first uses it zero times (31 unit, 1 live check).
9. **A release-born incident (a failing slow test) is told to every agent as "A
   promise broke in production"**, flips the registry to `known-broken`, and the
   fix prompt demands `record_breaks`, refused for a local-only project (G15).
10. The ADR says 154 promises are 155 (the earlier count included the
    `incidents` directory).
11. **"Looks: None"**, yet D1 changes what an incident shows first and D4 what
    the promise page reads per clause; `a-promise-page-shows-its-proof` is in
    neither the must-not-break nor the changes list.
12. The vocabulary says an app's own spans need no `indusk.project` tag; the
    reader keeps a span with no tag, so two apps sharing a server with the same
    promise name count each other's marks (G16).

**Corrections to what was said earlier today.** 154 promise files, not 155. The
demo loop works (above). The admin's own code has no tracer, but the admin
daemon registers one through `recordBreaks` → `initEvalOtel` — only for projects
naming a production source. A Next.js app with no endpoint set exports to
`localhost:4318` by SDK default, not the console.

#### The proposed structure (the judge's synthesis, three proposals weighed)

A master `telemetry-from-day-one`, display only, a `promise-core` child beside
`run-the-master`. Plans 1–3 land before Homework Gate's `indusk init`; 4–5
while HG's first plans build and before its first Fly deploy; 6 before HG's
first release plus 30 days; 7 is Sandy's call. Nothing delays `run-the-master`
except the rows added to mark-first.

1. **`daemon-found-not-guessed`** — first, blocked by nothing. Promise
   `the-daemon-readers-follow-is-the-one-running`: a read never deletes the
   record (limit); a running daemon is found without its record (split: rebuild
   from the process list; `telemetry start` adopts an InDusk-owned listener on
   4318/16686); register never spawns beside a running one (limit: no port bump,
   no rewriting other projects' `.mcp.json` while an owned daemon serves — folds
   in the `instance-ports` draft's first two promises); reap clears InDusk's own
   strays; the log is readable (Jaeger self-tracing off — 80,230 warning lines
   today); the logs port is recorded and shown. Closes G11, G31, G32, G40, G27
   (daemon half). Today's strays are killed by hand once.
2. **`mark-first`, as changed** (brief unchanged; ~9 rows added; still blocks
   `run-the-master`). Changes below. Closes G6, G7 (minimal), G8 (gate text),
   G9, G3 (keys half), G28 (one sentence), G22 (optional).
3. **`a-new-project-starts-instrumented`** — blocked by plan 1 (the endpoint it
   writes) and by mark-first's ADR acceptance (the helper's keys); blocks HG's
   init. Three promises: `a-new-project-reports-from-its-first-run` (the
   scaffold sits where the app runs — detection in the declared code repo,
   re-run on `indusk update`; the service is named in code, not a docblock; the
   exporter points at the daemon that is running — an `.env.indusk` with
   `OTEL_SERVICE_NAME`, the OTLP and logs endpoints and `NEXT_PUBLIC_` forms
   resolved from the daemon's record; `deployment.environment` and
   `indusk.project` on every span; a newer template offered, not forced);
   `an-app-writes-its-signal-from-a-helper-it-owns` (`src/signal.ts`, plain
   OTel, no InDusk dependency, generated from `promises/vocabulary.ts` or
   pinned to it by one test; the vitest setup sets `indusk.run=test`; the
   exporter passes only allowlisted attribute keys when configured);
   `a-new-project-is-told-the-truth` (next steps exist; the skills name the
   daemon, not a vendor; a log line is not a signal; the correlation example
   uses the transport's real keys). Carried: a declined telemetry
   recommendation writes `disabled_extensions`; init prints `indusk editor
   install` once; the demo's dead scaffold files reconciled and the stale test
   words fixed with the root cause written into the open incidents. Owns the
   otel, testing and local-telemetry skills wholly. Closes G1, G2, G3 (app
   side), G4, G5, G12, G17 (at-source half), G19 (documented path), G25, G26,
   G27 (app half), G28, G30, G31 (app side), G33 (local half), G36 (day-one
   half), G38. Largest plan; if it stalls, split placement/naming/endpoint/
   environment first, skills/truth second.
4. **`production-is-heard`** — blocked by plan 3; before HG's first Fly deploy.
   Promise `an-application-is-heard-by-its-server`: deploy hands the app its
   wiring (`server deploy`/`connect` write the exporter settings into the
   doppler production profile or print the exact `fly secrets set` line, from
   the same value as `promises.jaeger`); arrival is proved by the app's own
   service (`promises status --source production` names the last span per
   `service.name`; a server hearing only `indusk-watcher` reads "server
   reachable, application silent"); a mismatch is named (limit). Closes G13,
   G33 (Fly half), G4 (production environment).
5. **`production-keeps-only-what-it-should`** — parallel with 4; before student
   data reaches a server. `a-span-never-carries-what-the-project-forbids`
   (`telemetry.redact` in config; both rendered pipelines run a redaction
   processor) and `the-log-channel-is-local-or-it-is-stored` (the pino OTLP
   transport on only where a logs sink exists). Closes G17 (server half), G29.
6. **`a-look-comes-due`** — the first child of `expectations-loop`; before HG's
   first release + 30 days. `an-expectation-is-looked-at-when-due`: a due look
   is listed (`indusk expectations due`, the admin's `due` prop, /catchup); a
   measurement is recorded in the brief (`indusk expectations record`, a dated
   `Measured:` line the contract check accepts). Closes G20; G21's trends and
   retention stay `expectations-loop`'s.
7. **Optional — `a-break-on-the-laptop-closes-its-loop`** — blocked by
   mark-first's D1. `a-local-break-is-recorded-unasked-when-local-is-the-only-
   source` (REVERSES `the-demo-break-is-caught-locally`, Sandy's 2026-10-08
   choice) and `a-red-suite-is-not-a-production-break` (a release-sourced
   test-failure incident gets its own inbox kind, hook words, amber standing
   and fix prompt). Closes G10, G15. Wanted before HG's no-server weeks produce
   breaks nobody records.

**Later, named so absence is not oversight:** `the-editor-reads-what-the-admin-
reads` (G34, G35, G39, G41, G36's refresh half; one plan, after the editor's
one-release wait on the wire word); `every-commit-is-asked-about-its-signal`
(G37, droppable); `a-clause-carries-its-budget` in full (G22's comparing reader,
G7's budget parsing); a staging source (G16); sampling and reader cost (G18, the
later cut's `every-broken-trace-is-kept`); G14's write-back
(`workbench-watch-provisioning`); G23 cascade and G24 browser signals (the later
cut, as chosen).

**Changes to mark-first** (its clause plan and proposed ADR, neither approved;
the brief's two promises, six clauses and later cut stand):

1. Readers read a clause's signal regardless of its promise's kind — forced by
   A4 and A12. D4 gains "the Jaeger read is keyed by promise/clause for any
   promise with clauses, not gated on kind"; `planner.md:93`'s kind rule is
   rewritten so kind says what breaks a promise, not whether its signal is
   read. Two rows.
2. D6 becomes one check: `promises contract` refuses a `Signal:` line naming a
   test file, "the suite", an `audit.md` or an incident, and requires a span or
   event read from the daemon or the production source. One row.
3. Per-phase proof: a Verification item for any phase whose rows name a clause
   — `indusk promises status --clause <promise>/<clause>` prints upheld — and
   `/work` runs it. One row; no hook change, so no collision with
   `run-the-master` on `check-gates.js`.
4. The planner's Build Phase OTel item reads "each clause this phase names
   emits its signal and is seen in `promises status`".
5. The plan's own four non-telemetry `Signal:` lines are made honest: `promises
   confirm` emits one span per clause it judges, the audit step emits the two
   audit clauses' spans when it writes `audit.md`, the incident writer emits
   the event for `a-break-names-its-clause` — through one lazy tracer provider
   for the package's own commands (lift from `lib/eval/otel.ts`), defaulting to
   the local daemon, silent when none runs, `indusk.run=test` under vitest.
   This takes back the known-issues item the brief's Carried tail parks ("the
   `new_project.create` span goes nowhere"). Without it the plan cannot close
   under D2.
6. `markPromise` takes `{promise, clause?, outcome, value?, bound?}`; the test
   helper and the testing extension's vitest setup set `indusk.run=test`; the
   promises guide's marking section, the testing skill and a new
   `guide/signals.md` teach the keys with `broken`; `vocabulary.ts` is the one
   definition plan 3's `signal.ts` is generated from.
7. Optional, one row: D1 adds `indusk.signal.value`/`bound`; the incident's
   symptom carries them.
8. The clause-plan template's Signal line: "a span or event, never a log line".
   Bookkeeping: 154, not 155; if D1/D4 change the promise page per clause,
   `a-promise-page-shows-its-proof` goes into the brief's Changes list (a
   one-line amendment that pauses the build for re-approval — do it at the same
   sitting as the clause-plan changes).

**What Homework Gate gets on day one after plans 1–3:** one daemon the readers,
the admin, the editor and the app agree on; `create-next-app` in
`homework-gate/` then one `indusk update` writes instrumentation with
`service.name homework-gate`, `.env.indusk` with the live endpoints and
environment, `src/signal.ts` with the typed keys and the test marker, and
`.mcp.json` so the evaluator scores the first commit; `next dev` puts
`homework-gate` in the local Jaeger; a route handler's `signal.upheld(...)`
reads upheld in `promises status`, the promise page and the admin whether the
promise is state or behaviour; every build phase that names a clause carries a
runnable check; the otel skill names the daemon and says a log line is not a
signal. Still by hand: production until plans 4–5; local breaks a red chip
until 7 (if chosen); looks unnoticed until 6; browser-felt clauses marked
server-side (the later cut, as chosen); .NET and Swift emit plain OTLP from the
docs. Sequencing: HG's first plan should be one with server code, not the
lockdown runbook, or expectation 2 ("signals cost little", measured on HG's
first plan) has nothing to measure.

#### Decisions only Sandy can make (none taken here)

- Widen mark-first (clause-keyed readers regardless of kind + a tracer provider for InDusk's own commands, ~9 rows, delaying run-the-master by that much) or re-kind its two promises as `behaviour` (cheaper, but every HG `state` promise's signal is written and never read)?
- Put the per-phase `promises status --clause` verification item and the OTel gate text inside mark-first now (lands before run-the-master, no later hook collision) or in a follow-on after run-the-master (narrower mark-first, but HG's first phases build with no per-phase proof)?
- Reverse `the-demo-break-is-caught-locally` (your 2026-10-08 choice) so a project naming no production source records local breaks as incidents unasked — HG's no-server weeks record what the agent breaks, at the cost of one more plan before those weeks — or keep a local break as work in progress until the server exists?
- Is HG's at-source attribute allowlist (plan 3) enough to deploy with student data, or must the server-side redaction plan (plan 5) land before HG's first Fly deploy, adding a plan to the pre-deploy path?
- The scaffold plan: one plan with three promises and eleven clauses (one approval, longest to land) or two (placement/naming/endpoint/environment first so HG can init sooner, skills/truth second — two approvals)?
- Scaffolded apps reach the daemon by a fixed 4318 the daemon always holds (no env file needed, any SDK default works, but a taken port must refuse loudly) or by an env file written from the daemon's recorded port (survives collisions, but every app needs the written file and a port change rewrites it)?
- Make HG's first plan one with server code (apps/server) rather than the lockdown runbook, so mark-first's expectation 2 ('signals cost little', measured on HG's first plan) has something to measure — changing HG's milestone order?
- Brief `a-look-comes-due` now as expectations-loop's first child (a due list and a `Measured:` line before HG's first 30-day look) or wait for expectations-loop's full brief after run-the-master and read HG's first looks by hand?
- Is the daemon's file-backed trace store (standing survives a daemon restart) a store flag you will allow in plan 1 or 7, or does it count as pulling `every-broken-trace-is-kept` out of the later cut?
- Kill this machine's three stray jaegers and four otelcols by hand today (unblocks A11, the live check that a signal through the local daemon reads upheld end to end) or wait for plan 1 (about a week) and let mark-first's /work stall at that row?
- If D1/D4 change what the promise page shows per clause, amend the brief's Changes list with `a-promise-page-shows-its-proof` at the clause-plan sitting (one re-approval pause) or leave the page's change implicit?

### The merged plan — proposed rework of the brief (2026-10-15, parked)

`mark-first` merges with `promise-first-build` (see `promise-core`'s master,
"Settled 2026-10-14/15"). Proposed to Sandy, not yet decided — parked while
`template-reload-on-cold-cache`, `decided-prompts-stay-closed` and
`cockpit-audit-fixes` finish:

- **Keep:** `a-promise-is-made-of-clauses`, `a-promise-can-rest-on-another`,
  `a-break-leads-to-its-cause`, `a-page-can-mark-a-promise`,
  `every-broken-trace-is-kept`, `a-break-comes-with-a-diagnosis`.
- **Rename:** `a-clause-is-kept-by-its-mark` → `a-clause-is-upheld-by-its-mark`.
- **Add:** `a-plan-is-one-promise` (done when every clause's mark has reported
  it upheld); `a-plan-plans-its-clauses` (the clause plan replaces the test
  plan: each clause with its mark, tests beside); `a-person-sees-promises-not-tests`
  (tests are the agents', never shown for approval);
  `every-break-becomes-a-test` (fixing a break adds a test on that clause);
  `a-promise-is-upheld-or-broken` (marks, registry and pages say
  upheld/broken/holding; an old `violated` is still read).
- **Drop:** `a-message-sent-gets-a-reply` — Homework Gate is its own project,
  so its promises live in its own registry; the proof there becomes an
  expectation: Homework Gate's first plan, written as one promise of clauses,
  has every clause marked and reporting.
- **Changes:** `a-closed-plan-kept-its-promises` closes on marks;
  `a-promise-page-shows-its-proof` shows clauses.
- **Looks:** unchanged; approval screens fold into `looks-as-promises`.
- **Task wording** (Sandy, 2026-10-15): an impl's tasks are written in the
  imperative — "Make the browser template's test project read the pre-bundle
  list from the root configuration" — so an unticked task reads as work to do;
  verification items stay as end states that must hold ("The two new tests
  pass…"). Today's end-state task wording read as already done. A change to the
  planner's phase-summary rule (`skills/planner.md`, the planning `CLAUDE.md`
  template), for new impls only.
- **Task tags — later, with `run-the-master`** (Sandy, 2026-10-15, "we don't
  have to do that right now"): each task says which files it will touch and what
  kind of change it is (state, refactor, new behaviour, …), so a person sees the
  shape of the work at a glance and the scheduler knows which phases can run in
  parallel.

## Decisions

- **Tests stay.** Sandy: "I don't want to remove tests." Marks become the
  definition of a kept promise; tests become support. Not a no-tests rule.
- **Mark first is the heuristic**: less tests, more telemetry as the direction
  of attention, not an absolute.
- **The Homework Gate no-tests challenge** (build it with marks only) waits on
  this plan: it is only a fair test once telemetry is serious.
- Each clause is defined by its mark; a clause with no mark is not finished.

## Open Questions

- How a clause is written in a brief, given the brief's one-sentence-per-promise
  shape (the ADR's question).
- Whether a `state` promise (one a test can prove) needs a mark too, or only
  promises about the running system. Leaning: every promise that has a running
  system to watch gets one; a build-time `structure` promise keeps its check.
- Where the automatic loop's diagnosis lives: in the incident, in the reopened
  plan, or both.

## Sources

- `/decisions/day-monitor`, `/decisions/watcher-heartbeat`,
  `/decisions/promise-sources`
- `.indusk/planning/new-project-flow/` Build Phase 4 — the two bugs found in use
- `.indusk/planning/promise-core/master.md` — the promise as the first primitive
