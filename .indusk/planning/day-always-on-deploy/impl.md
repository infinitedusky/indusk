---
title: "Always-on deploy — run the server somewhere real"
date: 2026-10-04
status: approved
trajectory: required
test_phases: required
gate_policy: ask
---

# Always-on deploy — Implementation

## Goal

The always-on server stops being two written artifacts and becomes a verified
deployment. The image builds from the published package and refuses a missing
setting by name. Two servers can start on one host. A real server on Fly
(personal org) passes the guide's smoke procedure: both doors refuse without
credentials, a violation from a laptop reaches Slack, a trace survives a
restart, a violation after an idle hour is announced, a laptop reads the
server without going blind, and the heartbeat is live. The docs say what was
observed instead of "unrun". See [brief.md](brief.md) and
[test-plan.md](test-plan.md).

## Scope

### In Scope
- A1: a system-tier test that builds the image with the local docker daemon
  and runs it once per required setting left out
- A8: the server's gRPC query port set from its settings (it is unset today,
  so Jaeger binds 16685 and a second server cannot start)
- A2, A4, A6, A7: a scripted smoke (`e2e/deployed-smoke.e2e.test.ts`) that runs
  against any deployment named by environment variables and is skipped when
  none is named
- A3, A5: the steps a person confirms by reading the Slack channel, recorded
  in this impl with what was seen
- The deployment itself: `fly launch` in the personal org, the volume, the
  secrets (the password generated, with a copy in `~/.indusk/config.env`; the
  Slack webhook set by Sandy), `fly deploy`
- A9: the guide and reference record what was observed

### Out of Scope
- The promise timeline: [promise-timeline](../promise-timeline/brief.md)
- Pointing this repository's own evaluator at the server: dusk stays local.
  The smoke marks a throwaway promise from a script.
