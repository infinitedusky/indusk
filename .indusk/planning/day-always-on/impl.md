---
title: "Day step 4b′ — Always-on"
date: 2026-09-19
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Day step 4b′ — Always-on

## Goal

A promise broken by a deployed system is kept, announced and recorded while
every developer machine is off: the shipped Jaeger as an always-on server,
one Slack message per violation, and `status` / `watch` / the admin / a
session reading that server (ADR D1–D10).

## Scope

### In Scope

- The server configuration and `indusk telemetry serve` (D1).
- The in-process interval pass, its announced record, Slack (D2, D3).
- The per-project remote source; `watch --source deployed`; the environment
  on incidents (D5, D6).
- The live Promises page and the environment on a violated row (D7, D8).
- The promise-health MCP tool; `/catchup` and "what's next" (D9).
- The container image, the Fly.io reference deployment and its
  deploy-and-break procedure (D10), the docs, and the end-to-end test.

### Out of Scope

- A hosted InDusk UI; the server writing to the repository; notification
  channels other than a Slack webhook; an application's own adoption.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every row authored at a boundary; the server test helper | day-monitor's helpers |
| Build Phase 1 | The server config + `indusk telemetry serve` | `lib/telemetry/daemon.ts`'s config rendering |
| Build Phase 2 | The interval pass, the announced record, the Slack post | Build Phase 1; `promises/telemetry` |
| Build Phase 3 | `promises.jaeger` config + the source resolver; `watch --source deployed`; the environment on incidents | Build Phase 1; `readPromiseMarks` |
| Build Phase 4 | The live Promises page; the environment on a row | Build Phase 3 through the subpaths |
| Build Phase 5 | The promise-health MCP tool; `/catchup` + "what's next" | Build Phase 3 |
| Build Phase 6 | The container image; the Fly reference deployment; the e2e test; the docs | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | A marked span sent to the server over OTLP with valid credentials is queryable afterwards | Test Phase 1 | Build Phase 1 | passing |
| A2 | The same span is still there after the server restarts | Test Phase 1 | Build Phase 1 | passing |
| A3 | OTLP sent without credentials is refused, and nothing is stored | Test Phase 1 | Build Phase 1 | passing |
| A4 | A query made without credentials is refused | Test Phase 1 | Build Phase 1 | passing |
| A5 | A violation in a deployed run produces one Slack message naming the promise, the symptom, the environment and a link to its trace | Test Phase 1 | Build Phase 2 | passing |
| A6 | The same violation seen by a later pass produces no second message | Test Phase 1 | Build Phase 2 | passing |
| A7 | A promise seen upheld produces no message | Test Phase 1 | Build Phase 2 | passing |
| A8 | A violation whose span carries no environment reads "environment unknown" rather than a guess | Test Phase 1 | Build Phase 2 | passing |
| A9 | With Slack unreachable the violation stays unannounced and the server says so; the next pass announces it | Test Phase 1 | Build Phase 2 | passing |
| A10 | In a project configured to read the server, `indusk promises status` reports the deployed run's violations, not the local daemon's | Test Phase 1 | Build Phase 3 | passing |
| A11 | With the server unreachable or the credential wrong, `status` names where it looked and exits non-zero; it never reports zero violations | Test Phase 1 | Build Phase 3 | passing |
| A12 | `indusk promises watch --source deployed` records an incident with source `deployed` and the environment, and reopens the owning plan | Test Phase 1 | Build Phase 3 | passing |
| A13 | A violation already recorded is not recorded a second time by a later `watch` | Test Phase 1 | Build Phase 3 | passing |
| A14 | A project with no remote configured still reads its local daemon, exactly as before | Test Phase 1 | Test Phase 1 | passing |
| A15 | The Promises page of a project configured to read the server shows a violated promise red, naming its environment | Test Phase 1 | Build Phase 4 | written |
| A16 | A violation arriving while the page is open turns the promise red without a reload | Test Phase 1 | Build Phase 4 | written |
| A17 | With the server unreachable, every behaviour chip is hollow with "health unknown since …", and none is green | Test Phase 1 | Build Phase 4 | written |
| A18 | Asked for promise health, an agent gets each behaviour promise's violations in the window, its open incidents, and violations not yet recorded as incidents | Test Phase 1 | Build Phase 5 | written |
| A19 | The health tool reports the same counts the CLI prints for the same project and window | Test Phase 1 | Build Phase 5 | written |
| A20 | `/catchup`'s steps name promise health, and the "what's next" answer reports open violations before the roadmap | Test Phase 1 | Build Phase 5 | written |
| A21 | End to end with no developer machine involved: an app marks a promise violated, the server announces it to Slack, a later `watch --source deployed` records the incident with its environment and reopens the owner, and the health tool names it | Build Phase 6 | Build Phase 6 | planned |

