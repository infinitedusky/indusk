# Init sets up telemetry — the scaffold where the app runs, named, sent to the daemon, placed

**Decided 2026-10-17.** Full ADR: `.indusk/planning/a-new-project-starts-instrumented/adr.md` · **Reference:** [what a project is handed](../reference/telemetry/overview.md#what-a-project-is-handed), [the daemon's ports](../reference/telemetry/overview.md#the-daemons-ports)

## Goal

**A project InDusk scaffolds sends named, placed spans to the local daemon on its first run, can write a promise's signal from a small file it owns, and is told the truth about how.**

`indusk init` on Homework Gate's workbench wrote `instrumentation.ts` at the workbench root, where no app runs, with the service renamed only in a comment and the code still sending a placeholder name. The Node, browser and Python templates exported to the console when no endpoint was set and the Next.js one to port 4318, which the daemon no longer holds. No span said which environment or project it came from, and an app had no way to write a signal but two hand-typed attributes.

## What was decided

| Question | Decision |
|---|---|
| Where does the scaffold go? | One module (`lib/scaffold/`) behind both `init` and `update` writes into each declared code repo, else the project root, never a workbench root, for the runtime its root files name: `next.config.*` (Next.js), `vite.config.*` (a browser app), `requirements.txt` or `pyproject.toml` (Python), `package.json` (Node). A repo with none is named as having no app yet, and `update` scaffolds it once one appears. `init` runs it after the config is written and the extensions enabled; `update` runs it every time. `--local` and the package's own repository skip it. |
| How is the service named? | In code: the code repo's name in a workbench, the project folder's otherwise, written into the settings file. No template carries a placeholder name, and no string replace edits a template. **Rejected:** the workbench's folder name (`homework-gate-workbench` is not the app; the project id goes on every span anyway). |
| How does the app find the daemon? | A settings file each app owns (`telemetry-settings.ts`; inline at the top of `instrumentation.py`), rendered with the service name, the InDusk project id and the daemon's stored traces and logs addresses, or InDusk's block when none is stored. One function from the environment to the settings: an endpoint variable wins over the rendered default. Next.js sets the endpoint variable's default before `registerOTel`. The logger sends to the logs address. **Rejected:** an environment file written from the address (Node and Python load none without a flag, Next.js reads only its own names, a browser bundle needs the value inlined at build); the standard 4318 (left to a person's other tools). |
| What does a span say about where it ran? | `indusk.project` (the InDusk project id, the key the readers compare) and `deployment.environment` (`development` unless `OTEL_RESOURCE_ATTRIBUTES` sets it), on every template's resource. |
| What happens to a file a person edited? | `.indusk/scaffold.json` records the hash of what InDusk wrote. A missing file is created; one matching its record is refreshed; one that differs from its record, or has none and differs from the rendering, is left and the rendering written beside it as `<file>.indusk-new`, with a printed line; one with no record that equals the rendering is recorded. **Rejected:** overwriting on `update`, with or without `--force` (a person's edit is lost). `init --force` keeps its meaning. |
| How does an app write a promise's signal? | A hand-written helper (`signal.ts`, `signal.py`) importing only the OpenTelemetry API, its keys pinned by a test to the package's vocabulary (Build Phase 2). **Rejected:** a helper generated at build; an InDusk runtime package in the app. |
| Is a test run told apart? | The settings mark a run under Vitest, Jest, a Vite test build or `NODE_ENV=test`, and pytest in Python, with `indusk.run=test`; a marked run still exports (Build Phase 2). |
| An app that sets up OpenTelemetry itself? | Gets only the helper, and is told so (Build Phase 2). |
| A declined telemetry recommendation? | The new-project flow writes `disabled_extensions: ["local-telemetry", "otel"]` before `init` runs, so neither is enabled and nothing is scaffolded; the reason is still recorded. |
| A workbench's code repo and MCP? | `init` and `update` give each declared code repo its own `.mcp.json`, never rewriting one that exists. |
| What does `init` print and the skills teach? | Only commands that exist, `indusk editor install` once, the local daemon rather than a vendor, a signal as a span and a log line as diagnosis (Build Phase 3). |

## Consequences accepted

- The largest change to `init.ts` since the templates landed; its output changes shape, and the scaffold step moves after the config write and the extension enable.
- One more file per app (the settings file), and a person who reads it sees the daemon's port in it.
- A record file under `.indusk/`; a workbench clone without it reads every file as unrecorded, and `update` then writes beside, never over.
- An app scaffolded before an address reset sends to the old address until `update` refreshes it or the person edits it.
- The helper's keys are duplicated as strings in two languages, held equal only by a test.
- An app with its own OpenTelemetry setup is not given the environment or project attributes; the helper's span still carries the project.
- No OTel gate for this plan: this repository's `otel.role` is `library`.
