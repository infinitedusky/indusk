---
title: "Init sets up telemetry (New Projects)"
date: 2026-10-16
status: complete
workflow: feature
---

# Init sets up telemetry (New Projects) — Research

Child 3 of seven in [telemetry-from-day-one](../telemetry-from-day-one/master.md), the parent
made on 2026-10-16 after the cold audit of `mark-first` against the goal. Blocked by
[daemon-found-not-guessed](../daemon-found-not-guessed/) for the endpoint it writes and by
[mark-first](../mark-first/)'s ADR for the keys a signal carries; blocks Homework Gate's
`indusk init`. File:line citations are on trunk at `82231cc7b` unless another checkout is named.

## Question

What must a project made with `indusk init`, or through the admin's new-project flow, be
handed so that its first run reports to the daemon InDusk reads, its spans say which project
and environment they came from, its code can write a signal a reader recognises, its test
runner's spans are told apart from real ones, and the text it is given is true — and which
of those this plan should own.

## Background

Sandy's question on 2026-10-16, after release 1.71.0 opened seven incidents from failing slow
tests: is `mark-first` a real plan for telemetry integral to a project built with InDusk from
day one, proved on Homework Gate — more than one plan is fine. The audit (the "Audit against
the goal (2026-10-16)" section of `mark-first`'s research) answered that it is a sound plan for
how InDusk *reads* a signal and does not touch what a new application is *handed* or *emits*.
Seventeen of its 41 gaps are about day one; this plan takes them.

Homework Gate is the proof. Its workbench (the path is in Sources) was made by hand on
2026-10-12 with `indusk init --workbench`. It carries `instrumentation.ts`, `filtering-exporter.ts`
and `logger.ts` at the workbench root where no app runs; `homework-gate/` holds one
`README.md`; its config says `"detected": {}`; its `.mcp.json` names a Jaeger MCP on port
54677, a daemon its own creation spawned; the evaluator's first run there exited on a missing
`homework-gate/.mcp.json`. Its founding brief says telemetry "carries no content — an
allowlist of attribute keys at the source, the OpenTelemetry Collector's redaction processor
as the backstop" (`project-brief.md:177`) and states three measurements as log lines
(`:98,105,188`), which the promise loop does not read.

## Findings

Each finding ends with the number of the audit gap it restates (the gaps are numbered in the
"Audit against the goal" section of `mark-first`'s research); the finding is that gap's summary.

### The scaffold lands at the workbench root, not where the app runs

Step 7 of `init` detects by files at `projectRoot` — `next.config.*`, `requirements.txt` or
`pyproject.toml`, `vite.config.*` — else takes the Node path (`init.ts:914-924,999-1033`), copying
three files into `src/` or the root and printing an install and a wire line (`:1031-1032`). The
admin's flow runs that same `init --workbench … --no-index` with the workbench as working directory
(`lib/new-project/create.ts:390-404`) after making a repository holding only `README.md`. Tooling
detection does run over declared repos (`lib/detect-tooling.ts:76-88` via `resolveCheckRoots`,
`lib/health.ts:43-47`), but `init` calls it at `:544`, before the workbench config is written at
`:1286` — hence `"detected": {}`. Nothing re-runs the scaffold: `update.ts` re-detects only
`verify.testRunner` (`:386-416`) and has no instrumentation reference.

Three consequences, observed in Homework Gate. The otel extension was enabled by detection two
seconds after the stray file (`instrumentation.ts` 21:19:52, its manifest 21:19:54 on 2026-10-12):
the init-time auto-enable globs `**/instrumentation.{ts,py}` without the manifest's exclude list
(`extensions.ts:660-665`). Its health check runs in the declared repo, which has no instrumentation
file, so it reads unhealthy — the audit saw `otel (built-in) — unhealthy`; I verified the code
path, not the report. The evaluator spawns with `--mcp-config .mcp.json` in the code repo, which
has none: `~/.indusk/projects/homework_gate_workbench-9815b848/eval/results.log` line 1, changeId
`57ca56f`, 2026-10-13T01:19:56Z, "MCP config file not found: …/homework-gate/.mcp.json"; `init`
writes `.mcp.json` only where it runs (`init.ts:670-687`). (audit gaps G2, G25)

### The service is renamed only in a comment

`init` replaces `"unknown-service"` with a first-occurrence `String.replace`
(`init.ts:947,971,992,1017`). The Node template's docblock carries the string at line 12,
its code at 44; the Next.js template at 8 and 19. Homework Gate's root `instrumentation.ts`
shows it: line 12 says `homework-gate-workbench`, line 44 still `unknown-service`. The
Python template is copied with no replace (`init.ts:932`); only the browser template is
renamed in code (`instrumentation.web.ts:65`). Nothing writes `OTEL_SERVICE_NAME` (grep of
`init.ts`: none), though the otel skill's table says "Set by init"
(`extensions/otel/skill.md:277`). The regression dates from `f1a37ca23` (2026-04-01), the
commit that shipped the templates with the docblock above the code. (audit gap G26)

### The exporter points nowhere a reader reads

Node, browser and Python fall to the console with no endpoint (`templates/instrumentation.ts:31-40`,
`instrumentation.web.ts:52-55,146-155`, `instrumentation.py:46-54`). Next.js never does:
`registerOTel({ serviceName })` (`instrumentation.next.ts:17-21`) takes `@vercel/otel`'s
`auto` exporter, which posts to `http://localhost:4318/v1/traces` when no endpoint variable
is set — verified in the installed `@vercel/otel@2.1.3` bundle at
`numero-workbench/worktrees/ci-gate-required/node_modules/@vercel/otel/dist/node/index.js`.
So a Next.js app reaches the daemon only when the daemon holds 4318, and on Fly posts into
its own machine. (audit gaps G1, G33 local half)

The package knows the live endpoint: `liveOtlpEndpointSync()` reads `~/.indusk/telemetry.json`
and returns `http://localhost:<otlpPort>` when the Jaeger PID is alive
(`lib/telemetry/status.ts:118-126`); its only non-test callers are `demo.ts:64,68` and
`lib/eval/otel.ts:81`, the only setters of `OTEL_EXPORTER_OTLP_ENDPOINT` in non-test source
`demo.ts:84` and `eval/otel.ts:82`. Enabling `local-telemetry` copies only `.env.example`
(`extensions.ts:722-727`), headed "NOT CONSUMED BY ANYTHING"; its skill says "It does NOT
configure your services to emit to it" (`local-telemetry/skill.md:81`); the telemetry
overview says the opposite, that enabling "writes the extension's `.env` component"
(`apps/docs/src/reference/telemetry/overview.md:97,162-165`) — the audit's fifth contradiction.

The port is the daemon plan's, but it shapes this plan: `telemetry register`, run on every
`init`, starts a daemon with `allowPortBump: true` whenever the record reads not running
(`telemetry.ts:257-266`; `daemon.ts:116-120,398`). At the audit on 2026-10-16 this machine had
no `~/.indusk/telemetry.json` and three Jaegers running (one, with a record, by this document's
review later that day); Homework Gate's `.mcp.json` is on MCP port 54677, while the app side
says 4318 everywhere (`local-telemetry/skill.md:81,116,127`, `examples/seat-holds/README.md:35`).
Fixed 4318 or a file written from the record is Sandy's decision in the parent. (audit gap G31, app side)

### No span carries its environment or its project

No template sets `deployment.environment` (grep over `templates/`: none). The readers want
it — `parseMarkedSpan` reads it from the span's tags, then the process tags
(`lib/promises/telemetry.ts:166,236-237`); the always-on pass and the admin render
"environment unknown" without it — and only the demo sets it
(`examples/seat-holds/src/telemetry.ts:26`). `@vercel/otel` sets `deployment.environment.name`
from `VERCEL_ENV` and never the key InDusk reads: the bundle builds its resource with
`[rO]:o`, `rO="deployment.environment.name"`, and leaves the `deployment.environment`
constant unused, so even a Vercel deploy reads unknown. (audit gap G4)

The project is the same story. `PROMISE_MARK.project` (`indusk.project`) is documented as
"absent from an application's own spans, whose service is its project"
(`lib/promises/vocabulary.ts:130-137`), and the reader drops a signal only when it names a
*different* project; on a shared recording server two applications with the same promise
name count each other's signals — the audit's twelfth contradiction. The judge (the synthesis
that weighed three proposals for this plan, `plan-gaps/judge.json` in the session scratchpad)
proposes `indusk.project` on every scaffolded span as a resource attribute, reversing that
comment, which would let [production-is-heard](../production-is-heard/) drop an untagged span for free.

The browser wiring instruction is unsafe for Next.js: `init` says to import the web file
"in your root client component or layout" (`init.ts:979-981`), while the template registers
a `WebTracerProvider` at module scope with no `typeof window` guard (`instrumentation.web.ts:157-177`).

### The log channel: the wrong port, correlation that never lands, a pattern with the wrong arguments

`logger.ts` adds a `pino-opentelemetry-transport` target with `protocol: "http"` and no URL
when the endpoint variable is set (`templates/logger.ts:32-45`). The transport posts to that
endpoint's `/v1/logs` — Jaeger's OTLP port, whose rendered pipeline is traces only
(`daemon.ts:198-204`) — while the daemon's logs receiver is the collector's port
(`daemon.ts:272-276`), recorded as `logsOtlpPort` and read by nothing. The audit says the
post is answered 404 and swallowed; I read the configs and sent no record. (audit gap G27,
app half)

The otel skill's correlation helper returns `{ traceId, spanId }`
(`extensions/otel/skill.md:178-185`; checklist `:246`). The transport reads `trace_id`,
`span_id` and `trace_flags`, sets a span context only when all three are present, and never
reads camelCase — verified in the installed `otlp-logger@2.0.0`
(`chitin-sportsbook/node_modules/.pnpm/otlp-logger@2.0.0…/lib/otlp-logger.js:99-109`), the
dependency of `pino-opentelemetry-transport@3.0.0` beside it; the current 4.0.2 I could not
check. The local-telemetry skill's diagnosis pattern calls `tail_logs({ traceId, sinceMs })`
(`local-telemetry/skill.md:16,65`); the tool takes `service`, `level`, `since_minutes`,
`limit` (`src/tools/telemetry-tools.ts:145-172`) — the audit found the unknown keys dropped
silently through a non-strict schema; I confirmed the schema, not the drop. (audit gap G30)

Homework Gate's brief states measurements as logs (`project-brief.md:98,105,188`); the otel
skill and the logger template teach INFO as the home of business events (`otel/skill.md:156`,
`logger.ts:16`); the loop reads span attributes and events only (`telemetry.ts:232-243`). No
skill says a log line is not a signal; the skill half is this plan's. (audit gap G28)

### No app-side way to write a signal, and mark-first widens what one must write

`markPromise` takes `{promise, outcome, project?, symptom?}`, no clause, and writes the
pre-2026-10-15 outcome word (`lib/promises/mark.ts:5,20-37`). It is not exported: `package.json`
has `./promises/registry`, `./promises/telemetry` and `./testing/trace-shape`, no `./promises/mark`.
The app-facing form is two hand-set attributes (`guide/promises.md:173-187`, `testing/skill.md:35-41`);
a typo is silent, since `parseMarkedSpan` returns null when the promise tag is not a string or the
outcome is not a verdict (`telemetry.ts:232-235`), and the clause reads no signal forever.
The shipped test helper asserts by promise only (`lib/testing/trace-shape.ts:118-140,148-167`).
The day-monitor decision (2026-09-18) rejected "a runtime helper package (InDusk in the
application's dependency graph for two attribute writes)" (`apps/docs/src/decisions/day-monitor.md:12`).

`mark-first`'s ADR — the decision that a signal belongs to a clause — adds `indusk.clause` to
every signal and `indusk.signal.plan`/`.phase` to a broken one (its D1), has a writer set
`indusk.run=test` under a test runner so readers ignore such spans (its D3), and switches
the writers to the new outcome word (its D7). None of those keys exists on trunk (grep over
the package, the admin, the docs and the demo: none), and its documentation plan (`adr.md:106-116`)
adds `guide/signals.md` but names neither the promises guide's section on the two attributes,
the otel or testing skill, the templates nor the test helper — the audit's seventh contradiction:
the no-helper stance stands while the convention grows from two attributes to five. The Node
template exports whenever the endpoint is set, with no test marker (`instrumentation.ts:31-37`),
so a project's vitest run against the daemon writes spans a reader takes as real until the
marker exists. (audit gap G3, app side; the keys half is `mark-first`'s)

### The skills and the printed text do not tell the truth

- `init.ts:1346` prints `indusk infra start` as step 1; `infra` was removed in 1.33.5
  (`09e44ccfd`, 2026-07-24); the demo and the new-project flow both run `init`.
- `extensions/otel/skill.md:241`: "search for your `OTEL_SERVICE_NAME` in Dash0" (Homework
  Gate's installed copy carries it verbatim); `local-telemetry/skill.md:30,87-120` calls
  production "Dash0's job" and teaches composable.env; `apps/docs/src/reference/tools/otel.md:313-323`
  recommends Dash0 through `pnpm ce env:build`; `guide/getting-started.md:13` lists Docker,
  needed only for `server deploy --build-from`. Dash0 and composable.env are retired.
- The otel-extension decision of 2026-03-31 says "Every project created with `indusk-mcp
  init` is observable from day one"; the templates default to the console, `--local` skips
  OTel (`init.ts:905-907`), a workbench init scaffolds where no app runs — the audit's sixth
  contradiction. Two lessons in `.claude/lessons/` record the evaluator in the same hole:
  `unconfigured-exporter-mark-is-never-seen` and `otel-export-needs-a-default-endpoint-not-just-an-emitted-span`.
(audit gap G5, guidance half)

### A scaffolded project never receives a newer template

`init` skips every instrumentation file that exists unless `--force`
(`init.ts:929-930,942-943,953-954,964-965,987-988,1005-1006`), and `--force` overwrites
everything but `CLAUDE.md` and `planning/` (`cli.ts:54`). `update` copies `AGENTS.md`,
`current.md` and each extension's `.env.example` (`update.ts:552,608-635,758-761`) and no
instrumentation template. The browser template has changed eight times since the commit
that shipped it. Trunk's `known-issues.md:12-19` records the browser half ("a refresh is a
diff offered, not an overwrite"); no plan owns either half. (audit gap G5, template half)

### The new-project flow: a declined recommendation changes nothing; the editor is never installed

The prompt tells the agent to recommend "a GitHub repository, deployment, telemetry, a docs
site" and accept a refusal (`lib/new-project/prompt.ts:80`); `recordChoices` writes
`recommendations[]` with `kept` and `reason` (`create.ts:206-225`). After creation nothing
reads it (the readers are the proposal page, `apps/indusk-admin/src/app/new/[id]/page.tsx:45,48`,
and the type, `lib/config.ts:289`). Creation runs the same `init` either way; `local-telemetry`
is `required: true` and Pass 1 of `autoEnableExtensions` enables it unless `disabled_extensions`
names it (`extensions.ts:635-645`, `config.ts:456-458`), which nothing in the flow writes. The
archived audit saw it: "declining (for example telemetry) changes nothing that init
installs" (`archive/new-project-flow/audit.md:17`). (audit gap G38)

`indusk editor install` exists (`reference/cli/editor.md:18`); nothing on the day-one path
names it (grep over `lib/new-project`, `init.ts`, `setup.ts`, `update.ts`, `skills/`,
`templates/`: none), and `init`'s `[Editor]` section writes only `.vscode/settings.json`
(`init.ts:765-776`). The refresh half is the later editor plan's. (audit gap G36, day-one half)

### The demo: its loop works, its tests expect the old words, its copy carries dead files

The audit's headline here was refuted by the release's own record, and I confirm it.
Release 1.71.0's slow-tier output (`apps/indusk-mcp/test-results/system.junit.xml`, written
2026-10-16 16:17 local) shows `indusk demo` working end to end: `promises status` read "last
seen holding 2026-10-16T20:16:46Z (bd50300e…)" from "Jaeger at http://localhost:53488" and
"1 break in the last 15m … seat 2 released 5.1 s late". The tests are red because their
words are stale: `demo-command.test.ts` expects `/last seen upheld/` (`:98,100`) and a count
of the old break word (`:107-108,119-120`), while `status.ts` has printed "last seen
holding" (`:66`) and "N break(s)" (`:55-58`) since `4aac52073` on 2026-10-15; the test file
was last changed 2026-10-07. So both demo promises are `known-broken` from a test file's
exit code (owner `demo-app-template`, archived), and the incident
`incidents/i-2026-10-16-the-demo-break-is-caught-locally.md` (source `release`, release "1.71.0
at 019d354", naming the demo plan's two rows: A4, the page starts and a lapsed hold reads as the
promise held; A7, a late release reads broken with its trace) has `_Unwritten_` under its
`## Root cause` heading (line 1207).

What survives: `indusk demo` runs `init` (`demo.ts:58-59`), so the Node path copies the three
templates into `src/` beside the example's own `telemetry.ts`; its `package.json` has no
`sdk-node` and `server.ts` imports only `./seats.js` and `./telemetry.js`. The live copy at
`/Users/the_dusky/code/sandbox/seat-holds-live/src` shows all four files; the otel skill's
"`init` creates the instrumentation files" points at dead files there. (audit gap G12)

### What this plan touches but does not own

- **The at-source allowlist.** `FilteringExporter` drops whole spans by `otel.category`,
  never by attribute key (`templates/filtering-exporter.ts:42-48`), and is installed on the
  Node path only (`init.ts:913,1003-1011`), not for Next.js, Homework Gate's server; the
  daemon's pipeline is `otlp → batch → jaeger_storage` (`daemon.ts:198-204`). Homework
  Gate's own `repo-foundation` plan was withdrawn on 2026-10-13 (`385d26c`). The judge gives
  the at-source half here and the server half to
  [production-keeps-only-what-it-should](../production-keeps-only-what-it-should/). (audit gap G17)
- **Non-Node components.** Homework Gate's device agent is .NET, its phone app Swift
  (`project-brief.md:66-68`); the signal is plain attribute names any OTel SDK can set
  (`vocabulary.ts:113-119`) and the daemon's receiver binds `0.0.0.0` (`daemon.ts:236-245`):
  the path exists and is written nowhere. (audit gap G19, documented path only)
- **The parked new-project-flow gaps.** The parent says this plan takes "the two telemetry
  gaps `new-project-flow`'s audit parked in `known-issues.md`" (the `plan/mark-first` branch's
  copy, lines 12-20): the `new_project.create` span goes nowhere because no tracer provider is
  registered (`create.ts:320` uses the global API), and three new-project promises hold only
  because the prompt says so. The judge's change 5 to `mark-first` builds that provider there;
  the policy-signal half is about the conversation's confinement, not the scaffold. Open below.

### What exists to build on

- `liveOtlpEndpointSync()` and the record's `logsOtlpPort` (`lib/telemetry/status.ts:44,118-126`);
  `syncAllRegisteredProjectsMcp` (`telemetry.ts:36-55`), the pattern for rewriting one file
  per registered project on a port change; `lib/eval/otel.ts:81-82`, default to the local
  daemon when it runs with an explicit off switch — the shape the two lessons ask for.
- `resolveCheckRoots` (`lib/health.ts:43-47`), `detectTooling` over declared repos
  (`detect-tooling.ts:76-88`), `update.ts:386-416` as the precedent for re-running a
  detection `init` got wrong, `ensureMcpJson` (`lib/mcp-config.ts`) as the one writer of
  `.mcp.json`.
- `PROMISE_MARK`, `readOutcome`, `PROMISE_OUTCOMES` (`vocabulary.ts:121-176`) as the one
  definition a generated helper is pinned to, `promises-single-definition.test.ts` as the
  pin's shape, `markPromise` as the writer it mirrors, `trace-shape` as the test helper that
  learns the clause key; `examples/seat-holds/src/telemetry.ts:22-56` as the working emitter.
- Fixtures: `demo-command.test.ts`; `telemetry-init-fresh.test.ts` (T18, the row asserting a
  fresh `init` auto-enables `local-telemetry`); `init-browser-telemetry.test.ts` (A5–A7 and
  A14, the rows asserting init's created-file and propagation lines name no vendor);
  `disabled_extensions` / `isExtensionExplicitlyDisabled` (`config.ts:174,456-458`);
  `copyExtensionAssets` overwriting `.env.example` on every update (`extensions.ts:722-727`);
  `indusk editor install`; `otel.role`, absence read as `service` (`config.ts:539-554`),
  which `init` never writes (`:1250-1285`).

## Proposed shape (not decided)

The judge's synthesis gives this plan three promises; the brief is Sandy's conversation and
may regroup. Each is a proposal, not a promise made.

1. **`a-new-project-reports-from-its-first-run`** — a project `indusk init` scaffolds sends
   its spans, named after the project, to the daemon InDusk reads, from its first run, with
   no file edited by hand. Splits: *the-scaffold-sits-where-the-app-runs* (detection and
   the files in the declared code repo; a repo with no runtime marker gets a note and
   `update` scaffolds when one appears); *the-service-is-named* (the code line, every
   template); *the-exporter-points-at-the-daemon-that-is-running* (`init`, `telemetry
   register` and `update` write `.env.indusk` from the record, OTLP and logs endpoints and
   the `NEXT_PUBLIC_`/`VITE_` forms); *the-environment-is-on-every-span*
   (`deployment.environment` and `indusk.project` as resource attributes, default
   `development`). Limit: *a-newer-template-is-offered-not-forced* (`update` writes
   `<file>.indusk-new` beside a changed file, never over it). Closes the audit's gaps on the
   console default (G1), root placement (G2), missing environment (G4), comment-only rename
   (G26) and the evaluator's missing `.mcp.json` (G25), with the app or local halves of the
   port (G31), the Next.js default (G33), the log channel (G27) and the stale text (G5). Cost:
   the largest change to `init.ts` since the templates landed, and a writer that depends on
   the daemon plan's record.
2. **`an-app-writes-its-signal-from-a-helper-it-owns`** — a scaffolded project carries
   `src/signal.ts`, plain OpenTelemetry with no InDusk dependency, whose two calls write the
   keys `mark-first` defines (promise, clause, plan/phase pointer, the new outcome word,
   optional value and bound) and set `indusk.run=test` under the project's test runner; its
   exporter passes only allowlisted attribute keys when `telemetry.attributes_allowed` is
   set. Closes the app side of the no-helper gap (G3), the at-source half of the allowlist gap
   (G17) and the demo's dead files (G12). Cost: a third copy of the keys unless generated from
   or pinned to `vocabulary.ts`, and a dependency on `mark-first`'s ADR being accepted first.
3. **`a-new-project-is-told-the-truth`** — what `init` prints and the skills it copies name
   commands that exist and the backend the loop reads. Splits: *next-steps-exist*;
   *the-skills-name-the-daemon-not-a-vendor*. Limit: *a-log-line-is-not-a-signal* (a clause's
   signal is a span attribute and INFO is for diagnosis; the correlation example uses the
   transport's keys; the local-telemetry pattern calls `tail_logs` with its real parameters).
   Closes the guidance half of the stale-text gap (G5), the skill half of the logs-as-
   measurements gap (G28) and the diagnosis pattern's wrong arguments (G30). Cost: this plan
   owns the otel, testing and local-telemetry skills wholly, so no sibling edits them.

Carried: a declined telemetry recommendation writes `disabled_extensions` (G38); `init` prints
`indusk editor install` once (G36, day-one half); the demo's two stale tests fixed with the root
cause written into the open incidents (G12). The second proposal grouped the same work as four
promises, with placement and the newer-template offer as promises of their own — the seam if split.

## Decisions

- **The goal and the proving ground** (Sandy, 2026-10-16): telemetry integral to a project
  built with InDusk from day one, promises failing in production as a critical part of the
  system, decisions from measurements — proved on Homework Gate; more than one plan is fine.
- **Placement** (the parent, 2026-10-16): third child; blocked by the daemon plan for the
  endpoint and by `mark-first`'s ADR for the keys; blocks Homework Gate's `init`; if it
  stalls, placement, naming, endpoint and environment first, skills and truth second.
- **The later cut** (Sandy, 2026-10-15, `mark-first` research "First cut"): signals from
  the browser come after `run-the-master`; the browser template keeps tracing only and
  browser-felt clauses are reported server-side.
- **The application imports nothing from InDusk** (day-monitor, 2026-09-18): the rejected
  alternative was a runtime package; the judge's proposal of a helper the app *owns*, a file
  `init` writes rather than a dependency, keeps that substance.
- **One promise language** (2026-10-15): readers accept both outcome words and `mark-first`
  switches the writers; a scaffold written after it has no reason to carry the old one.
- **Vendor fan-out stays backlog** (Sandy, 2026-10-10, `telemetry-destinations` "is not
  critical at all"): a scaffold is handed one endpoint, InDusk's; the rest is that plan's.
- **Homework Gate's own promises are not `mark-first`'s** (its brief, accepted 2026-10-14,
  "Not promised"): what Homework Gate is *handed* is this plan's.

## Open Questions

- One landing with three promises and eleven clauses (one approval, longest to land), or
  two — placement, naming, endpoint and environment first so Homework Gate can `init`
  sooner, skills and truth second (two approvals)?
- The helper generated from `vocabulary.ts` at build (one definition; a build step and a
  generated file to ship) or hand-written and pinned by a single-definition test (no build
  step; a test that names every key)?
- The at-source allowlist here (Homework Gate deploys with it before a collector fronts the
  server; a config key and an exporter wrapper on every template) or only in
  `production-keeps-only-what-it-should` (one home for the privacy rule; the first deploy
  waits on it)?
- Fixed 4318 the daemon always holds (any SDK default works; a taken port must refuse
  loudly) or a file written from the record (survives collisions; a port change rewrites
  it) — the daemon plan's decision, which this plan's writer follows.
- Which plan takes the `new_project.create` tracer provider: the parent assigns both parked
  gaps here; the judge's change 5 builds the provider in `mark-first`. The policy-signal
  half fits neither plan's code.
- `indusk.project` on every scaffolded span (reverses the vocabulary's comment; frees
  `production-is-heard` to drop untagged spans) or keep "the service is the project" and
  fix the shared-server reader there?
- Next.js: `deployment.environment` alone, or both it and `deployment.environment.name`?
- The logs endpoint from `logsOtlpPort` now (the channel carries a record at last) or the
  transport left off until `production-keeps-only-what-it-should` decides where logs live?
- A repo with no runtime marker at creation: a note and a re-run on `update` (the judge),
  or ask the runtime in the conversation and scaffold at once?
- `indusk editor install`: print it once, or run it from `init` when `code` or `cursor` is on the path?
- The demo's dead scaffold: how does `init` detect an existing tracer provider and skip its OTel step?

## Sources

- `../telemetry-from-day-one/master.md` — the parent and the decisions it waits on.
- `/Users/the_dusky/code/sandbox/dusk-worktrees/mark-first/.indusk/planning/mark-first/research.md`
  § "Audit against the goal (2026-10-16)" — the 41 gaps and the twelve contradictions (5, 6,
  7 and 12 touch this plan); its `adr.md:44-56`, `brief.md:76,86-91`; that branch's `known-issues.md:12-20`.
- `plan-gaps/a-new-project-starts-instrumented.json` and `judge.json` in the session
  scratchpad — the audit records and the three proposals.
- Trunk `82231cc7b` (re-checked at review on `49bde2909`, the next commit): the files cited inline
  under `apps/indusk-mcp/`, `examples/seat-holds/`, `.indusk/promises/`, the docs pages, lessons
  and archived plans named inline, `.indusk/planning/master.md:498-505`.
- `/Users/the_dusky/code/sandbox/homework-gate-workbench` (read only), its eval log under
  `~/.indusk/projects/homework_gate_workbench-9815b848/`, `~/.indusk/telemetry/projects.json`.
- Installed copies read for their defaults: `@vercel/otel@2.1.3` (numero-workbench),
  `otlp-logger@2.0.0` and `pino-opentelemetry-transport@3.0.0` (chitin-sportsbook).
