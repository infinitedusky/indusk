---
title: "Init sets up telemetry (New Projects) — Test Plan"
date: 2026-10-17
status: accepted
---

# Init sets up telemetry (New Projects) — Test Plan

## Purpose

This is the clause plan for the three promises in [brief.md](brief.md). Each
promise has a section, each split and limit clause a subsection with its
signal and the assertions that prove it. Every promise here is `state`: what
breaks it is a later change to the templates, to `init` or `update`, or to the
skills, so each clause is held by a test before release. The signal line says
where the clause would be seen in use; this plan writes signals and reads
none — reading them is [mark-first](../mark-first/)'s.

Most assertions are `unit`: they run `indusk init` or `indusk update` through
the built command line on a temporary project (no daemon is started; the
everyday suite sets the switch that stops it), or they read a file the plan
writes. One is a `contract` in the system tier, because it starts a real daemon;
one is a `live check`, run once on a real Next.js app. The row IDs here are the
impl's trajectory IDs.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** What a person
sees `init` and `update` write and print, what a running app sends, what a
skill tells its reader.

## `a-new-project-reports-from-its-first-run`

A project InDusk scaffolds sends its spans, named after the project and
carrying where they ran, to the local daemon from its first run, with no file
edited by hand.

### `the-scaffold-sits-where-the-app-runs` — the instrumentation is written in the declared code repo for the runtime found there, never at a workbench root; a repo with no app yet is told so, and `indusk update` scaffolds it once one appears

- Signal: the files themselves, read by the otel extension's health check in each declared code repo; upheld when the check finds the instrumentation in the code repo; broken reports the extension unhealthy with the repo it looked in (today's Homework Gate state: the file at the workbench root, the check in the repo).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T1 | In a workbench whose declared code repo holds a Next.js app, `indusk init` writes the instrumentation into that code repo, for Next.js, and writes no instrumentation file at the workbench root. | unit |
| T2 | In a workbench whose code repo holds only a README, `indusk init` writes no instrumentation and prints that the repo has no app yet, naming it; after a `package.json` appears there, `indusk update` scaffolds it. | unit |

### `the-service-is-named` — every template sets the service name in code to the project's name

- Signal: the local daemon's list of services; upheld when a scaffolded app's spans arrive under the project's name; broken reports spans under any other name, such as the placeholder service name of today's templates.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T3 | For each runtime — Node, Next.js, a browser app and Python — the files `init` writes set the service name, in code and not only in a comment, to the project's name (in a workbench, the code repo's name). | unit |
| T4 | No file in the repository outside archived plans, plan documents, incidents and the changelog still names the placeholder service `unknown-service`. | unit |

### `the-spans-reach-the-daemon` — with nothing set, a scaffolded app exports to the daemon's fixed ports; a set endpoint still wins

- Signal: the local daemon's Jaeger; upheld when a scaffolded app run with no endpoint variable set shows its service there; broken reports a scaffolded app whose first run sends nothing to the daemon (to the console, or to port 4318).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T5 | With no endpoint variable set, a scaffolded app sends traces to the daemon's stored traces address and log records to its stored logs address; with an endpoint variable set, the app sends there instead; with no address stored yet, it sends to InDusk's own port block. | unit |
| T6 | Nothing InDusk hands an application — templates, skills, the demo's README, the docs pages on setting up an app, this repository's own allow-list — tells it to send to `localhost:4318`; the recording server's files are the only place the standard port stays. | unit |
| T11 | On a fresh Next.js app, one `indusk init` and the first `next dev` put the project's service in the local Jaeger, its spans carrying the project and `development`, with no file edited by hand. | live check |

### `every-span-says-where-it-ran` — every span carries the project and its environment, development unless set

- Signal: the process tags of every span in the local daemon's Jaeger; upheld when a scaffolded app's spans carry `indusk.project` and `deployment.environment`; broken reports a span without them, which the always-on pass and the admin show as "environment unknown".

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T7 | For each runtime, the files `init` writes put the project and the environment on every span the app makes. | unit |
| T8 | A scaffolded app's spans say `development` when nothing sets the environment, say the environment the person sets when they set one, and carry the InDusk project the promise readers compare against. | unit |

### `a-newer-template-is-offered-not-forced` — `indusk update` never overwrites a template file a project has changed; a newer version is written beside it

- Signal: none in use; held by its tests. Broken would report a person's edited instrumentation file replaced by `update`.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T9 | After a person edits a scaffolded file, `indusk update` leaves it byte for byte as they left it and writes the newer version beside it, saying so; a scaffolded file nobody edited stays as InDusk wrote it, with nothing written beside it. | unit |
| T10 | For every combination of a file present or missing, edited or not, and recorded as written by InDusk or not, `update` makes the safe choice: create, refresh to the newer version, leave alone, or write beside — never overwrite an edit or a file InDusk did not write. | unit |

## `an-app-writes-its-signal-from-a-helper-it-owns`

A scaffolded project carries a small signal helper it owns, with no InDusk
dependency, that writes a promise's or a clause's signal in the one vocabulary
every InDusk reader reads.