### Deferred Verification

- **The Fly.io reference deployment (U1)**
  - reason: needs a real Fly account, a real domain and a real Slack
    workspace; no test in this repository can stand in for the provider.
  - would require: a disposable Fly organisation and a throwaway Slack
    workspace in CI, with credentials this repository does not hold.
  - mitigation: a written deploy-and-break procedure in
    `reference/cli/telemetry-server.md`, run once by hand at Build Phase 6
    and its output pasted into the retrospective; every behaviour it exercises
    is covered against the local server by A1–A9.
- **Auto-stop does not lose spans (U2)**
  - reason: a provider's scheduling behaviour, not this repository's code.
  - would require: driving Fly's machine lifecycle from a test.
  - mitigation: the deployment sets an always-on machine explicitly, the
    procedure in U1 sends a span after an idle period and confirms it
    arrives, and the reference `fly.toml` carries a comment saying why
    auto-stop is off.

## Checklist

### Test Phase 1: Author every assertion at a boundary, RED

**Goal**: author every row that can be written against today's code through
the CLI, HTTP, a tool call or the server's own endpoints.

- [x] Create this plan's worktree with the published command: `indusk worktree create day-always-on` (records the assignment; the admin and plan tools follow the plan into it)
- [x] Helper `apps/indusk-mcp/src/__tests__/helpers/always-on-server.ts`: starts `indusk telemetry serve` on free ports with a temp volume and known credentials, exposes its OTLP and query URLs, stops it and can restart it in place (A2); throws when it cannot start
- [x] Helper extension: a Slack webhook capture server (accepts `POST`, exposes what it received, and a mode that refuses connections for A9) — beside `helpers/otlp-capture.ts`, which it mirrors: `helpers/slack-capture.ts`, with `refusingSlackUrl()` for A9
- [x] Author A1–A4 in `apps/indusk-mcp/src/__tests__/always-on-server.test.ts` (OTLP and query over HTTP, with and without credentials; restart between load and query)
- [x] Author A5–A9 in `apps/indusk-mcp/src/__tests__/always-on-pass.test.ts` (violations loaded into the server, the pass driven once and twice, the webhook capture read)
- [x] Author A10–A14 in `apps/indusk-mcp/src/__tests__/always-on-source.test.ts` via `runCli` against a project whose config names the server
- [x] Author A15–A17 in `apps/indusk-admin/src/__tests__/http-promise-remote.test.ts` over `next dev`, with A16 driven by Playwright as the live plan rows are
- [x] Author A18, A19 in `apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts` through `helpers/tool-call.ts`, and A20 in the same file reading the installed skill text
- [x] Run each file and read each failure: every red row fails on its own assertion, not on a missing import
  - Observed, and it is not uniform. A18–A20 fail one by one: A18 and A19 on `tool-call: no tool registered as "promise_health"` (the tool boundary refusing by name), A20 on its own `expect(...).toMatch(/promise_health/)` against the installed `/catchup` text. A14, the regression guard, passes.
  - A1–A17 fail **one boundary earlier**, in the helper's `beforeAll`: `startAlwaysOnServer` throws `the server did not answer (exit 1)` because `indusk telemetry serve` is not a command yet, and vitest then reports the rows in that file as skipped. That is a real red at a real boundary — the CLI refusing the command, not a module failing to resolve — but it is one failure for the file rather than one per row, so the rows' own assertions are unproven until Build Phase 1 starts the server. Each of those assertions is then read for the first time at its `Passes at` phase.
  - Refinement the tests drove: the pass needs an entry point a test can enter once rather than waiting on the server's interval, so Build Phase 2 gains `indusk telemetry announce --once` (A5–A9 drive it; the served loop calls the same function).
