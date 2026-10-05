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
| A5 | A violation sent after the server has sat idle for an hour is announced — the machine never went to sleep | Build Phase 3 | Build Phase 3 | passing | manual: send after an idle hour, read the Slack channel |
| A6 | A developer machine whose project names the deployed server reads it: `promises status` reports the smoke's violations and names the server, and the read is not *watcher blind* | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A7 | The deployed server is listening by its own account: its Jaeger holds a heartbeat less than two pass intervals old, and Slack has had no "watcher blind" message since the deploy | Test Phase 1 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A8 | Two always-on servers can run on one host at once | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/always-on-two-servers.test.ts |
| A10 | The server's records survive a machine restart: after it, the announced record and the watcher state both still parse, so the server keeps announcing | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/e2e/deployed-smoke.e2e.test.ts |
| A11 | The trace link in a Slack announcement opens the trace from wherever the reader is: it uses the public query address when one is set, and never the server's own loopback address | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/always-on-public-link.test.ts |
| A12 | A person opening a trace link in a browser is asked to log in (401 with a Basic challenge) and, logged in, sees the trace | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/always-on-browser-login.test.ts |
| A9 | The guide and reference no longer call the image or the Fly configuration unrun, and say what was observed | Test Phase 1 | Build Phase 3 | passing | apps/indusk-mcp/src/__tests__/always-on-docs-observed.test.ts |
| A13 | A server whose public query port is already taken exits non-zero naming the port, and leaves no Jaeger running behind it (its intake port is free again) | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/always-on-door-startup.test.ts |
| A14 | The query door ties its two connections together: Jaeger dropping mid-response ends the client's response with an error instead of leaving it open, and a client leaving mid-response closes the request to Jaeger | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/query-door.test.ts |
| A15 | A public query URL that is not an absolute http(s) URL, or that carries a user or password, is refused by name at start — never posted to Slack as a link or as a credential | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/always-on-public-url.test.ts |
| A16 | A record write the disk cuts short never replaces the record with a truncated one, and a failed write leaves no temp file behind | Build Phase 4 | Build Phase 4 | passing | apps/indusk-mcp/src/__tests__/durable-write.test.ts |

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

- [x] `apps/docs/src/guide/always-on.md`: anything the deploy found that the written procedure or `fly.always-on.toml` got wrong, corrected where it is written — a new "On Fly" section with the steps as run: `fly apps create` (not `launch`), `--ha=false`, the IP allocation including the dedicated IPv4, the public query URL, and the login the trace link asks for. The reference gains `INDUSK_SERVER_PUBLIC_QUERY_URL`, "The query door", and "When it announces nothing" (the repair). `vitepress build` clean. The guide's "not yet run" warning comes off in Build Phase 3 with the observed record

### Build Phase 3: an idle hour, and the docs as observed

