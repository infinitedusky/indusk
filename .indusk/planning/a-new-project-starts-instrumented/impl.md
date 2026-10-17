---
title: "Init sets up telemetry (New Projects)"
date: 2026-10-17
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "2307b439d7bf35bc8ce025d10fbb5f5900d9b75b46aa3682c8f33e7339b7c0ed"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T18:47:32.552Z"
---

# Init sets up telemetry (New Projects)

## Goal

A project InDusk scaffolds — through `indusk init`, the admin's new-project flow or
`indusk demo` — sends its spans, named after the project and carrying its project and
environment, to the local daemon from its first run; carries a small signal helper it
owns, pinned to the package's vocabulary; and is told only true things by what `init`
prints and the skills it installs. The decisions are in [adr.md](adr.md); the
assertions in [test-plan.md](test-plan.md).

## Scope

### In Scope

- One scaffold module behind `init` and `update`: per declared code repo, runtime found there, a "no app yet" line, a record of what InDusk wrote, newer versions written beside edited files.
- The templates for Node, Next.js, a browser app and Python: the service named in code, the daemon's stored address as the default, the project and environment on every span, the test-run marker; the logger sending to the logs port.
- The signal helper for Node and Python, and the signal keys in `lib/promises/vocabulary.ts`.
- `.mcp.json` in a workbench's code repo; a declined telemetry recommendation turning the extensions off.
- The seat-holds example writing its signal through the helper, with no second scaffold.
- `init`'s printed next steps; the otel, testing and local-telemetry skills; the docs pages named in the ADR.

### Out of Scope

- Reading signals, closing on them, standing per clause, a tracer for InDusk's own commands: mark-first.
- The app's exporter in production: production-is-heard. An attribute allowlist or redaction: production-keeps-only-what-it-should.
- Signals from the browser; runtimes beyond the four.
- Switching InDusk's own writers to the new outcome word: mark-first.
- The resting clause on the daemon's promise: a brief amendment for a person (see Notes).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test that can be written now, red; the register of the rest | the brief, the test plan |
| Build Phase 1 | `lib/scaffold/` (decide, render, record, apply); `templates/telemetry-settings.ts`; reworked templates; scaffold step in `init` (moved after config and extensions) and `update`; code-repo `.mcp.json`; declined telemetry writes `disabled_extensions` | `declaredRepoDirs`, `daemonAddress`, `PORT_BLOCK`, `getProjectGroupId`, `ensureMcpJson` |
| Build Phase 2 | vocabulary signal keys; `templates/signal.ts`, `templates/signal.py`; the test-run marker in the settings; the existing-setup rule; the example through the helper | the settings file and scaffold module from Build Phase 1 |
| Build Phase 3 | true next steps in `init`; rewritten skills, logger docblock and docs; 4318 and Dash0 gone; the live check recorded | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | In a workbench whose declared code repo holds a Next.js app, `indusk init` writes the instrumentation into that repo, for Next.js, and no instrumentation file at the workbench root | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/the-scaffold-sits-where-the-app-runs | apps/indusk-mcp/src/__tests__/init-scaffold-placement.test.ts |
| T2 | In a workbench whose code repo holds only a README, `init` writes no instrumentation and prints that the repo has no app yet, naming it; after a `package.json` appears, `indusk update` scaffolds it | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/the-scaffold-sits-where-the-app-runs | apps/indusk-mcp/src/__tests__/init-scaffold-placement.test.ts |
| T3 | For Node, Next.js, a browser app and Python, the files `init` writes set the service name in code, not only in a comment, to the project's name (the code repo's name in a workbench) | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/the-service-is-named | apps/indusk-mcp/src/__tests__/init-scaffold-runtimes.test.ts |
| T4 | No file outside archived plans, plan documents, incidents and the changelog names `unknown-service` | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/the-service-is-named | apps/indusk-mcp/src/__tests__/unknown-service-gone.test.ts |
| T5 | With no endpoint variable set, a scaffolded app sends traces to the daemon's stored traces address and logs to its logs address; a set endpoint wins; with no address stored, the rendered default is InDusk's block | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/the-spans-reach-the-daemon | apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts |
| T6 | Nothing InDusk hands an application (templates, skills, the demo's README, the docs pages on setting up an app, this repository's allow-list) tells it to send to `localhost:4318`; only the recording server keeps the standard port | Test Phase 1 | Build Phase 3 | written | unit | clause: a-new-project-reports-from-its-first-run/the-spans-reach-the-daemon | apps/indusk-mcp/src/__tests__/app-port-4318-gone.test.ts |
| T7 | For each runtime, the files `init` writes put `indusk.project` and `deployment.environment` on every span's resource | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/every-span-says-where-it-ran | apps/indusk-mcp/src/__tests__/init-scaffold-runtimes.test.ts |
| T8 | A scaffolded app's spans say `development` when nothing sets the environment, the set environment when one is set, and carry the InDusk project id the readers compare against | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/every-span-says-where-it-ran | apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts |
| T9 | After a person edits a scaffolded file, `update` leaves it byte for byte and writes the newer version beside it, saying so; an unedited file stays as written with nothing beside it | Test Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced | apps/indusk-mcp/src/__tests__/update-scaffold-refresh.test.ts |
| T10 | For every combination of present or missing, edited or not, recorded or not, the scaffold's decision is create, refresh, leave alone or write beside, and never overwrites an edit or a file InDusk did not write | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced | apps/indusk-mcp/src/lib/scaffold/plan.test.ts |
| T11 | On a fresh Next.js app, one `indusk init` and the first `next dev` put the project's service in the local Jaeger with the project and `development` on its spans, no file edited by hand | Build Phase 3 | Build Phase 3 | planned | live check | a rehearsal of the brief's first expectation on a real Next.js app, recorded once; the unit rows prove the clauses | manual: create-next-app in a temporary workbench's code repo, indusk init, next dev, search the local Jaeger for the service |
| T12 | Every signal key the Node and Python helpers and the settings file write is one the vocabulary defines, and every key the vocabulary defines for an app is written by each; a key changed on one side only fails, naming it | Build Phase 2 | Build Phase 2 | planned | unit | clause: an-app-writes-its-signal-from-a-helper-it-owns/one-vocabulary | apps/indusk-mcp/src/__tests__/signal-vocabulary-pin.test.ts |
| T13 | A signal the helper writes, upheld or broken with its symptom, with clause, value, bound, plan and phase, reads back through the package's span reader as that promise, clause and verdict | Build Phase 2 | Build Phase 2 | planned | unit | clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause | apps/indusk-mcp/src/__tests__/signal-helper.test.ts |
| T14 | A signal the helper writes from an app exporting to a real daemon in a temporary home is found in its Jaeger and read as the promise, clause and verdict given, with project and environment | Build Phase 2 | Build Phase 2 | planned | contract | clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause | apps/indusk-mcp/src/__tests__/signal-helper-daemon.contract.test.ts |
| T15 | Under Vitest, Jest, a Vite test build or `NODE_ENV=test`, the settings mark every span with the test-run marker and the helper's span carries it; outside a test runner none does | Build Phase 1 | Build Phase 2 | written | unit | clause: an-app-writes-its-signal-from-a-helper-it-owns/a-test-run-says-so | apps/indusk-mcp/src/__tests__/telemetry-settings.test.ts, apps/indusk-mcp/src/__tests__/signal-helper.test.ts |
| T16 | Every `indusk` command `init` prints exists in the CLI, every file it names as created, imported or run exists afterwards, `indusk infra start` is gone and `indusk editor install` is printed once | Test Phase 1 | Build Phase 3 | written | unit | clause: a-new-project-is-told-the-truth/next-steps-exist | apps/indusk-mcp/src/__tests__/init-next-steps.test.ts |
| T17 | The otel, testing and local-telemetry skills, their installed copies, the local-telemetry README and the otel docs page name no vendor and not composable.env, and each names `indusk telemetry address` | Test Phase 1 | Build Phase 3 | written | unit | clause: a-new-project-is-told-the-truth/the-skills-name-the-daemon | apps/indusk-mcp/src/__tests__/telemetry-skills-name-the-daemon.test.ts |
| T18 | The logger template and the three skills no longer call log records the home of business events or measurements, say a promise's signal is a span written by the helper, and correlate logs with the transport's own keys | Test Phase 1 | Build Phase 3 | written | unit | clause: a-new-project-is-told-the-truth/a-log-line-is-not-a-signal | apps/indusk-mcp/src/__tests__/log-line-not-signal.test.ts |
| T19 | Every tool the local-telemetry skill tells a person to call exists, with the parameters it names | Test Phase 1 | Build Phase 3 | written | unit | a regression guard over the skill's diagnosis pattern, which names a tool that does not exist and parameters the log tool drops | apps/indusk-mcp/src/__tests__/local-telemetry-skill-tools.test.ts |
| T20 | A project created with telemetry declined records the reason, enables neither telemetry extension and gets no instrumentation | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-recommendation-can-be-declined | apps/indusk-mcp/src/__tests__/new-project-telemetry-declined.test.ts |
| T21 | A workbench's declared code repo gets a `.mcp.json` from `init` and `update`, and one that exists is never rewritten | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-clone-without-an-mcp-config-gets-the-keep-list | apps/indusk-mcp/src/__tests__/workbench-code-repo-mcp-json.test.ts |
| T22 | A click in a scaffolded browser app still carries its trace to the project's own services | Test Phase 1 | Test Phase 1 | passing | unit | promise: a-click-and-its-server-work-share-a-trace | apps/indusk-mcp/templates/instrumentation.web.test.ts |
| T23 | Nothing `init` writes into an app names a vendor, and what it prints names each file and its SDK | Test Phase 1 | Test Phase 1 | passing | unit | promise: init-writes-no-vendor-into-an-app | apps/indusk-mcp/src/__tests__/init-browser-telemetry.test.ts |
| T24 | The seat-holds example writes its signal through a copy of the helper template, and `init` on a fresh copy adds no second OpenTelemetry setup | Test Phase 1 | Build Phase 2 | written | unit | the carried item: the demo's hand-written signal becomes the helper and its dead second scaffold goes | apps/indusk-mcp/src/__tests__/demo-signal-helper.test.ts |