- One server per workbench: [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1, A8, A9 tests; the scripted smoke (A2, A4, A6, A7) red against no deployment | the published 1.58.0 package, the local docker daemon, `startAlwaysOnServer` |
| Build Phase 1 | the gRPC port setting; the image test green | `renderServerConfig`, `readServerSettings` |
| Build Phase 2 | a deployment on Fly; the smoke green; A3 seen | the image, `docker/fly.always-on.toml`, a Fly login, a Slack webhook |
| Build Phase 3 | A5 after an idle hour; the docs as observed | the deployment left alone |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | The image builds from the published package, and a container started without one of its settings exits naming the missing variable | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/always-on-image.test.ts |
| A2 | On the deployed server, both doors refuse a request without credentials (401) and accept one with them | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A3 | A promise broken from a machine that is not the server reaches Slack within one pass interval, naming the promise, the symptom, the environment, the service and a trace link | Build Phase 2 | Build Phase 2 | planned | manual: read the Slack channel after the smoke's send |
| A4 | A trace sent before a machine restart is still there after it | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A5 | A violation sent after the server has sat idle for an hour is announced — the machine never went to sleep | Build Phase 3 | Build Phase 3 | planned | manual: send after an idle hour, read the Slack channel |
| A6 | A developer machine whose project names the deployed server reads it: `promises status` reports the smoke's violations and names the server, and the read is not *watcher blind* | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A7 | The deployed server is listening by its own account: its Jaeger holds a heartbeat less than two pass intervals old, and Slack has had no "watcher blind" message since the deploy | Test Phase 1 | Build Phase 2 | planned | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A8 | Two always-on servers can run on one host at once | Test Phase 1 | Build Phase 1 | planned | apps/indusk-mcp/src/__tests__/always-on-two-servers.test.ts |
| A9 | The guide and reference no longer call the image or the Fly configuration unrun, and say what was observed | Test Phase 1 | Build Phase 3 | planned | apps/indusk-mcp/src/__tests__/always-on-docs-observed.test.ts |

## Checklist

### Test Phase 1: author every assertion that a test can reach

**Goal**: author A1, A2, A4, A6, A7, A8 and A9 now. Every one reaches its
subject over a boundary: the docker daemon, a spawned server, HTTP to a
deployment that does not exist yet, the docs files. A3 and A5 are a person
reading Slack, so they are registered below, not authored.

- [ ] Create/confirm this plan's worktree (`indusk worktree create day-always-on-deploy`, which records the assignment) — worktree-per-plan default
- [ ] Author A1 in `apps/indusk-mcp/src/__tests__/always-on-image.test.ts`, added to `SYSTEM` and `RUN_ALONE` in `vitest.tiers.ts`. Build `docker/Dockerfile.always-on` with `--build-arg VERSION=1.58.0` once (skipped with a reason when `docker info` fails), then for each required setting (`INDUSK_SERVER_VOLUME`, `…_OTLP_PORT`, `…_QUERY_PORT`, `…_USER`, `…_PASSWORD`, `…_SLACK_WEBHOOK`) run the image with every other one set and expect a non-zero exit whose output names the missing variable
- [ ] Author A8 in `apps/indusk-mcp/src/__tests__/always-on-two-servers.test.ts`, added to `SYSTEM` and `RUN_ALONE`: start two servers with `startAlwaysOnServer` at the same time; both answer an authenticated `/api/services`
- [ ] Author A9 in `apps/indusk-mcp/src/__tests__/always-on-docs-observed.test.ts` (everyday tier): `guide/always-on.md` and `reference/cli/telemetry-server.md` contain no "unrun" or "nobody has run it", and the guide's smoke section carries an "Observed" record with a date
- [ ] Author A2, A4, A6 and A7 in `apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts`, reading `INDUSK_DEPLOYED_OTLP_URL`, `INDUSK_DEPLOYED_QUERY_URL`, `INDUSK_DEPLOYED_CREDENTIAL` (and `INDUSK_DEPLOYED_FLY_APP` for A4's restart), skipped by name when they are unset. A2: both doors 401 without credentials, 2xx with them. A4: send a marked span, `fly machine restart` the app's one machine, wait for it to answer, find the trace. A6: a throwaway project naming the server in `promises.jaeger` (`url`, `otlp_url`, `credential_env`) with one behaviour promise; send a violation marked `deployment.environment=smoke`; `promises status` exits 0, names the query URL, counts the violation, and does not say *watcher blind*. A7: the newest `watcher.heartbeat` span is younger than two minutes
- [ ] Run each and read each failure: A1 (passes today, or not: record which), A8 red on the second server's start, A9 red on "unrun", and the smoke red against the planned hostname, which resolves to nothing yet. A red that is a load error is not authored

#### Deferred to Build Phase 2

- **A3** — reason: its subject is a person reading a Slack channel after a real send to a real deployment; would require: the deployment and the webhook, which exist only from Build Phase 2; mitigation: the smoke's A6 step sends the violation A3 reads, and this impl records the message as seen, quoted

#### Deferred to Build Phase 3

- **A5** — reason: it cannot pass in under an hour of the server sitting idle, by design; would require: a deployment left alone for an hour; mitigation: Build Phase 3 is that hour; the second send is the smoke's own send, and the message seen is recorded here, quoted

#### Test Phase 1 Verification

- [ ] A8, A9 and the smoke fail on their own assertions and A1's result is recorded (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image src/__tests__/always-on-two-servers`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-docs-observed`; `INDUSK_DEPLOYED_QUERY_URL=https://indusk-always-on.fly.dev:16687 INDUSK_DEPLOYED_OTLP_URL=https://indusk-always-on.fly.dev INDUSK_DEPLOYED_CREDENTIAL=indusk:x pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.e2e.config.ts e2e/deployed-smoke`); the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js`)

### Build Phase 1: the gRPC port, and the image

- [ ] `lib/telemetry/server.ts`: `INDUSK_SERVER_GRPC_PORT` in `ServerSettings` (default 16685, so a deployed server is unchanged), rendered as `jaeger_query.grpc.endpoint`; `startAlwaysOnServer` gives each server a free one
- [ ] If A1 was red, fix what it named in `docker/Dockerfile.always-on`, and record it here

#### Build Phase 1 Verification

- [ ] A1 and A8 pass, and the always-on suites still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image src/__tests__/always-on-two-servers src/__tests__/always-on-server src/__tests__/always-on-falsification src/__tests__/always-on-pass src/__tests__/always-on-source src/__tests__/watcher-heartbeat-server`)
- [ ] `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` clean; Biome clean on the changed files

#### Build Phase 1 Context

- [ ] guard: `always-on-two-servers.test.ts` carries `lesson: a-port-left-to-its-default-is-a-port-two-instances-share` — a server whose ports are not all set from its settings cannot run twice on one host

#### Build Phase 1 Document

- [ ] `apps/docs/src/reference/cli/telemetry-server.md`, the environment table: `INDUSK_SERVER_GRPC_PORT`; `apps/docs/src/changelog.md` Unreleased, Fixed: two servers on one host

### Build Phase 2: deploy, and run the smoke

- [ ] `fly launch --no-deploy --copy-config --config docker/fly.always-on.toml --org personal` (app name `indusk-always-on`, or the nearest free one, recorded here); `fly volumes create indusk_telemetry --size 3`
- [ ] Generate the password (`openssl rand -hex 24`), `fly secrets set INDUSK_SERVER_PASSWORD=…`, and write `INDUSK_DEPLOYED_CREDENTIAL=indusk:<password>` to `~/.indusk/config.env`; the value never enters the repository or the conversation
- [ ] Sandy sets `INDUSK_SERVER_SLACK_WEBHOOK` as a Fly secret (`fly secrets set … --config docker/fly.always-on.toml`)
- [ ] `fly deploy --config docker/fly.always-on.toml` (Fly's remote builder; the image installs 1.58.0); record the URLs, the machine id and anything the configuration got wrong
- [ ] Run the scripted smoke against the deployment (A2, A4, A6, A7) and record its output here
- [ ] A3: after the smoke's A6 send, confirm the Slack message names the promise, the symptom, `smoke`, the service and a trace link; quote it here

#### Build Phase 2 Verification

- [ ] A2, A4, A6, A7 pass (`set -a; . ~/.indusk/config.env; set +a; INDUSK_DEPLOYED_QUERY_URL=… INDUSK_DEPLOYED_OTLP_URL=… INDUSK_DEPLOYED_FLY_APP=… pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.e2e.config.ts e2e/deployed-smoke`), and A3 is quoted above
- [ ] `fly status --config docker/fly.always-on.toml` shows one machine, started, with auto-stop off

#### Build Phase 2 Context

- [ ] current.md: the deployed server's URLs, its app name and the credential variable's name, in the shared region, so the next session knows it exists

#### Build Phase 2 Document

- [ ] `apps/docs/src/guide/always-on.md`: anything the deploy found that the written procedure or `fly.always-on.toml` got wrong, corrected where it is written

### Build Phase 3: an idle hour, and the docs as observed

- [ ] A5: leave the server untouched for at least an hour (no sends, no queries); then run the smoke's send once and confirm the Slack message arrives; quote it and the idle window here
- [ ] Record the smoke as observed in the guide's "Smoke-testing a deployment" (date, provider, what each step showed) and remove every "unrun" / "nobody has run it" marking from the guide and the reference

#### Build Phase 3 Verification

- [ ] A9 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-docs-observed`) and A5 is quoted above
- [ ] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear

#### Build Phase 3 Context

- [ ] current.md: the "image and Fly reference are unrun" note in the shared region's day-always-on line is replaced by the date they were verified

#### Build Phase 3 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: the always-on image and Fly reference verified against a real deployment, with what changed

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/telemetry/server.ts` | `INDUSK_SERVER_GRPC_PORT` |
| `apps/indusk-mcp/src/__tests__/helpers/always-on-server.ts` | a free gRPC port per server |
| `apps/indusk-mcp/src/__tests__/always-on-image.test.ts`, `always-on-two-servers.test.ts`, `always-on-docs-observed.test.ts` | new — A1, A8, A9 |
| `apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts` | new — A2, A4, A6, A7 |
| `apps/indusk-mcp/vitest.tiers.ts` | the system files |
| `docker/Dockerfile.always-on`, `docker/fly.always-on.toml` | only what the deploy shows wrong |
| `apps/docs/src/guide/always-on.md`, `apps/docs/src/reference/cli/telemetry-server.md`, `apps/docs/src/changelog.md` | observed, not unrun |

## Notes

- **The deployment costs money while it runs.** One shared-cpu-1x machine with
  1 GB and a 3 GB volume, always on, by design. If the plan's outcome is to stop
  it, `fly scale count 0` keeps the volume; `fly apps destroy` does not.
- **The smoke is re-runnable.** The e2e file reads its target from the
  environment, so the next deployment (a workbench's own server) runs the same
  checks.
