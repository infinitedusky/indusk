---
title: "Always-on deploy — run the server somewhere real"
date: 2026-10-04
status: in-progress
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
| A1 | The image builds from the published package, and a container started without one of its settings exits naming the missing variable | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/always-on-image.test.ts |
| A2 | On the deployed server, both doors refuse a request without credentials (401) and accept one with them | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A3 | A promise broken from a machine that is not the server reaches Slack within one pass interval, naming the promise, the symptom, the environment, the service and a trace link | Build Phase 2 | Build Phase 2 | passing | manual: read the Slack channel after the smoke's send |
| A4 | A trace sent before a machine restart is still there after it | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A5 | A violation sent after the server has sat idle for an hour is announced — the machine never went to sleep | Build Phase 3 | Build Phase 3 | planned | manual: send after an idle hour, read the Slack channel |
| A6 | A developer machine whose project names the deployed server reads it: `promises status` reports the smoke's violations and names the server, and the read is not *watcher blind* | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A7 | The deployed server is listening by its own account: its Jaeger holds a heartbeat less than two pass intervals old, and Slack has had no "watcher blind" message since the deploy | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A8 | Two always-on servers can run on one host at once | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/always-on-two-servers.test.ts |
| A10 | The server's records survive a machine restart: after it, the announced record and the watcher state both still parse, so the server keeps announcing | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A11 | The trace link in a Slack announcement opens the trace from wherever the reader is: it uses the public query address when one is set, and never the server's own loopback address | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/always-on-public-link.test.ts |
| A12 | A person opening a trace link in a browser is asked to log in (401 with a Basic challenge) and, logged in, sees the trace | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/always-on-browser-login.test.ts |
| A9 | The guide and reference no longer call the image or the Fly configuration unrun, and say what was observed | Test Phase 1 | Build Phase 3 | written | apps/indusk-mcp/src/__tests__/always-on-docs-observed.test.ts |

## Checklist

### Test Phase 1: author every assertion that a test can reach

**Goal**: author A1, A2, A4, A6, A7, A8 and A9 now. Every one reaches its
subject over a boundary: the docker daemon, a spawned server, HTTP to a
deployment that does not exist yet, the docs files. A3 and A5 are a person
reading Slack, so they are registered below, not authored.