## Checklist

### Test Phase 1: Write every test that needs no new code, failing today

**Tier**: med — the work step's default

This phase writes the tests that run init and update on temporary projects, read the
templates, skills and docs, and check the new-project flow and the demo, so each fails
today for the reason the plan exists. It records, with their bodies, the tests whose
subject is a file or function the build phases create. The first build phase then
makes the placement, naming, address and environment tests pass.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Made by `indusk plans start feature a-new-project-starts-instrumented`; check with `indusk worktree list`, and `indusk worktree assign a-new-project-starts-instrumented /Users/the_dusky/code/sandbox/dusk-worktrees/a-new-project-starts-instrumented` if it is not recorded.

  </details>
- [x] Write the placement tests: a workbench whose code repo holds a Next.js app, and one whose code repo holds only a README, then a package file added and update run.
  <details><summary>Technical</summary>

  T1, T2 in `apps/indusk-mcp/src/__tests__/init-scaffold-placement.test.ts`, through the built CLI (`runCli` from `helpers/cli.ts`, `describe.skipIf(SHOULD_SKIP)`), on a workbench made the way `init-workbench.test.ts` makes one (declared repo, `--workbench --wrapped-repo --sibling-parent`). Assert: `<repo>/instrumentation.ts` exists and imports `@vercel/otel`; no `instrumentation.ts`, `src/instrumentation.ts`, `logger.ts` or `filtering-exporter.ts` at the workbench root; for the README-only repo, stdout names the repo with "no app yet" and nothing is written; after writing `package.json` there, `indusk update` creates `<repo>/src/instrumentation.ts`. Red today: init detects at the workbench root and falls back to the Node path there; update scaffolds nothing. The file carries `// clause: a-new-project-reports-from-its-first-run/the-scaffold-sits-where-the-app-runs`.

  </details>
- [x] Write the runtime tests that read what init writes for each of the four runtimes, for the service name in code and the project and environment on every span.
  <details><summary>Technical</summary>

  T3, T7 in `apps/indusk-mcp/src/__tests__/init-scaffold-runtimes.test.ts`, reusing the four project shapes of `init-browser-telemetry.test.ts`. Strip comments (`//`, `/* */`, `#`, Python docstrings) from every file init wrote, then assert the project's name appears as a string in code and `unknown-service` does not; assert `indusk.project` and `deployment.environment` appear in code in each runtime's files. Red today: the Node, Next.js and Python files name the service only in a comment or not at all, and no template sets either attribute. Tokens: `clause: a-new-project-reports-from-its-first-run/the-service-is-named` and `.../every-span-says-where-it-ran`.

  </details>
- [x] Write the whole-repository checks that the placeholder service name and port 4318 as an application's default are gone.
  <details><summary>Technical</summary>

  T4 in `unknown-service-gone.test.ts`: `git ls-files` from `REPO_ROOT`, excluding `**/archive/**`, `.indusk/planning/**`, `.indusk/promises/incidents/**`, `apps/docs/src/changelog.md` and this test file; no line contains `unknown-service`. Red today: `init.ts` four times and five templates. T6 in `app-port-4318-gone.test.ts`: same file walk, also excluding `*.test.ts` (fixtures set the variable to a fake collector) and `.indusk/graph/**`; no line contains `localhost:4318`. Red today: `.claude/settings.json` (a curl allow entry), `.indusk/extensions/local-telemetry/.env.example` (a stale copy), `apps/docs/src/reference/tools/otel.md`, `examples/seat-holds/README.md`. Grep, never a list from memory (lesson: a-plan-that-retires-wording-greps-the-whole-repo-for-it-and-carries-a-grep-is-gone-row).

  </details>