- [x] A5: leave the server untouched for at least an hour (no sends, no queries); then run the smoke's send once and confirm the Slack message arrives; quote it and the idle window here
  - **Idle window:** the last call to the machine was at about 23:42 UTC, and the next was at 00:43:42.
  - **Heartbeats in it:** 63, from 23:41:45 to 00:43:46, every one exactly 60.0 s apart, with no gap over 150 s. The pass ran every minute with no outside traffic, so the machine never slept.
  - **The send:** at 00:43:54 (the smoke's A6 step). The server logged `announced 1, … already announced 4` at 00:44:47.
  - **Slack:** Sandy confirmed the 8:44 PM message, `Promise violated: smoke-promise-reaches-the-server`, in the channel ("it does have that"). Auto-stop is genuinely off.
- [x] Record the smoke as observed in the guide's "Smoke-testing a deployment" (date, provider, what each step showed) and remove every "unrun" / "nobody has run it" marking from the guide and the reference — the guide's warning box is now a "Verified on Fly, 2026-10-04" tip. The smoke section names the scripted steps and gains "Observed, 2026-10-04": each step, the three bugs and their releases, the idle hour, and the five things the written configuration got wrong. The reference had no such marking

#### Build Phase 3 Verification

- [x] A9 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/always-on-docs-observed`) and A5 is quoted above — 3/3
- [x] `pnpm test` and `pnpm test:system` green, each ending with the leak guard's all-clear — `pnpm test`: mcp 1,680 / 5 skipped, admin 346, `promises check` clean, all-clear. `pnpm test:system`: 31 files, 115 tests, 130 s, all-clear
- [x] Shape — skipped with its reason: this phase changed no code files (the guide's observed record and the impl only)

#### Build Phase 3 Context

- [x] current.md: the "image and Fly reference are unrun" note in the shared region's day-always-on line is replaced by the date they were verified

#### Build Phase 3 Document

- [x] `apps/docs/src/changelog.md` Unreleased: the always-on image and Fly reference verified against a real deployment, with what changed — under Changed, beside the system tier's recovered time

### Build Phase 4: Falsification — the server's start, its query door, its public link and its records

**Goal**: verify whether the attested state holds against four failure modes
in the code this plan added to the server: the door's start order, the door's
connection handling, an unchecked public URL, and a short write. Each
trajectory row captures one hypothesis, each named with the input that should
break it; each checklist item is the fix if it confirms.

Found while investigating (2026-10-04), before any row was written:

- **A13** — reproduced by hand. `telemetry serve` with its query port held by
  another process exited 1 on `EADDRINUSE`, and its Jaeger kept running,
  holding the OTLP port and badger's lock. `serve()` spawns Jaeger before the
  door binds, and nothing kills the child when the bind fails. A supervisor
  that does not kill the process group (a plain restart loop, pm2) then
  restarts into a held port and a locked volume, forever.
- **A14** — reproduced against a stub upstream. Jaeger dropping its socket
  mid-response left the client waiting past 5 s with the response never ended;
  `answer` has no error handler and `pipe` does not forward one. A browser
  holding that response also keeps the door's `close()` from finishing, so a
  dead Jaeger need not end the process.
- **A15** — by reading: `INDUSK_SERVER_PUBLIC_QUERY_URL` is only trimmed of
  slashes. `https://indusk:<pw>@<app>.fly.dev:16687` posts the password into
  every Slack message; `<app>.fly.dev:16687` posts a link Slack cannot open.
- **A16** — by reading: `writeFileDurably` calls `writeSync` once and ignores
  its count. On a nearly full volume `write(2)` returns short, and the
  truncated temp file is fsynced and renamed over the good record: the
  original 1.58.2 failure (a record that does not parse, so every pass refuses
  to announce), from a full disk instead of a restart. A write that throws
  leaves its temp file.

- [x] `serve()` binds the query door before spawning Jaeger, so a taken public port refuses before anything is started; and any exit path closes the door with `closeAllConnections()`
- [x] `startQueryDoor`: an upstream response that errors or aborts destroys the client's response; a client response closed early destroys the upstream request
- [x] `readServerSettings`: the public query URL must parse as an absolute `http:`/`https:` URL with no user, password, query or fragment, or it is refused as a `MissingServerSetting` naming the variable (a path is kept, for a Jaeger under a prefix)
- [x] `writeFileDurably`: write until every byte is written (a zero-byte write is a failure), and on any failure before the rename remove the temp file and rethrow, leaving the old record in place
- [x] Shape (`apps/indusk-mcp/src/lib/telemetry/server.ts`): `QUERY_URL_ENV`'s docblock ("Where the pass reads Jaeger…") sits above `PUBLIC_QUERY_URL_ENV`'s, so an editor shows the public URL two descriptions, one of them wrong, and `QUERY_URL_ENV` none — move it onto its constant (rule: a name and its comment say what the thing is for; A11 inserted the new constant between them)

#### Build Phase 4 Verification

- [x] A13 passes (`pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-door-startup`), with the file in `SYSTEM`; leak guard clear (`node apps/indusk-mcp/scripts/check-test-daemons.js`) — 1/1, all-clear
- [x] A14, A15 and A16 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/query-door src/__tests__/always-on-public-url src/__tests__/durable-write`) — 14/14
- [x] The always-on suites still pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-browser-login src/__tests__/always-on-public-link src/__tests__/always-on-server src/__tests__/always-on-two-servers src/__tests__/always-on-falsification src/__tests__/always-on-pass src/__tests__/watcher-heartbeat-server`); `tsc --noEmit` and Biome clean on the changed files — 7 files, 27 tests; leak guard clear; `tsc` exit 0; Biome clean on the eight changed files (`daemon.ts` carries two unused-import errors from day-monitor, untouched here)
- [x] Shape — reviewed the eight files this phase changed against the enabled extensions' craft rules (none unreadable); one finding, the misplaced `QUERY_URL_ENV` docblock, worked as an item above. `openDoor`, `publicQueryUrl` and `writeAll` are each one named job with their why in the docblock. A13's test declares its own `freePort` beside the helper's unexported one: cross-file duplication, `/cleanup`'s to judge, not Shape's

#### Build Phase 4 Context

- [x] current.md, the shared region's day-always-on line: the four falsification fixes are on the branch and unreleased — the deployed 1.58.4 still has them, and none needs a redeploy to stay safe on Fly (one machine, a fixed public port, a URL without a credential, a 3 GB volume far from full)

#### Build Phase 4 Document