- [x] Create/confirm this plan's worktree (`indusk worktree create day-always-on-deploy`, which records the assignment) — worktree-per-plan default
- [x] Author A1 in `apps/indusk-mcp/src/__tests__/always-on-image.test.ts`, added to `SYSTEM` and `RUN_ALONE` in `vitest.tiers.ts`. Build `docker/Dockerfile.always-on` with `--build-arg VERSION=1.58.0` once (skipped with a reason when `docker info` fails), then for each required setting (`INDUSK_SERVER_VOLUME`, `…_OTLP_PORT`, `…_QUERY_PORT`, `…_USER`, `…_PASSWORD`, `…_SLACK_WEBHOOK`) run the image with every other one set and expect a non-zero exit whose output names the missing variable
- [x] Author A8 in `apps/indusk-mcp/src/__tests__/always-on-two-servers.test.ts`, added to `SYSTEM` and `RUN_ALONE`: start two servers with `startAlwaysOnServer` at the same time; both answer an authenticated `/api/services`
- [x] Author A9 in `apps/indusk-mcp/src/__tests__/always-on-docs-observed.test.ts` (everyday tier): `guide/always-on.md` and `reference/cli/telemetry-server.md` contain no "unrun" or "nobody has run it", and the guide's smoke section carries an "Observed" record with a date
- [x] Author A2, A4, A6 and A7 in `apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts`, reading `INDUSK_DEPLOYED_OTLP_URL`, `INDUSK_DEPLOYED_QUERY_URL`, `INDUSK_DEPLOYED_CREDENTIAL` (and `INDUSK_DEPLOYED_FLY_APP` for A4's restart), skipped by name when they are unset. A2: both doors 401 without credentials, 2xx with them. A4: send a marked span, `fly machine restart` the app's one machine, wait for it to answer, find the trace. A6: a throwaway project naming the server in `promises.jaeger` (`url`, `otlp_url`, `credential_env`) with one behaviour promise; send a violation marked `deployment.environment=smoke`; `promises status` exits 0, names the query URL, counts the violation, and does not say *watcher blind*. A7: the newest `watcher.heartbeat` span is younger than two minutes
- [x] Run each and read each failure: A1 (passes today, or not: record which), A8 red on the second server's start, A9 red on "unrun", and the smoke red against the planned hostname, which resolves to nothing yet. A red that is a load error is not authored — read 2026-10-04:
  - **A1 passed when written**, 7/7. The image builds from 1.58.0 on this machine's docker daemon, and each of the six required settings, left out, stops the container with its name in the output. This is the first time the image has been built anywhere.
  - A8 is red on its own assertion: the second server "did not answer … (exit 1)".
  - A9 is red on the guide's "unrun" and on the missing "Observed" record. The reference has no such marking today.
  - A2, A4, A6 and A7 are red on `ENOTFOUND indusk-always-on.fly.dev`, the deployment that does not exist yet: a real red at the boundary.
  - Leak guard clear.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (Four test files. The smoke's helpers — `auth`, `send`, `traceFound`, `eventually` — each do one thing over the boundary, and the target comes from four named environment variables documented in its header.)

#### Deferred to Build Phase 2

- **A3** — reason: its subject is a person reading a Slack channel after a real send to a real deployment; would require: the deployment and the webhook, which exist only from Build Phase 2; mitigation: the smoke's A6 step sends the violation A3 reads, and this impl records the message as seen, quoted

#### Deferred to Build Phase 3

- **A5** — reason: it cannot pass in under an hour of the server sitting idle, by design; would require: a deployment left alone for an hour; mitigation: Build Phase 3 is that hour; the second send is the smoke's own send, and the message seen is recorded here, quoted

#### Test Phase 1 Verification

- [x] A8, A9 and the smoke fail on their own assertions and A1's result is recorded (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image src/__tests__/always-on-two-servers`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-docs-observed`; `INDUSK_DEPLOYED_QUERY_URL=https://indusk-always-on.fly.dev:16687 INDUSK_DEPLOYED_OTLP_URL=https://indusk-always-on.fly.dev INDUSK_DEPLOYED_CREDENTIAL=indusk:x pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.e2e.config.ts e2e/deployed-smoke`); the leak guard is clear afterwards (`node apps/indusk-mcp/scripts/check-test-daemons.js`)

### Build Phase 1: the gRPC port, and the image

- [x] `lib/telemetry/server.ts`: `INDUSK_SERVER_GRPC_PORT` in `ServerSettings` (default 16685, so a deployed server is unchanged), rendered as `jaeger_query.grpc.endpoint`; `startAlwaysOnServer` gives each server a free one — bound to **127.0.0.1**, not 0.0.0.0. Found while doing this: left unset, Jaeger served its gRPC query API on every interface **without basic auth**. Fly exposes only the two declared services, so the reference deployment never leaked through it, but a server on a VPS with an open 16685 would have handed its traces to anyone. Loopback closes that, and nothing outside the container needs gRPC. A8's cleanup stops both servers in parallel (30 s), since sequential stops overran the 10 s hook default
- [x] If A1 was red, fix what it named in `docker/Dockerfile.always-on`, and record it here — A1 was never red (7/7 on first build), so the Dockerfile is unchanged

#### Build Phase 1 Verification

- [x] A1 and A8 pass, and the always-on suites still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-image src/__tests__/always-on-two-servers src/__tests__/always-on-server src/__tests__/always-on-falsification src/__tests__/always-on-pass src/__tests__/always-on-source src/__tests__/watcher-heartbeat-server`) — 7 files, 34 tests; leak guard clear
- [x] `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` clean; Biome clean on the changed files
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (The gRPC setting follows the other ports' `port()` reader with a default; its docblock carries the why.)

#### Build Phase 1 Context

- [x] guard: `always-on-two-servers.test.ts` carries `lesson: a-port-left-to-its-default-is-a-port-two-instances-share` — a server whose ports are not all set from its settings cannot run twice on one host

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/telemetry-server.md`, the environment table: `INDUSK_SERVER_GRPC_PORT`; `apps/docs/src/changelog.md` Unreleased, Fixed: two servers on one host — the changelog entry also names the unauthenticated listener the default left open; `vitepress build` clean

### Build Phase 2: deploy, and run the smoke

- [x] Discovered: the gRPC fix shipped first, as **1.58.1** (released 2026-10-04 on Sandy's call), so the deployed server never runs a version whose unauthenticated gRPC query API listens on every interface. The personal org's other apps share Fly's private network. It was released from a `release/1.58.1` branch with `SKIP_RELEASE_GUARD=1`; the guard objected only to this branch's new test files, and main was merged back in (`2340de6d`)
- [x] Discovered: `pnpm release`'s system tier had doubled to 231 s (Sandy noticed), mostly from these two plans' timed files run one at a time. Two fixes:
  - `always-on-server`, `always-on-falsification`, `always-on-two-servers` and `watcher-falsification` rejoin the parallel group, since they were alone only because of the 16685 clash A8 fixed.
  - watcher-falsification's A12 beats every 250 ms for 16 s instead of every second for 70 s, and now also asserts that more than 50 beats landed.
  
  The tier now takes 132 s for 29 files and 110 tests (`pnpm test:system`, wall 146 s including the admin build).
- [x] `fly launch --no-deploy --copy-config --config docker/fly.always-on.toml --org personal` (app name `indusk-always-on`, or the nearest free one, recorded here); `fly volumes create indusk_telemetry --size 3` — app **`indusk-always-on`** in the personal org (`alexander-corsillo`), `indusk-always-on.fly.dev`; volume `indusk_telemetry`, 3 GB, encrypted, `iad`. **Observed, and wrong in the written config:**
  - `fly launch --copy-config` rewrote `docker/fly.always-on.toml` and deleted every comment, including the one explaining why the machine must never auto-stop. The file is restored, and its header now says `fly apps create`.
  - Fly's current schema spells auto-stop `auto_stop_machines = "off"`, not `false`. The launch rewrote it that way, and the restored file now uses `"off"` in both services.
  - `fly config validate` passes.
- [x] Generate the password (`openssl rand -hex 24`), `fly secrets set INDUSK_SERVER_PASSWORD=…`, and write `INDUSK_DEPLOYED_CREDENTIAL=indusk:<password>` to `~/.indusk/config.env`; the value never enters the repository or the conversation — staged with `--stage` (no machine exists yet; the deploy applies it); `config.env` is mode 600; the value was never printed
- [x] Sandy sets `INDUSK_SERVER_SLACK_WEBHOOK` as a Fly secret (`fly secrets set … --config docker/fly.always-on.toml`)
- [x] `fly deploy --config docker/fly.always-on.toml` (Fly's remote builder; the image installs 1.58.0); record the URLs, the machine id and anything the configuration got wrong — `fly deploy -c docker/fly.always-on.toml --build-arg VERSION=1.58.1 --ha=false --remote-only`. The image is 487 MB and machine `815601f9d4ee58` started cleanly. Intake: `https://indusk-always-on.fly.dev` (443). Query API: `https://indusk-always-on.fly.dev:16687`. **Observed, and missing from the written procedure:**
  - Fly allocates **no public IP** on a first deploy, so the server was unreachable. IPv6 is free (`2a09:8280:1::1a7:2681:0`), but this laptop's network has none.
  - Fly's shared IPv4 routes only 80/443, so the query port 16687 needs a **dedicated IPv4**. `188.93.145.200` was allocated at $2/month, on Sandy's call.
  - Both doors then answered 401 without credentials.
  - `--ha=false` keeps it to one machine. Fly's default is two, which the config's single-writer badger volume forbids.
- [x] Run the scripted smoke against the deployment (A2, A4, A6, A7) and record its output here — 4/4 on 2026-10-04 17:41 UTC:
  - A2: both doors 401 without credentials, accepted with them.
  - A4: the trace was found again after `fly machine restart`.
  - A6: `promises status` from a scratch project named the server, counted the violation, and did not read blind.
  - A7: a heartbeat under two minutes old.
- [x] Discovered — **the deploy found a server bug.** After A4's restart, every pass logged `announced nothing — /data/announced.json is not valid JSON: Unexpected end of JSON input`. Over `fly ssh`, the file was 0 bytes, last written at 17:40:37.98 by the first pass, and the machine restarted at 17:41:09 on an ext4 volume.
  - The cause: write-then-rename without `fsync`. The rename reached the disk and the data did not. The code's comment called the rename safe, which holds for a dying process, not a stopped machine.
  - The effect: the server refused, as designed, and stayed silent from then on, while its heartbeat said listening. A3's violation was never announced.
  - The fix: `writeFileDurably` (`lib/always-on/durable-write.ts`) writes the temp file, `fsync`s it, renames, then `fsync`s the directory. Both `announced.json` and `watcher-state.json` now use it. The always-on suites pass, 31/31.
  - The guard: new row **A10** in the smoke reads both records over `fly ssh` after the restart, and it is red against today's deployment.
- [x] Release **1.58.2** with the durable writes (Sandy runs `pnpm release`; npm needs a valid login first), then redeploy with `VERSION=1.58.2` — released from a `release/1.58.2` branch off main with only the fix (main `e01fa38f`, merged back as `20c0dc3f`). Redeployed; `indusk --version` on the machine reads 1.58.2
- [x] Repair the deployed record: remove the empty `/data/announced.json` over `fly ssh`. Absent reads as an empty record, so the next pass re-announces the 24 h window, which holds only the smoke's own violations. The repair is the documented answer to `announced nothing — … not valid JSON`, written into the reference — the file was still 0 bytes on 1.58.2 (the fix prevents the damage, it does not undo it). Removed at 22:43:59; the next pass logged `announced 1, held 0, unannounced 0, already announced 0`. The reference text is the Document item below
- [x] Re-run the smoke on 1.58.2 (A2, A4, A6, A7, A10): A10 must pass after A4's restart — **5/5** at 22:45 UTC. The first pass after the restart logged `announced 1, … already announced 1`: the record survived the restart, so it posted only the smoke's new violation
- [x] Discovered — **the trace link in Slack was unusable.** Sandy pasted both messages (6:44 and 6:46 PM). Promise, symptom, `smoke` and service were all right, but the link read `http://127.0.0.1:16686/trace/3444d16745367297cd645729b2a741d0`. That is the address the server's own pass uses for its own Jaeger, and it opens nothing from anyone's Slack. No test asserted the link.
  - The fix: `INDUSK_SERVER_PUBLIC_QUERY_URL` (optional) supplies the link. Without it, the message names the trace and asks for the setting, instead of offering a loopback link. The heartbeat's blind message names the same public address. `announce --once` links to the address it was given.
  - `fly.always-on.toml` sets `https://indusk-always-on.fly.dev:16687`.
  - Guarded by new row A11, red then green locally, 33/33 with the announcement suites. It needs a release (**1.58.3**) and a redeploy
- [x] Release **1.58.3** with the public link (Sandy runs `SKIP_RELEASE_GUARD=1 pnpm release`), redeploy with `VERSION=1.58.3`, and re-run the smoke so a fresh violation is announced — 1.58.3 deployed. The smoke passed 5/5 and the server announced at 23:13:14 (`already announced 2`, so the record also survived the redeploy). Sandy confirmed the link reads `https://indusk-always-on.fly.dev:16687/trace/66be9891a23e56f85cf62d8701fd26fa`
- [x] Discovered — **the link opened to "no basic auth provided" with no login box.** Jaeger's basic auth (the collector's `basicauth` extension) refuses with a bare 401 and no `WWW-Authenticate` challenge, confirmed with `curl -D -` against the deployment. Programs never notice; a browser is never asked to log in.
  - On Sandy's call, a front door: `telemetry serve` answers the public query port itself (`lib/telemetry/query-door.ts`) and passes every request to Jaeger, now on a free loopback port. When Jaeger answers 401, the door adds `WWW-Authenticate: Basic`.
  - Jaeger stays the only thing that checks a password.
  - Guarded by new row A12, red then green. The server suites pass, 32/32
- [x] Release **1.58.4** with the query door (Sandy runs `SKIP_RELEASE_GUARD=1 pnpm release`), redeploy with `VERSION=1.58.4`, re-run the smoke — released (main `f008e852`, merged back), deployed. `curl -D -` against the live query port shows `401` with `www-authenticate: Basic realm="indusk always-on", charset="UTF-8"`. The smoke passed 5/5, and the server announced at 23:40:45 UTC (`already announced 3`)
- [x] A3: after the smoke's A6 send, confirm the Slack message names the promise, the symptom, `smoke`, the service and a trace link; quote it here — as Sandy pasted it from the channel (the 6:46 PM message, on 1.58.2):
  ```
  Promise violated: smoke-promise-reaches-the-server
  sent by the deploy smoke
  smoke · smoke-app · smoke-check
  http://127.0.0.1:16686/trace/717860a7731fff5272ca576f36a8226e
  ```
  - The content was right from the first deploy. The link was not, and it took two fixes: a public address (1.58.3, A11) and a login challenge (1.58.4, A12).
  - On 1.58.3 Sandy confirmed the link reads `https://indusk-always-on.fly.dev:16687/trace/66be9891a23e56f85cf62d8701fd26fa`.
  - On 1.58.4 Sandy clicked the 7:40 PM message's link, logged in when asked, and the trace opened in the Jaeger UI: "that worked".

#### Build Phase 2 Verification

- [x] A2, A4, A6, A7 pass (`set -a; . ~/.indusk/config.env; set +a; INDUSK_DEPLOYED_QUERY_URL=… INDUSK_DEPLOYED_OTLP_URL=… INDUSK_DEPLOYED_FLY_APP=… pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.e2e.config.ts e2e/deployed-smoke`), and A3 is quoted above
  - The smoke passed 5/5 on 1.58.4 (A2, A4, A6, A7, A10). A11 and A12 are green locally, and A12 was confirmed live by `curl` and by Sandy's login.
  - A7's Slack half: `/data/watcher-state.json` reads `listening since 17:42:10`. That is the first pass after the first deploy, and it never changed through four deploys and three restarts, so the server never told Slack it was blind.
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change. (`durable-write.ts` and `query-door.ts` are one job each with their why in the docblock; the pass, heartbeat, schedule and `serve` changes thread one value each — the public URL, the loopback port.)
- [x] `fly status --config docker/fly.always-on.toml` shows one machine, started, with auto-stop off — one machine, `815601f9d4ee58`, `started`; `fly machine list --json` shows `autostop: false` on both services

#### Build Phase 2 Context

- [x] current.md: the deployed server's URLs, its app name and the credential variable's name, in the shared region, so the next session knows it exists — with how to re-run the smoke and what it costs while it runs

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