- [x] Write the update test: after init, edit a scaffolded file, run update, and check the edit is untouched and a newer version sits beside it.
  <details><summary>Technical</summary>

  T9 in `update-scaffold-refresh.test.ts`, a Node project through the built CLI: init; append a line to `src/instrumentation.ts`; `indusk update`; the file is byte-identical to the edited content, `src/instrumentation.ts.indusk-new` exists, stdout names it; an unedited `src/logger.ts` is unchanged and has no `.indusk-new`. Red today: update writes no template, so nothing is beside the edited file. Token `clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced`.

  </details>
- [x] Write the truth tests: init's printed commands and files exist, the three skills name the daemon and no vendor, log lines are not presented as signals, and the skill's tool calls match the tools.
  <details><summary>Technical</summary>

  T16 in `init-next-steps.test.ts`: run init on a Node project; every `indusk <word>` in stdout is a command of the built CLI (read `indusk --help`'s command list); every path on a `create:` line and in a `wire:` import or run line exists under the project afterwards; `infra start` absent; `indusk editor install` appears exactly once. T17 in `telemetry-skills-name-the-daemon.test.ts` over `apps/indusk-mcp/extensions/{otel,testing,local-telemetry}/skill.md`, `.claude/skills/{otel,testing,local-telemetry}/SKILL.md`, `apps/indusk-mcp/extensions/local-telemetry/README.md`, `apps/docs/src/reference/tools/otel.md`: no `dash0`, `datadog`, `newrelic`, `honeycomb`, `sentry`, `composable.env`, `ce env:build` (case-insensitive); each names `indusk telemetry address`. T18 in `log-line-not-signal.test.ts`: `templates/logger.ts` and the three skills carry no "business events" or "measurement" beside a log level; each skill says a signal is a span and names the helper (`signal.upheld`); the otel skill's correlation example returns `trace_id`, `span_id`, `trace_flags`. T19 in `local-telemetry-skill-tools.test.ts`: every `tool_name(` or table row naming a tool in the local-telemetry skill is `tail_logs` (with only `service`, `level`, `since_minutes`, `limit`, read from `src/tools/telemetry-tools.ts`'s schema) or one of Jaeger's MCP tools (`search_traces`, `get_span_details`, `get_trace_topology`, `get_critical_path`, `get_trace_errors`, `get_services`, `get_span_names`, `health`). All red today on the cited lines.

  </details>
- [x] Write the tests for the two promises this plan must not break that it now extends: telemetry declined in the new-project flow, and a code repo's MCP config.
  <details><summary>Technical</summary>

  T20 in `new-project-telemetry-declined.test.ts`, driving creation the way `new-project-cli.test.ts` does, with the telemetry recommendation declined and a reason: the config records the reason, `disabled_extensions` names `local-telemetry` and `otel`, neither has a manifest under `.indusk/extensions/`, and no instrumentation file exists in the workbench or the repo. Red today: the flow records the decline after init has enabled both. T21 in `workbench-code-repo-mcp-json.test.ts`: init on a workbench writes `<repo>/.mcp.json` naming `indusk`; a pre-existing one with other content is byte-identical after `update`. Red today: only the workbench root gets one.

  </details>
- [x] Write the demo test: the example writes its signal through a copy of the helper template, and init on a fresh copy adds no instrumentation of its own.
  <details><summary>Technical</summary>

  T24 in `demo-signal-helper.test.ts`: `examples/seat-holds/src/signal.ts` equals `apps/indusk-mcp/templates/signal.ts` byte for byte (both read inside the test, so a missing file fails the assertion, not the load); `src/server.ts` imports `./signal.js` and `src/telemetry.ts` no longer sets `indusk.promise` by hand; a fresh copy (as `demo-example.test.ts` makes one) run through `indusk init` gains no `src/instrumentation.ts`, `src/logger.ts` or `src/filtering-exporter.ts`. Red today on all three.

  </details>
- [x] Run the two existing tests that guard the browser trace and the vendor-free scaffold, and confirm they pass before anything changes.
  <details><summary>Technical</summary>

  T22: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.templates.config.ts`; T23: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/init-browser-telemetry.test.ts`.

  </details>
- [x] Make the two whole-repository wording checks run whether or not the command line is built, since they never use it.
  <details><summary>Technical</summary>

  Shape finding. `unknown-service-gone.test.ts` (T4) and `app-port-4318-gone.test.ts` (T6) dropped `describe.skipIf(SHOULD_SKIP)`: they read the tracked tree and never run the CLI, so the gate made them report green by not running whenever dist was absent. Rule: a check that cannot tell nothing-to-do from did-not-run reports the shape of success (work skill, Shape). Both still red on their own assertion.

  </details>
- [x] Make the declined-telemetry test's description claim only what it checks.
  <details><summary>Technical</summary>

  Shape finding. `new-project-telemetry-declined.test.ts` (T20): its header said no daemon is registered; the test asserts no such thing and the row does not claim it. Rule: a test says what it asserts, no more (testing extension).

  </details>

#### Deferred to Build Phase 1

- **T5** — its subject is the settings file each app carries, `templates/telemetry-settings.ts`, and the scaffold's renderer, both created in Build Phase 1; importing either today fails to load. Body reviewed:

  ```typescript
  // clause: a-new-project-reports-from-its-first-run/the-spans-reach-the-daemon
  import { describe, expect, it } from "vitest";
  import { telemetrySettings } from "../../templates/telemetry-settings.js";
  import { settingsValues } from "../lib/scaffold/render.js";
  import { PORT_BLOCK } from "../lib/telemetry/daemon-address.js";

  const RENDERED = {
    service: "homework-gate",
    project: "homework_gate_workbench",
    traces: "http://localhost:24318",
    logs: "http://localhost:24319",
  };

  describe("where a scaffolded app sends", () => {
    it("with nothing set, traces and logs go to the daemon's stored address", () => {
      const s = telemetrySettings({}, RENDERED);
      expect(s.tracesUrl).toBe("http://localhost:24318/v1/traces");
      expect(s.logsUrl).toBe("http://localhost:24319/v1/logs");
    });
    it("a set endpoint wins, the signal-specific one over the general one", () => {
      const general = { OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example" };
      expect(telemetrySettings(general, RENDERED).tracesUrl).toBe("https://collector.example/v1/traces");
      expect(telemetrySettings(general, RENDERED).logsUrl).toBe("https://collector.example/v1/logs");
      const traces = { ...general, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://t.example/v1/traces" };
      expect(telemetrySettings(traces, RENDERED).tracesUrl).toBe("https://t.example/v1/traces");
    });
    it("rendered with no stored address, the default is InDusk's block", () => {
      const v = settingsValues({ service: "app", project: "app", address: null });
      expect(v.traces).toBe(`http://localhost:${PORT_BLOCK.traces}`);
      expect(v.logs).toBe(`http://localhost:${PORT_BLOCK.logs}`);
    });
  });
  ```

- **T8** — same subject as the row above: the settings file created in Build Phase 1. Body reviewed:

  ```typescript
  // clause: a-new-project-reports-from-its-first-run/every-span-says-where-it-ran
  it("development unless set; the set environment wins; the project is the InDusk id", () => {
    expect(telemetrySettings({}, RENDERED).resource).toMatchObject({
      "service.name": "homework-gate",
      "indusk.project": "homework_gate_workbench",
      "deployment.environment": "development",
    });
    const set = { OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=production,team=a" };
    expect(telemetrySettings(set, RENDERED).resource["deployment.environment"]).toBe("production");
    expect(telemetrySettings({ OTEL_SERVICE_NAME: "other" }, RENDERED).resource["service.name"]).toBe("other");
  });
  ```

- **T10** — its subject is the scaffold's decision function, `lib/scaffold/plan.ts`, created in Build Phase 1. Body reviewed:

  ```typescript
  // clause: a-new-project-reports-from-its-first-run/a-newer-template-is-offered-not-forced
  import { createHash } from "node:crypto";
  import { describe, expect, it } from "vitest";
  import { decideFile } from "./plan.js";

  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  const NEW = "rendered v2";

  describe("what the scaffold does with one file", () => {
    it.each([
      [{ current: null, recorded: null }, "create"],
      [{ current: null, recorded: h("rendered v1") }, "create"],
      [{ current: "rendered v1", recorded: h("rendered v1") }, "refresh"],
      [{ current: NEW, recorded: h(NEW) }, "refresh"],
      [{ current: NEW, recorded: h("rendered v1") }, "record"],
      [{ current: "edited", recorded: h("rendered v1") }, "beside"],
      [{ current: NEW, recorded: null }, "record"],
      [{ current: "someone else's", recorded: null }, "beside"],
    ] as const)("%j → %s", (file, action) => {
      expect(decideFile({ ...file, rendered: NEW }).action).toBe(action);
    });
    it("never overwrites a file whose content is not what InDusk recorded", () => {
      for (const current of ["edited", "", "rendered v2 plus a line"]) {
        expect(decideFile({ current, recorded: h("rendered v1"), rendered: NEW }).action).not.toBe("refresh");
      }
    });
  });
  ```

- **T15** — writable once the settings file exists (Build Phase 1) and red there, because the test-run marker is added in Build Phase 2; the helper's half joins the helper's test in Build Phase 2. Body reviewed:

  ```typescript
  // clause: an-app-writes-its-signal-from-a-helper-it-owns/a-test-run-says-so
  it.each([
    [{ VITEST: "true" }, true],
    [{ JEST_WORKER_ID: "1" }, true],
    [{ MODE: "test" }, true],
    [{ NODE_ENV: "test" }, true],
    [{}, false],
    [{ NODE_ENV: "production" }, false],
  ])("%j marks a test run: %s", (env, marked) => {
    const s = telemetrySettings(env, RENDERED);
    expect(s.testRun).toBe(marked);
    expect(s.resource["indusk.run"]).toBe(marked ? "test" : undefined);
  });
  ```

#### Deferred to Build Phase 2

- **T12** — its subjects are the helper templates and the vocabulary's signal keys, created in Build Phase 2; the vocabulary export does not exist today. Body reviewed:

  ```typescript
  // clause: an-app-writes-its-signal-from-a-helper-it-owns/one-vocabulary
  import { readFileSync } from "node:fs";
  import { join } from "node:path";
  import { describe, expect, it } from "vitest";
  import { APP_RESOURCE_KEYS, APP_SIGNAL_KEYS } from "../lib/promises/vocabulary.js";

  const T = join(__dirname, "../../templates");
  /** Keys in code only: line comments, block comments and Python comments are dropped first. */
  const code = (file: string) =>
    readFileSync(join(T, file), "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*(\/\/|#).*$/gm, "");
  const keysIn = (file: string) =>
    new Set([...code(file).matchAll(/["'](indusk\.[a-z_.]+|deployment\.environment)["']/g)].map((m) => m[1]));
  const signal = new Set(Object.values(APP_SIGNAL_KEYS));
  const resource = new Set(Object.values(APP_RESOURCE_KEYS));

  describe("the helpers write the vocabulary's keys and no others", () => {
    for (const file of ["signal.ts", "signal.py"]) {
      it(`${file}: every key it writes is defined, and every signal key is written`, () => {
        const found = keysIn(file);
        expect([...found].filter((k) => !signal.has(k) && !resource.has(k))).toEqual([]);
        expect([...signal].filter((k) => !found.has(k))).toEqual([]);
      });
    }
    for (const file of ["telemetry-settings.ts", "instrumentation.py"]) {
      it(`${file}: every resource key is the vocabulary's`, () => {
        const found = keysIn(file);
        expect([...resource].filter((k) => !found.has(k))).toEqual([]);
        expect([...found].filter((k) => !resource.has(k))).toEqual([]);
      });
    }
  });
  ```

- **T13** — its subject is the helper template, `templates/signal.ts`, created in Build Phase 2; importing it today fails to load. Body reviewed:

  ```typescript
  // clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause
  import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
  import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
  import { expect, it } from "vitest";
  import { parseMarkedSpan } from "../lib/promises/telemetry.js";
  import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
  import { signal } from "../../templates/signal.js";

  /** The span as Jaeger would hand it back: attributes as tags, events as logs (as signal-writers.test.ts does). */
  const asJaegerSpan = (s: ReadableSpan) => ({
    traceID: s.spanContext().traceId, spanID: s.spanContext().spanId, operationName: s.name,
    startTime: 1_000_000, duration: 1_000, processID: "p",
    tags: Object.entries(s.attributes).map(([key, value]) => ({ key, value: String(value) })),
    logs: s.events.map((e) => ({ timestamp: 0, fields: [{ key: "event", value: e.name },
      ...Object.entries(e.attributes ?? {}).map(([key, value]) => ({ key, value: String(value) }))] })),
  });

  const exporter = new InMemorySpanExporter();
  new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] }).register();

  it("upheld and broken signals read back as written", () => {
    signal.upheld({ promise: "a-hold-is-released", clause: "on-time", value: 812, bound: 1000, plan: "p", phase: "Build Phase 2" });
    signal.broken({ promise: "a-hold-is-released", clause: "on-time", symptom: "released 5.1 s late" });
    const [up, down] = exporter.getFinishedSpans().map((s) => parseMarkedSpan(asJaegerSpan(s), "app"));
    expect(up).toMatchObject({ promise: "a-hold-is-released", clause: "on-time", outcome: "upheld" });
    expect(down).toMatchObject({ outcome: "broken", symptom: "released 5.1 s late" });
  });
  ```

- **T14** — same subject as the row above, against a real daemon; a system-tier file (it starts a daemon in a temporary home). Body reviewed:

  ```typescript
  // clause: an-app-writes-its-signal-from-a-helper-it-owns/a-signal-names-its-promise-and-clause
  import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
  import { resourceFromAttributes } from "@opentelemetry/resources";
  import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
  import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
  import { afterAll, expect, it } from "vitest";
  import { jaegerEndpoint, marksBetween } from "../lib/promises/telemetry.js";
  import { telemetrySettings } from "../../templates/telemetry-settings.js";
  import { signal } from "../../templates/signal.js";
  import { startLocalJaeger } from "./helpers/local-jaeger.js";

  const jaeger = await startLocalJaeger();
  afterAll(() => jaeger.stop());

  it("a helper signal reaches the daemon and reads back with project and environment", async () => {
    const s = telemetrySettings({}, { service: "app", project: "app", traces: `http://localhost:${jaeger.otlpPort}`, logs: "" });
    const provider = new NodeTracerProvider({
      resource: resourceFromAttributes(s.resource),
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: s.tracesUrl }))],
    });
    provider.register();
    const from = new Date();
    signal.upheld({ promise: "a-hold-is-released", clause: "on-time" });
    await provider.forceFlush();
    // Jaeger stores in batches: a span flushed now may not be queryable yet, so poll.
    let marks: Awaited<ReturnType<typeof marksBetween>>["marks"] = [];
    for (const deadline = Date.now() + 15_000; marks.length === 0 && Date.now() < deadline; ) {
      ({ marks } = await marksBetween(jaegerEndpoint(jaeger.queryUrl), {
        service: "app", name: "a-hold-is-released", promise: "a-hold-is-released",
        from, to: new Date(Date.now() + 60_000), project: "app", timeoutMs: 5_000,
      }));
      if (marks.length === 0) await new Promise((r) => setTimeout(r, 250));
    }
    expect(marks[0]).toMatchObject({ clause: "on-time", outcome: "upheld", environment: "development" });
  });
  ```

#### Deferred to Build Phase 3

- **T11** — a live check is run once, against the finished build on a real Next.js app with its dependencies installed; there is nothing to write earlier than the procedure in its Test cell, and it records its result in this plan rather than going red.

#### Regression Guards

- **T22** — the browser template's click-trace test passes today and must keep passing while the template gains the settings file and the default address; the template is moved and renamed, not rewired.
- **T23** — the vendor-free scaffold test passes today and must keep passing while init's output changes shape.

#### Test Phase 1 Verification

- [x] Every test this phase writes exists and fails on its own assertion, not on a missing file or import.
  <details><summary>Technical</summary>

  (write red) T1, T2, T3, T4, T6, T7, T9, T16, T17, T18, T19, T20, T21, T24: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/init-scaffold-placement.test.ts src/__tests__/init-scaffold-runtimes.test.ts src/__tests__/unknown-service-gone.test.ts src/__tests__/app-port-4318-gone.test.ts src/__tests__/update-scaffold-refresh.test.ts src/__tests__/init-next-steps.test.ts src/__tests__/telemetry-skills-name-the-daemon.test.ts src/__tests__/log-line-not-signal.test.ts src/__tests__/local-telemetry-skill-tools.test.ts src/__tests__/new-project-telemetry-declined.test.ts src/__tests__/workbench-code-repo-mcp-json.test.ts src/__tests__/demo-signal-helper.test.ts` — each red on an assertion naming today's file or line.

  </details>