- [x] Shape (`apps/indusk-mcp/src/__tests__/helpers/always-on-server.ts`) — reviewed, left as-is: process lifecycle and the HTTP client in one factory is two jobs, but it deliberately mirrors helpers/local-jaeger.ts, which every reader of these suites already knows; splitting one of a matched pair costs more than it buys
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Deferred to Build Phase 6

- **A21** — an end-to-end run needing the server, the pass, the remote source and the health tool at once; it belongs in the `e2e` project day-monitor created, which runs outside `pnpm test`. Procedure: start the server with a capture webhook; an app-shaped process marks a promise violated with `deployment.environment=staging`; drive one pass; assert the Slack payload; run `watch --source deployed` in a scratch project configured to read the server; assert the incident (source `deployed`, environment `staging`) and the Maintenance phase; ask the health tool and assert it names the violation.

#### Regression Guards

- **A14** — a project that names no remote must keep reading its local daemon; it passes the moment it is written and guards every later phase.

#### Test Phase 1 Verification

- [x] A1–A20 authored; A14 passes; A18–A20 and A14 read one by one, A1–A17 red at the shared server boundary — the exact shape recorded under the run item above (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-` and `pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-remote.test.ts`)
- [x] The A21 deferral body reviewed: it is a written procedure rather than a fenced body, so "compiles" is not literally checkable; every step it names is reachable at Build Phase 6 (the server helper, the pass entry point, `watch --source deployed`, the incident fields, the health tool) and together they assert exactly what the row claims — an end-to-end run with no developer machine in it

#### Test Phase 1 Context

- [x] Known Gotchas (tests): the always-on server is started by `helpers/always-on-server.ts` (the real binary in its server config, credentials and a temp volume), and Slack is a capture server — never a stub of either

#### Test Phase 1 Document

- [x] Changelog Unreleased entry opened in `apps/docs/src/changelog.md` for the always-on step, filled in as phases land

### Build Phase 1: The server

- [x] `renderServerConfig` beside `renderJaegerConfig` in `lib/telemetry/`: badger storage at a given directory (`ephemeral: false`), `basicauth` on the OTLP HTTP receiver and on `jaeger_query`'s HTTP endpoint, self-metrics off — the shape verified in the research
- [x] `indusk telemetry serve` in `src/bin/commands/telemetry.ts` and `cli.ts`: reads credentials, ports, the volume path and the retention from the environment (with the config keys documented), writes the rendered config, runs Jaeger in the foreground (a container's process 1), and refuses with a named error when a required value is missing
- [x] Decide and record the badger retention setting (the research's open question): a span TTL from the environment, defaulting to a multiple of the quiet window
  - Decided: `INDUSK_SERVER_RETENTION_HOURS`, defaulting to **four quiet windows — 28 days** (`DEFAULT_RETENTION_HOURS`, with the reasoning in the constant's comment). The quiet window is what `monitor` waits out; a violation has to still be readable when a person comes to look, and they may be a week late, so one window would be exactly too short.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 1 Verification

- [x] A1, A2, A3, A4 pass (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-server.test.ts`)

#### Build Phase 1 Context

