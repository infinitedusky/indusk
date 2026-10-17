---
title: "Init sets up telemetry (New Projects)"
date: 2026-10-17
status: accepted
---

# Init sets up telemetry (New Projects)

## Goal

**A project InDusk scaffolds sends named, placed spans to the local daemon on its first run, can write a promise's signal from a small file it owns, and is told the truth about how.**

Today `indusk init` on Homework Gate's workbench wrote `instrumentation.ts` at the
workbench root, where no app runs, with the service renamed only in a comment and
the code still saying `unknown-service`; the Node, browser and Python templates
export to the console when no endpoint is set and the Next.js one to port 4318,
which the daemon no longer holds; no span says which environment or project it
came from; an app has no way to write a signal but two hand-typed attributes; and
the otel skill tells a person to look in Dash0. After this plan the same `init`
writes into the code repo, names the service, points at the daemon's stored
address, puts the project and environment on every span, hands the app a signal
helper pinned to the package's vocabulary, and prints and installs only true text.

## Y-Statement

**In the context of:**
`indusk init` and `indusk update` scaffolding OpenTelemetry into a project — directly, through the admin's new-project flow, or through `indusk demo` — so that the promise loop has something to read from the project's first run, with the daemon now on one stored address (daemon-found-not-guessed) and the signal readers of mark-first about to be written against keys nobody writes yet.