- [x] The two guard tests pass.
  <details><summary>Technical</summary>

  T22 and T23 green, by the commands in the last task above.

  </details>
- [x] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  T5, T8, T10, T15 (Build Phase 1), T12, T13, T14 (Build Phase 2), T11 (Build Phase 3): each body compiles at the phase it names and asserts what its row claims.

  Reviewed 2026-10-17 with Sandy. T13/T14 asserted a `clause` the span reader did not return: Sandy chose to add the read in Build Phase 2 (new item there) rather than drop it from the rows. T14 now polls Jaeger instead of reading once after flush. T10 gained a missing file with a record (create) and an unedited file already at the newest rendering (refresh); "leave alone" in its row is the ADR's beside. T12 strips comments before matching keys. T5, T8, T15 and T11 unchanged.

  </details>

#### Test Phase 1 Context

- [x] Record in this session's section of the operational state that the plan is at Test Phase 1 with its tests red.
  <details><summary>Technical</summary>

  current.md: via `mcp__indusk__update_current_section` at handoff.

  </details>

#### Test Phase 1 Document

- [x] Check the test plan still matches the tests as written, and correct it where a test had to say more.
  <details><summary>Technical</summary>

  `test-plan.md`, the rows of this phase; no docs page yet.

  </details>

### Build Phase 1: The scaffold sits in the code repo, names the service, sends to the daemon and says where it ran