- [x] Architecture (indusk-mcp bullet): `indusk telemetry serve` runs the shipped Jaeger as an always-on server — badger on a volume, basic auth on both endpoints; the local daemon is unchanged

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/telemetry-server.md`: the command, every environment variable, and what it refuses

### Build Phase 2: The pass and Slack

- [x] The interval pass in `lib/always-on/`: query the server's own Jaeger for spans marked violated since the last pass, group by promise, and post one Slack message per violation — promise, symptom, environment (D6), service, and a trace link into the server's Jaeger UI
- [x] The announced record on the volume: trace ids already announced plus the newest violation time, pruned by the window; written **after** Slack accepts (D3), and a failure logged as unannounced
- [x] `indusk telemetry serve` runs the pass on its interval in the same process (D2); the interval and the webhook URL come from the environment, and an absent webhook is a named refusal at startup, not a silent no-op
- [x] Shape (`apps/indusk-mcp/src/lib/promises/telemetry.ts`) — reviewed, left as-is: its private Jaeger helpers became exported ones (jaegerGet, parseMarkedSpan, JaegerEndpoint) so the pass reads Jaeger through the same definition rather than growing a second one; the module is longer but there is still one reader of Jaeger in the codebase
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 2 Verification

- [x] A5, A6, A7, A8, A9 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-pass.test.ts`)

#### Build Phase 2 Context

- [x] Conventions (the promises entry): the always-on pass announces a violation once and only after Slack accepts it — a failed post leaves it unannounced for the next pass

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/telemetry-server.md`: the pass, the Slack message's shape, and the announced record

### Build Phase 3: A project names its Jaeger

- [x] `promises.jaeger: { url, credential_env }` in the config type and its schema; one resolver deciding local daemon versus named remote, read by `readPromiseMarks` (D5) — absence behaves exactly as today
- [x] `markedSpans` sends the credential from the named environment variable, and reports an unreachable or refusing remote as `JaegerUnreachable` naming the URL (never a zero)
- [x] The environment travels: `MarkedSpan` carries it from the span's `deployment.environment` resource attribute, or null; `watch` writes it on the incident, and `--source deployed` is accepted
- [x] `indusk promises status` and `watch` name the source they read (local daemon or the configured URL) in their output, so a reader never has to guess which Jaeger answered
- [x] Shape (`apps/indusk-mcp/src/lib/promises/telemetry.ts`) — reviewed, left as-is: resolveMarkSource was drafted as its own module and folded back in: source.ts had to import JaegerEndpoint, basicAuthHeaders and JaegerUnreachable from telemetry.ts while telemetry.ts imported the resolver, a cycle. Which Jaeger to read is part of reading Jaeger, and one file with no cycle beats two with one
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.

#### Build Phase 3 Verification

- [x] A10, A11, A12, A13 pass and A14 still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-source.test.ts`)

#### Build Phase 3 Context

- [x] Conventions (the promises entry): a project names its Jaeger in `promises.jaeger` (URL + the *name* of the env var holding the credential); absence means the local daemon

#### Build Phase 3 Document

- [x] `apps/docs/src/reference/cli/promises.md`: the remote source, `--source deployed`, and the environment on an incident

### Build Phase 4: The admin shows it

- [ ] The Promises page wraps `LiveRefresh` at the project's `admin.refresh_ms` (D8)
- [ ] A violated row names its environment, and the health read carries it through `lib/promise-health.ts`

#### Build Phase 4 Verification

- [ ] A15, A16, A17 pass (`pnpm --filter indusk-admin exec vitest run --project node src/__tests__/http-promise-remote.test.ts` and `--project browser` for the live row)

#### Build Phase 4 Context

- [ ] Known Gotchas (the admin entry): the Promises page is live like the plan page, and a violated row names the environment the span carried

#### Build Phase 4 Document

- [ ] `apps/docs/src/reference/admin-ui/overview.md`: the live Promises page and the environment on a violated row