### `one-vocabulary` — the keys a signal carries are defined once, in the package's vocabulary; the helper is pinned to it, and a key changed in one and not the other is refused

- Signal: none in use; held by its test at build time. Broken reports the key that differs and the file it is in.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T12 | Every signal key the Node and Python helpers write is one the package's vocabulary defines, and every signal key the vocabulary defines is written by each helper; a key renamed on one side only fails the suite, naming it. | unit |

### `a-signal-names-its-promise-and-clause` — the helper writes a promise, an optional clause, upheld or broken, a symptom when broken, an optional measured value and bound, and, when given, the plan and phase that added it

- Signal: the helper's own span in the local daemon's Jaeger; upheld when the package's span reader parses it into the promise, clause and verdict it was given; broken reports a signal span the reader cannot parse.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T13 | A signal written by the helper — upheld, or broken with its symptom, with a clause, a value, a bound, a plan and a phase — reads back through the package's span reader as that promise, that clause and that verdict, with the symptom on a broken one. | unit |
| T14 | A signal the helper writes from an app exporting to a real daemon is found in that daemon's Jaeger and read as the promise, clause and verdict it was given, with the project and environment on it. | contract |

### `a-test-run-says-so` — every span a project's test run makes carries the test-run marker

- Signal: the test-run marker on spans in the local daemon's Jaeger; upheld when spans from a test run carry it and spans from a real run do not; broken reports a test run's span read as a real signal.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T15 | Under a test runner (Vitest, Jest, a Vite test build, or pytest) every span a scaffolded app makes carries the test-run marker, and the helper's signal span carries it too; outside a test runner no span does. | unit |

## `a-new-project-is-told-the-truth`

What `indusk init` prints and the skills it installs name commands that
exist, the daemon the promise loop reads, and the difference between a signal
and a log line.

### `next-steps-exist` — every command and file `init` tells a person to use exists

- Signal: none in use; held by its test. Broken reports the printed command or file that does not exist.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T16 | Every `indusk` command `init` prints is one the command line has, every file it says it created or tells a person to import or run exists afterwards, the removed `indusk infra start` is gone, and `indusk editor install` is printed exactly once. | unit |

### `the-skills-name-the-daemon` — the otel, testing and local-telemetry skills send a person to the local daemon, never to a vendor

- Signal: none in use; held by its test. Broken reports the skill and line that names a vendor or the retired environment tool.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T17 | The otel, testing and local-telemetry skills, their installed copies, the local-telemetry extension's README and the otel docs page name no observability vendor and not composable.env, and each tells a person where the local daemon is (`indusk telemetry address`). | unit |

### `a-log-line-is-not-a-signal` — no skill or template presents a log line as a promise's signal; a signal is a span

- Signal: none in use; held by its test. Broken reports the skill or template line that calls a log line a measurement or a promise's signal.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| T18 | The logger template and the otel, testing and local-telemetry skills no longer call log records the home of business events or measurements; the skills say a promise's signal is a span written by the helper; the log-correlation example uses the keys the log transport reads. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| T19 | Every tool the local-telemetry skill tells a person to call exists, with the parameters it names. | unit | a regression guard: the skill's diagnosis pattern calls a tool that does not exist and passes parameters the log tool silently drops |
| T20 | A project created through the admin with telemetry declined records the reason, enables neither telemetry extension, and gets no instrumentation. | unit | proves the must-not-break promise `a-recommendation-can-be-declined`, which now also turns the extensions off |
| T21 | A workbench's declared code repo gets a `.mcp.json` from `init` and `update`, and one that exists is never rewritten. | unit | proves the must-not-break promise `a-clone-without-an-mcp-config-gets-the-keep-list` for the code repo the evaluator runs in |
| T22 | A click in a scaffolded browser app still carries its trace to the project's own services. | unit | a regression guard over the must-not-break promise `a-click-and-its-server-work-share-a-trace`: the browser template is moved and renamed, not rewired |
| T23 | Nothing `init` writes into an app names a vendor, and what it prints names each file and its SDK. | unit | a regression guard over the must-not-break promise `init-writes-no-vendor-into-an-app` |
| T24 | The seat-holds example writes its signal through the helper, and `indusk init` on a fresh copy adds no second OpenTelemetry setup to it. | unit | the carried item: the demo's hand-written signal becomes the helper and its dead second scaffold goes |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Homework Gate reports on its first run after `create-next-app` and one `indusk update`. | Homework Gate's code repo has no app yet, and it is another project. | The live check (T11) rehearses the same path on a fresh Next.js app; the brief's first expectation is read the day the app arrives. |

## Notes

- `a-new-project-has-the-standard-layout` (must not break) is read, never changed: placement comes from the declared repos, the same definition the layout's own checks use; its existing tests stay in the suite.
- T5, T8 and T15 test one small file of plain decisions each scaffolded app carries (where to send, which environment, whether this is a test run), taking the environment as an input, so they run without an OpenTelemetry SDK installed.
- The resting clause on the daemon (`the-daemon-is-the-one-running`, resting on `the-daemon-readers-follow-is-the-one-running`) is not in this plan: the brief does not list it yet, and adding it is a brief amendment for a person. It needs no row when added.