**Tier**: strong — rewrites the scaffold step of init and update, which every new and existing project runs through, across four runtimes, and moves it to after the config and extensions are written

This phase builds one place that decides what InDusk scaffolds and where, and calls it
from init and update. The files go into each declared code repo for the runtime found
there, never the workbench root; a repo with no app is named and scaffolded later by
update. Every template names the service in code and reads a small settings file,
rendered with the project's name, its InDusk id and the daemon's stored address, that
decides where spans go and which environment and project they carry. A record of what
InDusk wrote lets update refresh untouched files and put newer versions beside edited
ones. A code repo also gets its MCP config, and a declined telemetry recommendation
turns the telemetry extensions off. If the later phases stall, this one can land alone.

- [x] Write the settings file each scaffolded app will carry, with one function that takes the environment and the rendered values and returns where to send, the service name and the resource attributes.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/templates/telemetry-settings.ts`, no imports:

  ```typescript
  export interface Rendered { service: string; project: string; traces: string; logs: string }
  /** Replaced whole by the scaffold; one line, so a render is one substitution. */
  export const RENDERED: Rendered = { service: "", project: "", traces: "", logs: "" };
  export function telemetrySettings(env: Record<string, string | undefined>, r: Rendered = RENDERED): {
    serviceName: string; tracesUrl: string; logsUrl: string; testRun: boolean; resource: Record<string, string>;
  }
  ```

  Precedence: `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` as given, else `OTEL_EXPORTER_OTLP_ENDPOINT` + `/v1/traces`, else `r.traces` + `/v1/traces` (logs the same with `_LOGS_` and `r.logs`). `OTEL_SERVICE_NAME` over `r.service`. Resource: `service.name`, `indusk.project` (`r.project`), `deployment.environment` (`development` unless `OTEL_RESOURCE_ATTRIBUTES` names it). `testRun` is `false` here; Build Phase 2 adds the marker. Python: the same decisions inline at the top of `templates/instrumentation.py`, with a rendered dict.

  </details>
- [x] Build the scaffold module: given what was read from each target, decide its runtime, the files to write and what to do with each, render the templates, and apply the result while keeping a record of what InDusk wrote.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/scaffold/`: `plan.ts` (`detectRuntime(markers)`, `decideFile({ current, recorded, rendered })` → `create | refresh | record | beside | leave`, `scaffoldPlan(targets, reads)`), `render.ts` (`settingsValues({ service, project, address })` from `daemonAddress(induskHome())`'s URLs, else `PORT_BLOCK` — never a port literal, per the reader-module test in `telemetry-address.test.ts`; `renderSettings` replaces the `RENDERED` line), `record.ts` (`.indusk/scaffold.json` at the project root: `{ files: { "<repo-relative path from project root>": "<sha256>" } }`), `apply.ts` (writes, prints `create:`, `refresh:`, `beside: <file>.indusk-new (you changed <file>; the newer version is beside it)`, `no app yet: <repo>`). Targets: `declaredRepoDirs(projectRoot)` (name used as the service), else `[{ name: basename(projectRoot), dir: projectRoot }]`. Markers: `next.config.{js,ts,mjs}`, `vite.config.{ts,js}`, `package.json`, `requirements.txt`/`pyproject.toml`; none means no app — the Node fallback is removed. Project id: `getProjectGroupId(projectRoot)`.

  </details>
- [x] Rework the Node, Next.js, browser and Python templates so each names the service from the settings, sends to the settings' addresses with nothing set, and puts the project and environment on its resource; make the logger send to the logs address.
  <details><summary>Technical</summary>

  `templates/instrumentation.ts`: `const s = telemetrySettings(process.env)`; `new OTLPTraceExporter({ url: s.tracesUrl })` always (console exporter removed), resource from `s.resource`. `templates/instrumentation.next.ts`: set `process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??= s.tracesUrl` before `registerOTel({ serviceName: s.serviceName, attributes: s.resource })`. `templates/instrumentation.web.ts`: endpoint default from `telemetrySettings(import.meta.env ?? process.env-shaped values)`; propagation and instrumentations untouched (must not break the click trace). `templates/instrumentation.py`: rendered values, `OTLPSpanExporter(endpoint=…)` always, resource with both keys. `templates/logger.ts`: transport `url: s.logsUrl`; docblock left for Build Phase 3. No `unknown-service` anywhere.

  </details>
- [x] Move init's scaffold step after the config write and the extension enable, and replace it with a call to the scaffold module.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/commands/init.ts`: delete the `[OpenTelemetry]` block (step 7) and its four `String.replace` calls; call `applyScaffold(projectRoot, { force })` after `writeConfig` and the workbench's `extensionsEnable(["worktree"])`, still skipped for `--local` and the package's own repo; skipped too when `otel` is in `disabled_extensions`. `--force` keeps today's meaning (overwrite). `NODE_TEMPLATE_PURPOSE` and the printed install and wire lines move into `apply.ts` per runtime.

  </details>
- [x] Make update run the scaffold on every run, so a repo that gained an app is scaffolded and an untouched file is refreshed.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/commands/update.ts`: a `[Telemetry scaffold]` section calling `applyScaffold(projectRoot, { force: false })` after the test-runner detection (step 5c''). No port literal (the reader-module test covers this file).

  </details>
- [x] Write the MCP config into each declared code repo from init and update, never over one that exists.
  <details><summary>Technical</summary>

  `ensureMcpJson(repo.dir)` for each of `declaredRepoDirs(projectRoot)` in both commands; the existing call at the root stays.

  </details>
- [x] Make a declined telemetry recommendation in the new-project flow turn both telemetry extensions off before init runs.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/new-project/create.ts`: before the `init --workbench` spawn, when the proposal's `telemetry` recommendation is not kept, write `disabled_extensions: ["local-telemetry", "otel"]` into `.indusk/config.json` (created if absent; `writeConfig` must keep the key when init writes the config later — check it merges). `recordChoices` still records the reason.

  </details>
- [x] Review the code this phase wrote against the enabled extensions' rules, and add what the review finds here as unchecked items.
  <details><summary>Technical</summary>

  Shape step: TypeScript and testing extensions' rules over `lib/scaffold/`, the templates and the two commands.

  </details>
- [x] Shape: Move the decision that a refreshed file is already current (so neither written nor printed) out of apply.ts, which re-reads the file to decide it, into scaffoldPlan, which already holds the current content; apply then only writes what the plan says
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/scaffold/apply.ts`. Rule: code that decides takes its reads (lesson: code-that-decides-takes-its-clock-and-its-reads); Shape: is there a seam a test can reach

  </details>
- [ ] Shape: Give the inline block that enables the otel extension after the scaffold created files a name, so init reads as steps
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/bin/commands/init.ts`. Rule: Shape: should this inline block have been a named function

  </details>

#### Build Phase 1 Verification

- [x] The placement, naming, address, environment and record tests pass, as do the tests for the code repo's MCP config and the declined recommendation.
  <details><summary>Technical</summary>

  (goes green) T1, T2, T3, T4, T5, T7, T8, T9, T10, T20, T21: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/init-scaffold-placement.test.ts src/__tests__/init-scaffold-runtimes.test.ts src/__tests__/unknown-service-gone.test.ts src/__tests__/telemetry-settings.test.ts src/__tests__/update-scaffold-refresh.test.ts src/lib/scaffold/plan.test.ts src/__tests__/new-project-telemetry-declined.test.ts src/__tests__/workbench-code-repo-mcp-json.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/bin/commands/init.ts src/bin/commands/update.ts src/lib/new-project/create.ts`

  </details>
- [x] The test-run marker test is written and fails, because the marker is the next phase's.
  <details><summary>Technical</summary>

  (write red) T15's settings half in `telemetry-settings.test.ts`: red on `testRun` for the test-runner cases.

  </details>
- [x] The browser click-trace and vendor-free guards still pass.
  <details><summary>Technical</summary>

  T22: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.templates.config.ts`; T23: `vitest run src/__tests__/init-browser-telemetry.test.ts` (update its expected lines if the create lines moved, keeping every assertion).

  </details>

#### Build Phase 1 Context

- [ ] Add this plan's decision to the root context file's list of key decisions.
  <details><summary>Technical</summary>

  root (Key Decisions): "Init sets up telemetry: one scaffold module per declared code repo, a settings file per app rendered with the daemon's stored address, project and environment on every span, a record so update offers newer templates beside edits — see `/decisions/init-sets-up-telemetry`" — always-on because the Key Decisions list carries one line per accepted ADR, as the claude-md skill sets it.

  </details>
- [ ] Record in the package's own context file that every scaffolded file goes through the scaffold module, never a copy written inline in init or update.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`: "A template reaches a project only through `lib/scaffold/` (render, record, apply); init and update call it; the record is `.indusk/scaffold.json`."

  </details>

#### Build Phase 1 Document

- [ ] Rewrite the telemetry overview's section on what a project is handed: where the scaffold goes, how an app finds the daemon, and the newer-version file, with a diagram.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/telemetry/overview.md`: replace the claim that enabling the extension writes an `.env` component (around lines 97 and 162–165); add the Mermaid flow from the ADR's Documentation Plan; `apps/docs/src/changelog.md` entry for placement, naming, address and environment.

  </details>
- [ ] Publish the decision record to the docs site.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/init-sets-up-telemetry.md` from `adr.md`.

  </details>

### Build Phase 2: The app writes its signal from a helper it owns, in the package's one vocabulary

**Tier**: med — the work step's default

This phase adds the signal's keys to the package's vocabulary, the one definition the
promise readers read, and writes the small helper each app carries for Node and Python,
importing only the OpenTelemetry interface, held equal to the vocabulary by a test. A
test run's spans are marked as test-made. An app that already sets up OpenTelemetry
gets only the helper, and the seat-holds example writes its signal through it. The
next phase then makes what init prints and the skills teach match all of this.

- [ ] Add the keys an app's signal and resource carry to the package's vocabulary, move the environment key there, and reverse the comment that says an app's spans carry no project.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/vocabulary.ts`: `APP_SIGNAL_KEYS = { promise, clause, outcome, violatedEvent, symptom, value: "indusk.signal.value", bound: "indusk.signal.bound", plan: "indusk.signal.plan", phase: "indusk.signal.phase" }` (the first five from `PROMISE_MARK`), `APP_RESOURCE_KEYS = { project: "indusk.project", environment: "deployment.environment", run: "indusk.run" }`, `TEST_RUN_VALUE = "test"`. `lib/promises/telemetry.ts` imports `ENVIRONMENT_ATTRIBUTE` from the vocabulary. `promises-single-definition.test.ts` stays green.

  </details>
- [ ] Make the package's span reader read a signal's clause back, so a clause the helper writes is read by something.
  <details><summary>Technical</summary>

  Added at the Test Phase 1 register review (Sandy, 2026-10-17): T13 and T14 assert `clause` on `parseMarkedSpan`'s result and `MarkedSpan` had none. `lib/promises/telemetry.ts`: `MarkedSpan` gains `clause?: string`, set from `PROMISE_MARK.clause` when the span carries it and absent otherwise (as `look` is), so every existing reader and fixture is unchanged. The reader is mark-first's; this adds a field and changes no rule.

  </details>
- [ ] Write the Node signal helper and its Python twin: one call for upheld and one for broken, each writing one short span with the promise, clause, verdict, symptom, value, bound, plan and phase, and the project and test marker copied onto it.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/templates/signal.ts` (imports `@opentelemetry/api` only) and `templates/signal.py` (`opentelemetry.trace` only), per ADR decision 6. The outcome written is `upheld` or `broken`. Project and marker are read from the settings file (`./telemetry-settings`); in Python from the instrumentation module's rendered values.

  </details>
- [ ] Add the test-run marker to the settings: a run under a test runner is marked on every span's resource.
  <details><summary>Technical</summary>

  `templates/telemetry-settings.ts`: `testRun = Boolean(env.VITEST || env.JEST_WORKER_ID || env.MODE === "test" || env.NODE_ENV === "test")`; `resource["indusk.run"] = "test"` when true. `instrumentation.py`: `"pytest" in sys.modules` or `PYTEST_VERSION`.

  </details>
- [ ] Make the scaffold write the helper into every server app, and write only the helper when the app already sets up OpenTelemetry itself.
  <details><summary>Technical</summary>

  `lib/scaffold/plan.ts`: `signal.ts` for Node and Next.js, `signal.py` for Python, none for a browser-only app. Existing-setup rule: `package.json` dependencies naming `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-web` or `@vercel/otel`, or `opentelemetry-sdk` in Python requirements → helper and settings only, with a printed line saying the app sets up OpenTelemetry itself.

  </details>
- [ ] Make the seat-holds example write its signal through the helper and stop setting the promise's attributes by hand.
  <details><summary>Technical</summary>

  `examples/seat-holds/src/signal.ts` (a copy of the template) and `src/telemetry-settings.ts` rendered for seat-holds; `markRelease` in `src/telemetry.ts` calls `signal.upheld` / `signal.broken({ symptom })`; the example's provider stays. Update the example's promise `sites` if they name the old lines (`examples/seat-holds/.indusk/promises/`), through `indusk promises` in that folder, never by hand.

  </details>
- [ ] Review the code this phase wrote against the enabled extensions' rules, and add what the review finds here as unchecked items.
  <details><summary>Technical</summary>

  Shape step over the vocabulary, the two helpers, the settings change and the example.

  </details>

#### Build Phase 2 Verification

- [ ] The vocabulary pin, the helper's read-back and the test-run marker tests pass, and the demo test passes.
  <details><summary>Technical</summary>

  (goes green) T12, T13, T15, T24: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/signal-vocabulary-pin.test.ts src/__tests__/signal-helper.test.ts src/__tests__/telemetry-settings.test.ts src/__tests__/demo-signal-helper.test.ts src/__tests__/promises-single-definition.test.ts src/__tests__/demo-example.test.ts`

  </details>
- [ ] A helper signal sent to a real daemon in a temporary home reads back as written.
  <details><summary>Technical</summary>

  (goes green) T14, added to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/signal-helper-daemon.contract.test.ts`

  </details>

#### Build Phase 2 Context

- [ ] Record in the promise library's context file that a signal key is added in the vocabulary and in both helper templates together.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/CLAUDE.md`: "An app's signal and resource keys live in `vocabulary.ts` (`APP_SIGNAL_KEYS`, `APP_RESOURCE_KEYS`); `templates/signal.ts`, `signal.py`, `telemetry-settings.ts` and `instrumentation.py` spell them as strings and `signal-vocabulary-pin.test.ts` holds them equal — change both sides together."

  </details>

#### Build Phase 2 Document

- [ ] Write the signal helper's reference page, and make the promises guide show the helper first.
  <details><summary>Technical</summary>

  New `apps/docs/src/reference/telemetry/signal-helper.md` (the two calls, the keys, the marker, the same keys from another language); `apps/docs/src/guide/promises.md` "Marking a behaviour promise": the helper first, the attributes it writes after; changelog entry.

  </details>

### Build Phase 3: What init prints and the skills teach are true

**Tier**: med — the work step's default

This phase makes init's closing lines name only commands that exist and print the
editor install once, tells a Next.js project to load the browser file from a client
component, and rewrites the otel, testing and local-telemetry skills so they send a
person to the local daemon, say a promise's signal is a span written by the helper and
a log line is for diagnosis, and call only tools that exist. The standard port and
Dash0 leave everything an app is handed. A fresh Next.js app is then run once to
record that its first run reports.

- [ ] Rewrite init's next steps so every command named exists, and print the editor install once.
  <details><summary>Technical</summary>

  `init.ts` summary: drop `indusk infra start`; steps: restart Claude Code, `/catchup`, edit `CLAUDE.md`, `/planner …`, and `indusk editor install` (once, with what it installs). The Next.js browser wiring line in `lib/scaffold/apply.ts`: import `./instrumentation.web` from a client component (one starting with `"use client"`), not the root layout.

  </details>
- [ ] Rewrite the otel, testing and local-telemetry skills: point to the local daemon and its address command, teach the helper as the way to write a signal, keep log lines for diagnosis, use the log transport's correlation keys, and name only real tools with their real parameters; refresh the installed copies.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/extensions/otel/skill.md` (line ~241 Dash0 check → `indusk telemetry address` and the local Jaeger; the `OTEL_SERVICE_NAME` row "Set by init" → "in `telemetry-settings.ts`"; correlation example returns `trace_id`, `span_id`, `trace_flags`; INFO no longer "business events"), `extensions/testing/skill.md` (the attribute snippet → `signal.upheld` / `signal.broken`, outcome `broken`), `extensions/local-telemetry/skill.md` (drop "Dash0's job", the composable.env pattern and `.env.dash0`; `tail_logs({ service, level, since_minutes, limit })`; `get_trace` → `get_span_details` / `search_traces`; "init scaffolds your app to send here"), `extensions/local-telemetry/README.md`, `extensions/local-telemetry/.env.example` (drop composable.env). Resync `.claude/skills/{otel,testing,local-telemetry}/SKILL.md`; `skill-sync-parity.test.ts` and `promise-words.test.ts` stay green.

  </details>
- [ ] Rewrite the logger template's header so it presents log records as diagnosis, not as the place for business events or measurements.
  <details><summary>Technical</summary>

  `templates/logger.ts` docblock: INFO is "what happened, for diagnosis"; a promise's signal is a span written with `./signal`.

  </details>
- [ ] Remove port 4318 as an application's default from the docs page, the demo's README, this repository's allow-list and the stale extension file copy.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/tools/otel.md` (~line 329, and the Dash0 / `pnpm ce env:build` section ~313–323 → the scaffold per runtime), `examples/seat-holds/README.md:35` (→ `indusk telemetry address`), `.claude/settings.json` (the curl allow entry naming `localhost:4318`), `.indusk/extensions/local-telemetry/.env.example` (refreshed by `indusk update` in this repo).

  </details>
- [ ] Run the live check on a fresh Next.js app and record what it showed in this plan.
  <details><summary>Technical</summary>

  T11: in a temporary workbench (`indusk init --workbench`), `npx create-next-app@latest <repo>` inside the declared repo, `indusk update`, `pnpm add` the printed packages, `next dev`, load the page; `mcp__jaeger__get_services` lists the repo's name, and a span's process tags carry `indusk.project` and `deployment.environment=development`. Record the date, the commands and what was seen under this item.

  </details>
- [ ] Review the text this phase wrote against the extensions' writing rules, and add what the review finds here as unchecked items.
  <details><summary>Technical</summary>

  Shape step over the skills, the template header and the docs page.

  </details>

#### Build Phase 3 Verification

- [ ] The next-steps, skills, log-line, tool-call and port tests pass, and the skill copy and promise-word checks still pass.
  <details><summary>Technical</summary>

  (goes green) T6, T16, T17, T18, T19: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/app-port-4318-gone.test.ts src/__tests__/init-next-steps.test.ts src/__tests__/telemetry-skills-name-the-daemon.test.ts src/__tests__/log-line-not-signal.test.ts src/__tests__/local-telemetry-skill-tools.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/promise-words.test.ts src/__tests__/otel-docs-claims.test.ts`

  </details>
- [ ] The live check on a fresh Next.js app is recorded with what it showed.
  <details><summary>Technical</summary>

  T11: the record under the live-check task above.

  </details>

#### Build Phase 3 Context

- [ ] Record in the package's context file that what init prints is checked against the command line by test, so a new printed command must exist.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`: "Every `indusk` command and file `init` prints is checked by `init-next-steps.test.ts`."

  </details>

#### Build Phase 3 Document

- [ ] Update the otel tools page, the new-project and getting-started guides, and the demo's reference page where they describe what a project is handed.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/tools/otel.md`, `apps/docs/src/guide/new-project.md`, `apps/docs/src/guide/getting-started.md` (Docker only for `server deploy --build-from`), `apps/docs/src/reference/cli/demo.md` if it names the example's telemetry file; changelog entry.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/scaffold/{plan,render,record,apply}.ts` | new: the scaffold decision, rendering, record and writing |
| `apps/indusk-mcp/templates/telemetry-settings.ts` | new: per-app settings (address, service, project, environment, test run) |
| `apps/indusk-mcp/templates/signal.ts`, `templates/signal.py` | new: the signal helper |
| `apps/indusk-mcp/templates/instrumentation{,.next,.web}.ts`, `instrumentation.py`, `logger.ts` | read the settings; default to the daemon; resource attributes; logs to the logs port |
| `apps/indusk-mcp/src/bin/commands/init.ts` | scaffold step replaced and moved; next steps |
| `apps/indusk-mcp/src/bin/commands/update.ts` | scaffold section; code-repo `.mcp.json` |
| `apps/indusk-mcp/src/lib/new-project/create.ts` | declined telemetry writes `disabled_extensions` before init |
| `apps/indusk-mcp/src/lib/promises/vocabulary.ts`, `telemetry.ts` | app signal and resource keys; environment key moved |
| `apps/indusk-mcp/vitest.tiers.ts` | the contract test in the system tier |
| `apps/indusk-mcp/extensions/{otel,testing,local-telemetry}/skill.md`, `local-telemetry/README.md`, `local-telemetry/.env.example` | rewritten |
| `.claude/skills/{otel,testing,local-telemetry}/SKILL.md`, `.claude/settings.json`, `.indusk/extensions/local-telemetry/.env.example` | resynced / allow entry removed |
| `examples/seat-holds/src/{signal,telemetry-settings,telemetry}.ts`, `README.md` | signal through the helper; address from `indusk telemetry address` |
| `apps/indusk-mcp/src/__tests__/*` (the test files named in the trajectory), `src/lib/scaffold/plan.test.ts` | new tests |
| `apps/docs/src/reference/telemetry/{overview,signal-helper}.md`, `reference/tools/otel.md`, `guide/{promises,new-project,getting-started}.md`, `decisions/init-sets-up-telemetry.md`, `changelog.md` | docs |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `apps/indusk-mcp/src/lib/promises/CLAUDE.md` | context lines |

## Dependencies

- `daemon-found-not-guessed` (landed 2026-10-17): `daemonAddress`, `PORT_BLOCK`, `induskHome`.
- Nothing else; mark-first reads what this plan writes and comes after.

## Notes

- **The resting clause is due.** The brief's Depends On says the first promise gains `the-daemon-is-the-one-running`, resting on `the-daemon-readers-follow-is-the-one-running`, once that promise reaches the trunk; it is enforced now. Adding it edits the brief's Promises, which is an amendment a person approves; it needs no row.
- **The service and the project are two names.** In a workbench the service is the code repo's name (`homework-gate`, what the first expectation looks for) and `indusk.project` the InDusk project id (`homework_gate_workbench`, what the readers compare). A reader that compared the service to the project would drop every workbench app's signals.
- **The helper writes `broken`**, while InDusk's own writers keep the older word until mark-first (the root context's one-promise-language line says writers keep it; that line is about InDusk's own writers, and the ADR says why an owned file should not).
- **Homework Gate's existing root files** (`instrumentation.ts`, `filtering-exporter.ts`, `logger.ts` at its workbench root) are not touched by this plan; the next `update` scaffolds the code repo once it has an app, and a person deletes the root files.
- **The demo copy's service name.** The example keeps its own provider and service name; a copy made under another folder name still reports as `seat-holds`, as today.