### Build Phase 5: A session is told

- [ ] `promise_health` MCP tool in `src/tools/`: violations per behaviour promise in the window, open incidents, and violations not yet recorded as incidents — through `readPromiseMarks` and the registry, so it cannot disagree with the CLI (D9)
- [ ] `/catchup` (package-owned skill) gains a promise-health step, and the "what's next" instruction reports open violations before the roadmap; resync the installed copy (`skill-sync-parity`)

#### Build Phase 5 Verification

- [ ] A18, A19, A20 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-health-tool.test.ts`)

#### Build Phase 5 Context

- [ ] Conventions (the catchup entry): `/catchup` reads promise health, and an open violation outranks the roadmap when answering "what's next"

#### Build Phase 5 Document

- [ ] `apps/docs/src/reference/skills/catchup.md` and `reference/tools/indusk-mcp.md`: the health step and the tool

### Build Phase 6: The image, the deployment, end to end

- [ ] A container image: the platform's Linux `jaeger` binary plus the built CLI, entrypoint `indusk telemetry serve`, published from `docker/` with the volume mount documented
- [ ] The Fly.io reference deployment: `fly.toml` with an always-on machine (auto-stop off, and a comment saying why), a volume, and the secrets it needs; the deploy-and-break procedure written
- [ ] Run the procedure by hand once (U1, U2): deploy, send a span from outside, break a promise, confirm the Slack message and that a trace sent after an idle period arrives; paste the output into the retrospective
- [ ] Author and run `apps/indusk-mcp/e2e/day-always-on.e2e.test.ts` per the A21 procedure
- [ ] `apps/docs/src/guide/always-on.md`: what runs where when the loop leaves the laptop, and how an application adopts it; `guide/index.md`'s "What runs where" row and `guide/promises.md`'s loop diagram gain the deployed path

#### Build Phase 6 Verification

- [ ] A21 passes: `pnpm e2e` on this machine, output recorded; `pnpm test` does not run it
- [ ] Root suite and the promises check (`pnpm test`)

#### Build Phase 6 Context

- [ ] Conventions: the always-on image is built from `docker/`, entrypoint `indusk telemetry serve`; the Fly reference deployment's machine never auto-stops

#### Build Phase 6 Document

- [ ] Changelog entry completed; `guide/always-on.md` published and linked from the sidebar

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/telemetry/server-config.ts` | new — the server's rendered configuration |
| `apps/indusk-mcp/src/bin/commands/telemetry.ts`, `src/bin/cli.ts` | `serve` |
| `apps/indusk-mcp/src/lib/always-on/` | new — the pass, the announced record, the Slack post |
| `apps/indusk-mcp/src/lib/promises/telemetry.ts`, `lib/config.ts` | the source resolver, the credential, the environment on a mark |
| `apps/indusk-mcp/src/lib/promises/{watch,incidents}.ts` | `--source deployed`, the environment on an incident |
| `apps/indusk-mcp/src/tools/` | the `promise_health` tool |
| `apps/indusk-mcp/skills/catchup.md` | the promise-health step (+ installed copy) |
| `apps/indusk-admin/src/app/p/[project]/promises/page.tsx`, `src/lib/promise-health.ts`, `src/components/Promises.tsx` | live refresh, the environment |
| `docker/`, `fly.toml` | the image and the reference deployment |
| `apps/docs/src/...` | the pages named in the Document gates |

## Dependencies

- Day step 4b (`.indusk/planning/archive/day-monitor/`) — closed.
- A Slack workspace with an incoming webhook, and a Fly.io account, for
  Build Phase 6's by-hand procedure only.

## Notes

- The badger retention default is Build Phase 1's to decide and record; the
  research left it open.
- Whether one server serves several projects is out of scope: the reference
  deployment is one server for one application's environments. If a second
  project shares one, deployed marks will need `indusk.project` the way the
  evaluator's do — a follow-on, not this plan.