- [x] `apps/docs/src/reference/cli/telemetry-server.md`: `INDUSK_SERVER_PUBLIC_QUERY_URL`'s refusal (an absolute http(s) URL, no credential); "The query door" says a taken port refuses before Jaeger starts; `apps/docs/src/changelog.md` Unreleased, Fixed: the four; `vitepress build` clean — the door paragraph also says what happens to a response either side drops, and "When it announces nothing" says a short write keeps the previous record

### Build Phase 5: Cleanup — one loopback port picker for the server and its tests

**Goal**: decompose what this plan left spelled more than once across files, per the rule of three. The package is a library and CLI with no nextjs/react extension in play, so the move is reusing or extracting a function. One thing qualifies: picking a free loopback port is written three times, identically — `freeLoopbackPort` in `lib/telemetry/query-door.ts` (Build Phase 2), a private `freePort` in `__tests__/helpers/always-on-server.ts` (older), and another in `__tests__/always-on-door-startup.test.ts` (Build Phase 4, flagged by that phase's Shape as cleanup's to judge). The exported one already exists, and `query-door.test.ts` already imports it.

Reviewed: the 21 files this branch changed under `apps/` and `docker/` since the plan's first commit (`319504122`). One is over its attention threshold — `apps/docs/src/changelog.md`, prose.

- [x] `__tests__/helpers/always-on-server.ts` and `__tests__/always-on-door-startup.test.ts`: delete each private `freePort` and import `freeLoopbackPort` from `lib/telemetry/query-door.ts` — the rule of three; the third copy is the one that already has a name and an export
- [x] (reviewed `lib/telemetry/daemon.ts`'s `pickAnyFreePort` against `freeLoopbackPort` — left as-is: it binds the wildcard scope on purpose, with the reason in its comment (a loopback probe reports free when an IPv6 wildcard holds the port), and the local daemon's ports are exposed, not loopback; and the file is not this plan's)
- [x] (reviewed `freeLoopbackPort`'s home in `query-door.ts` — left as-is: its one production caller is `serve()` choosing the port behind the door, and a `ports.ts` for one function would be a module created to hold a name; if a second production caller appears outside telemetry, that is the moment to move it)
- [x] (reviewed `lib/telemetry/server.ts` (369 lines), `lib/always-on/pass.ts` (349) and `lib/always-on/heartbeat.ts` (302) — left as-is: under the 400-line threshold, and what this plan added to each threads one value (the gRPC port, the public query URL, the loopback port behind the door) or validates one setting; `publicQueryUrl`'s checks sit beside the other setting readers they mirror)
- [x] (reviewed `lib/always-on/durable-write.ts` — left as-is: it *is* the extraction, one writer shared by `pass.ts` and `heartbeat.ts`, which each carried their own write-and-rename before)
- [x] (reviewed the tests' Basic-header builders — `e2e/deployed-smoke.e2e.test.ts`'s `auth()`, the helper's `authHeader()`, one inline in `always-on-browser-login.test.ts` — left as-is: one line each over different credentials, a deployment's from the environment, a local server's constants, a deliberately wrong one; a shared helper would take the credential as its whole argument)
- [x] (reviewed `e2e/deployed-smoke.e2e.test.ts`'s `eventually` against the polling helpers in `watcher-heartbeat-server.test.ts` and `telemetry-ui-reachable.test.ts` — left as-is: different contracts (a boolean check versus a value or a URL), and neither other file is this plan's)
- [x] (reviewed `apps/docs/src/changelog.md`, 822 lines, the one flagged file — left as-is: the project's changelog, flagged by length alone; this plan added its Unreleased entries)

#### Build Phase 5 Verification

- [ ] (no tests flip at this phase — reason: refactor)
- [ ] The tests that use the two edited files still pass, their assertions unedited: `pnpm --filter @infinitedusky/indusk-mcp build && pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/always-on-door-startup src/__tests__/always-on-two-servers src/__tests__/always-on-server src/__tests__/always-on-browser-login src/__tests__/always-on-public-link`, and the leak guard is clear (`node apps/indusk-mcp/scripts/check-test-daemons.js`)
- [ ] `pnpm --filter @infinitedusky/indusk-mcp exec tsc --noEmit` exits 0, and Biome is clean on the two edited files

#### Build Phase 5 Context

- [ ] `apps/indusk-mcp/CLAUDE.md`, Tests, "Fixtures with one home": add a free loopback port — `freeLoopbackPort` (`lib/telemetry/query-door.ts`), so the next always-on test imports it rather than writing a fourth

#### Build Phase 5 Document

- [ ] `apps/docs/src/changelog.md` Unreleased: under Changed, one line that the always-on tests pick ports through the server's own `freeLoopbackPort` — internal, recorded so the release that carries it says what moved

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