**Facing:**
a scaffold step that detects the runtime at the project root (a workbench's root holds no app), renames the service with a first-occurrence string replace that hits a docblock, defaults to the console or to 4318, sets no environment or project, copies files only when absent and never refreshes them, and an app-side signal convention of hand-typed attribute names whose typo is silently unread — while the application must import nothing from InDusk (day-monitor) and the readers must read exactly the keys the writers write.

**We decided for:**
one scaffold module behind both `init` and `update` that writes per declared code repo (else the project root) for the runtime found there, says so when a repo has no app yet, and records a hash of every file it writes so `update` refreshes an untouched file and writes `<file>.indusk-new` beside an edited or unrecorded one; a small per-app settings file, rendered with the service name, the InDusk project id and the daemon's stored traces and logs addresses, that decides where to send, which environment (development unless set) and whether this is a test run, taking the environment as its input; resource attributes `indusk.project`, `deployment.environment` and, under a test runner, `indusk.run=test` on every span; a hand-written signal helper (`signal.ts`, `signal.py`) depending only on the OpenTelemetry API, pinned by a test to new keys in `lib/promises/vocabulary.ts`; and true printed next steps and skills, held by tests.

**And against:**
an environment file written from the address (Node and Python load none without a flag, Next.js reads only its own file names, and a browser bundle needs the value inlined at build); relying on port 4318 (the daemon plan left the standard port to a person's other tools); a helper generated from the vocabulary at build time (a build step and a generated file for two short files); an InDusk runtime package in the app (rejected by day-monitor); overwriting templates on `update` with or without `--force` (a person's edit is lost); and splitting the plan in two (one brief, one approval; the phases put placement, naming, the daemon and the environment first so they can land first if the rest stalls).

**To achieve:**
Homework Gate's first `next dev` after one `indusk update` puts `homework-gate` in the local Jaeger with its project and environment, a route handler's `signal.upheld(...)` writes keys mark-first's readers recognise, a test run's spans are told apart from real ones, and nothing InDusk prints or installs sends a person to a command, file or vendor that is not there.

**Accepting:**
the largest change to `init.ts` since the templates landed, a scaffold step that moves after the config write and the extension enable, one more scaffolded file per app (the settings file), a record file under `.indusk/`, the helper's keys duplicated as strings in two languages and held equal only by a test, and an app scaffolded before an address reset sending to the old address until `update` refreshes it or the person edits it.

**Because:**
the decisions an app makes about its telemetry are few and must be right in every runtime, so they live in one small file each app owns and the package tests as plain functions (lesson: code-that-decides-takes-its-clock-and-its-reads); a default endpoint in code is read by every runtime, where an environment file is read by some (lessons: otel-export-needs-a-default-endpoint-not-just-an-emitted-span, unconfigured-exporter-mark-is-never-seen); a hash of what InDusk wrote is the only way to tell "never touched" from "edited" without asking; and a vocabulary pinned by test keeps one definition while the application imports nothing.

## Context

The findings are in [research.md](research.md); the promises in [brief.md](brief.md);
the assertions in [test-plan.md](test-plan.md). This is the second child of
[telemetry-from-day-one](../telemetry-from-day-one/master.md), whose "seam between the
two" settles the signal's keys; [daemon-found-not-guessed](../archive/daemon-found-not-guessed/)
landed the stored address (`lib/telemetry/daemon-address.ts`: InDusk's block 24316–24319,
or ports picked once at first setup, `daemonAddress()` for the URLs,
`indusk telemetry address --json` for a script).

Ground truth checked on this branch:

- `init` step 7 (`bin/commands/init.ts`, the `[OpenTelemetry]` block) runs before the
  config is written and before extensions are enabled; it detects by files at the project
  root and falls back to the Node path when nothing matches; `update` has no scaffold step.
- `declaredRepoDirs` (`lib/worktree/repos.ts`) gives each declared repo's name and checkout;
  `resolveCheckRoots` (`lib/health.ts`) and `detectTooling` already use it.
- The span reader drops a signal only when its `indusk.project` span tag names a different
  project, compared against `getProjectGroupId` (the workbench's id, e.g.
  `homework_gate_workbench`), and reads `deployment.environment` from span then process tags
  (`lib/promises/telemetry.ts`). A resource attribute lands on the process, not the span
  (lesson: otel-resource-attributes-land-on-process-not-span).
- `PROMISE_MARK` already has `indusk.clause`; value, bound, plan, phase and the test-run key
  do not exist; `ENVIRONMENT_ATTRIBUTE` lives in `lib/promises/telemetry.ts`.
- `readOutcome` reads `upheld`, `broken` and the older wire word; InDusk's own writers still
  write the older word until mark-first switches them.
- `ensureMcpJson` writes a `.mcp.json` only where it is called; nothing calls it for a
  workbench's code repo. A declined recommendation is written by `recordChoices` after
  `init` has already run (`lib/new-project/create.ts`).
- The daemon's OTLP receiver already allows browser origins (CORS in `lib/telemetry/daemon.ts`).

## Decision

1. **One scaffold module, per declared repo.** A new `lib/scaffold/` holds the decision
   (which runtime, which files, what to do with each) as plain functions over what was read,
   and one apply step that writes. `init` calls it after the config is written and the
   extensions are enabled; `update` calls it every run. The targets are `declaredRepoDirs`,
   or the project root when none are declared — never a workbench root. A runtime is found
   by its markers: `next.config.*` (Next.js), `vite.config.*` (browser app), `package.json`
   (Node), `requirements.txt` or `pyproject.toml` (Python). A target with none gets no files
   and a printed line naming it as having no app yet; `update` scaffolds it once a marker
   appears. `--local` and the package's own repository still skip, as today.
2. **The service is named in code.** The service name is the code repo's name in a
   workbench, the project's folder name otherwise, written into the settings file. No
   template carries `unknown-service`, and no string replace edits a template.
3. **The daemon's address, in a file the app owns.** Each scaffolded app carries a settings
   file (`telemetry-settings.ts` beside the instrumentation; inline in `instrumentation.py`)
   rendered with the service name, the InDusk project id and the daemon's stored traces and
   logs URLs from `daemonAddress(induskHome())`, or InDusk's block from `PORT_BLOCK` when none
   is stored. It exports one function from the environment to the settings: an endpoint
   variable (`OTEL_EXPORTER_OTLP_ENDPOINT`, or the traces- or logs-specific one) wins over the
   rendered default. Every template sends traces to it; the logger template sends log records
   to the logs URL, never to the traces port. Next.js sets the endpoint variable's default
   before `registerOTel` runs, so `@vercel/otel` exports there.
4. **Where a span ran.** Every template puts `indusk.project` (the InDusk project id, the
   key the readers compare) and `deployment.environment` (`development` unless
   `OTEL_RESOURCE_ATTRIBUTES` sets it) on its resource. The vocabulary's comment saying an
   application's spans carry no project is reversed.
5. **A record of what InDusk wrote.** `.indusk/scaffold.json` in the project (the workbench
   root for a workbench) maps each scaffolded file, by path, to the hash of the content
   InDusk wrote. On each run: a missing file is created; a file whose hash matches the record
   is refreshed to the newer rendering; a file that differs from its record, or has no record
   and differs from the rendering, is left alone and the rendering written beside it as
   `<file>.indusk-new`, with a printed line; a file with no record that equals the rendering
   is recorded. An address reset reaches an untouched app through the next `update`.
6. **The signal helper.** `templates/signal.ts` (Node and the Next.js server) and
   `templates/signal.py`, copied into the app, importing only the OpenTelemetry API.
   `signal.upheld({ promise, clause?, value?, bound?, plan?, phase? })` and
   `signal.broken({ promise, clause?, symptom, value?, bound?, plan?, phase? })` each start
   and end one short span, a child of the active span when there is one, carrying
   `indusk.promise`, `indusk.clause`, `indusk.promise.outcome` (`upheld` or `broken`), the
   symptom event on a broken one, `indusk.signal.value`, `indusk.signal.bound`,
   `indusk.signal.plan` and `indusk.signal.phase` when given, and copies of `indusk.project`
   and, in a test run, `indusk.run` onto the span itself, because today's reader reads the
   project from span tags. It writes `broken`, not the older word: every reader in this
   release reads it, and a file the project owns should not carry the old word for years.
   InDusk's own writers keep theirs until mark-first.
7. **One vocabulary.** `lib/promises/vocabulary.ts` gains the signal keys (value, bound,
   plan, phase), the test-run key and value (`indusk.run`, `test`), and the environment key
   (moved from `lib/promises/telemetry.ts`, which imports it). A test reads every
   `indusk.*` and `deployment.environment` string in the two helpers and the settings file
   and holds them equal to the vocabulary in both directions.
8. **A test run says so.** The settings function marks a test run when `VITEST`,
   `JEST_WORKER_ID`, `NODE_ENV=test` or a Vite test build (`MODE=test`) is present; the Python
   template when pytest is loaded. A marked run still exports; readers decide (mark-first).
9. **An app that sets up OpenTelemetry itself gets no second setup.** When a target already
   depends on an OpenTelemetry SDK (`@opentelemetry/sdk-node`, `sdk-trace-node`,
   `sdk-trace-web`, `@vercel/otel`, or `opentelemetry-sdk` in Python), the scaffold writes
   only the helper and says so. The seat-holds example keeps its own provider and writes its
   signal through `src/signal.ts`, a copy of the template held equal by a test.
10. **A declined telemetry recommendation turns the extensions off.** The new-project flow
    writes `disabled_extensions: ["local-telemetry", "otel"]` before `init` runs when the
    person declined telemetry, so neither is enabled, no daemon is registered and the
    scaffold writes nothing; the reason is still recorded.
11. **The code repo gets its `.mcp.json`.** `init` and `update` call `ensureMcpJson` for each
    declared code repo, never rewriting one that exists.
12. **The truth.** `init`'s next steps name only commands the CLI has and print
    `indusk editor install` once; the browser wiring line tells a Next.js project to import
    the file from a client component; the otel, testing and local-telemetry skills send a
    person to the local daemon, say a promise's signal is a span written by the helper and
    that log lines are for diagnosis, use the log transport's own correlation keys, and call
    only tools that exist with their real parameters. Dash0, composable.env and port 4318 as
    an app's default leave every file InDusk hands an app.

No OTel gate: this repository's `otel.role` is `library`.

## Alternatives Considered

### An environment file written from the address
The master's "What Homework Gate gets" names one. Rejected against T5 and T11: a Node app
reads `.env.indusk` only with `--env-file`, Python only with a loader, Next.js only under
its own names, and the browser template needs the value inlined at build. A default in a
file every runtime imports works with nothing set, which is the clause.

### Fixed port 4318
Rejected by the daemon plan: InDusk's block exists so 4318 stays with a person's other
collectors; a recording server keeps it. T6 holds that no app is told it.

### The helper generated from the vocabulary at build
One definition with no test, at the cost of a build step and a generated file shipped in
the package for two files of under a hundred lines. The pin test (T12) refuses a drift at
the same moment a build would have regenerated it.

### Overwrite on `update`, or `--force`
Brings every project current, and loses the edit the limit clause protects. `--force` on
`init` already overwrites everything but `CLAUDE.md` and the planning folder; this plan
leaves it as it is and gives `update` the record instead.

### The service named after the workbench
`homework-gate-workbench` is the workbench's folder; the app is `homework-gate`, the name
the first expectation looks for. The project id still goes on every span as `indusk.project`,
which is what the readers compare.

### Two plans
The research's open question. One brief was accepted with three promises; the phases are
ordered so the first build phase can land alone.

### The at-source attribute allowlist here
Not promised: production-keeps-only-what-it-should holds the privacy rule in one home.

## Consequences

### Positive
- Homework Gate's code repo gets a working scaffold from one `update`, and its evaluator a `.mcp.json`.
- mark-first reads keys that exist, written by a helper the suite holds to the vocabulary.
- An app scaffolded today is refreshed tomorrow without losing a person's edits.
- The otel extension's health check reads healthy where the instrumentation now is.

### Negative
- Each scaffolded app carries one more file; a person who reads it sees the daemon's port in it.
- An app with its own OpenTelemetry setup is not given the environment or project attributes; the helper's span still carries the project.
- `init`'s output changes shape; existing tests that read it are updated with it.

### Risks
- **The record is lost or not committed** (a workbench clone without `.indusk/scaffold.json`): every file then reads unrecorded, and `update` writes beside, never over. Mitigation: the safe default is the rule (T10).
- **`@vercel/otel` ignores an endpoint default set in code** in some version: T11, the live check on a real Next.js app, catches it before close.
- **A Python helper drifts from the TypeScript one**: T12 reads both.
- **mark-first switches InDusk's writers and changes a key**: the pin test fails until the helper changes with it; the vocabulary is the one place.

## Documentation Plan

### Pages
- Update: `reference/telemetry/overview.md` — what `init` and `update` scaffold, where, and how an app reaches the daemon; replace the claim that enabling the extension writes an `.env` component.
- New: `reference/telemetry/signal-helper.md` — the helper's two calls, the keys from the vocabulary, the test-run marker, writing the same keys from another language.
- Update: `guide/promises.md`, "Marking a behaviour promise" — the helper first, the plain attributes as what it writes.
- Update: `reference/tools/otel.md` — the scaffold per runtime, no Dash0 or composable.env.
- Update: `guide/new-project.md` and `guide/getting-started.md` — what a new project is handed; Docker only for `server deploy --build-from`.
- Update: `reference/cli/demo.md` if it names the example's telemetry file.

### Diagrams
- Mermaid in `reference/telemetry/overview.md`: `init`/`update` → scaffold per declared repo → app → daemon's traces and logs ports → readers.

### Changelog
- Placement, naming, the daemon address and the environment (Build Phase 1); the helper and the vocabulary (Build Phase 2); the truth in init's output and the skills (Build Phase 3).

### ADR in Docs
- Yes: `decisions/init-sets-up-telemetry.md`.

## References
- [brief.md](brief.md), [research.md](research.md), [test-plan.md](test-plan.md)
- [telemetry-from-day-one master](../telemetry-from-day-one/master.md), "The seam between the two"
- [daemon-found-not-guessed](../archive/daemon-found-not-guessed/adr.md)
- [mark-first](../mark-first/) — reads what the helper writes
- `apps/docs/src/decisions/day-monitor.md` — the application imports nothing from InDusk
- `apps/docs/src/decisions/one-promise-language.md`
