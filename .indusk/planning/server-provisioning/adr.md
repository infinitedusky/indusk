---
title: "Server provisioning — run your own recording server, connected in one command"
date: 2026-10-08
status: proposed
---

# Server provisioning — run your own recording server, connected in one command

## Goal

**A person who runs InDusk from GitHub gives a project its own recording server in one command on Fly, or runs the published image anywhere and connects it in one, and nothing InDusk ships operates a server for anyone.**

Today the one recording server was deployed by hand in seven Fly commands, two secrets and a retrospective's worth of corrections, and a project is pointed at it by editing its config and a secrets file. The demo's first step, "a new project comes up with its own always-on server", cannot be that, and neither can the people the demo brings in. After this plan, `indusk server deploy` does the Fly path end to end into the person's own account, `indusk server connect` does the InDusk part for a server started anywhere, and every release publishes the server's image so "anywhere" is one `docker run`.

## Y-Statement

**In the context of:**
InDusk's recording server — the shipped Jaeger with the always-on pass, basic auth and a volume — which holds a project's production marks and is what the local admin reads as the production source. InDusk is released on GitHub; the people who adopt it run their own copy of everything, and the demo opens with a new project getting its server.

**Facing:**
The first draft of this plan was one command that drove Fly from inside the product, which read as the beginning of a hosted, multi-tenant service. The server already runs anywhere with a volume, two ports and TLS, and the parts that are InDusk's — naming the source, storing the credential, reading the server back — are the same wherever it runs. Fly is where a server comes up fastest, and the person's own Fly account is where it should come up.

**We decided for:**
Three pieces. `indusk server connect`, provider-free: it names a server the person runs as the project's production source, stores the credential on the machine under a per-project variable, sends a mark through the server and reads it back before it writes anything. `indusk server deploy`, Fly only: it drives the person's signed-in `fly` CLI through app, volume, secrets, deployment and addresses, pulling the published image for the person's own version, and ends by running connect. And the image itself, built from the release's packed tarball and pushed to GitHub's container registry by the same deliberate `pnpm release`, so a person on any other host runs the image and connects.

**And against:**
Fly's Machines API from the product (needs a token InDusk would have to hold; the CLI's sign-in is already the person's). Building the image on Fly per project (minutes per deploy, and the Dockerfile shipped in the package). Building the image from npm after publishing (npm's publish-time scan makes the version uninstallable for five to fifteen minutes, so the same release could not build it). A deploy command per provider (anywhere else is the image and the guide). Writing the production source when the server cannot be read back (a project that names a server that does not answer reads watcher blind forever). Secrets on the Fly CLI's command line (visible in the process table; `fly secrets import` reads them from stdin).

**To achieve:**
A project watched from its first day, on the person's own server, in one command on Fly or one command after starting the image anywhere; a release whose server image and npm package are the same bytes; and a product with no hosted service in it.

**Accepting:**
The release machine needs Docker and a one-time login to the registry, and a failed image push stops the release before npm sees the version. Fly's CLI can change under the command, as `fly launch` once did; the live check and refusals that name the failing Fly call are the control. A dedicated IPv4 at $2 a month per server, because the query port is not 443. One more block in the project's config, naming the Fly app so a second run finds it.

**Because:**
The parts InDusk owns are small and the same everywhere, so they are one command on their own. Fly is the fast path because the reference deployment is already proven there and the person's account is theirs. The image is the product's boundary with every other host: publish it with the release and the guide's "what the server needs" is complete.

## Context

- [Research](research.md): the 2026-10-04 deployment and its corrections; the fourteen server settings, five set by a deployment and two as secrets; `promises.jaeger` (url, otlp_url, credential_env) with one reader and one config writer; `probeWatcher` as the read-back; the deployed smoke as the live check; `fly` v0.4.111 signed in, one org, seven apps.
- [Brief](brief.md): seven promises, three expectations, nothing hosted.
- [Test plan](test-plan.md): 21 assertions; A8 and A4 are the live checks, A19 the contract row.

## Decision

1. **Two commands under `indusk server`.** `connect <query-url> --intake <otlp-url>` takes the credential from a prompt or `--credential-env <NAME>` (an already-set variable), and `deploy` takes `--app`, `--org`, `--region`, `--slack-webhook-env <NAME>` (the webhook read from a variable, never typed on the command line), `--version`. Defaults: app `indusk-<project>`, the account's only org, the reference region, the running `indusk`'s version, no Slack.
2. **Fly through the signed-in `fly` CLI**, behind one `FlyCli` seam: `run(args, { stdin }) → { status, stdout, stderr }`. The real one spawns `fly`; tests hand in a recorded one. Before any write, deploy reads `fly auth whoami`, `fly apps list --json`, and for an existing app `fly volumes list` and `fly ips list`; a pure `planDeploy(state, wanted)` turns what exists into the list of steps to run, so A5, A11, A13 and A14 are unit rows over states.
3. **The image is built from the release's tarball and pushed first.** `pnpm release` becomes guard → slow tier → `npm whoami` → `docker build` from `pnpm pack`'s tarball, tagged `ghcr.io/infinitedusky/indusk-always-on:<version>` and `:latest` → `docker push` → `pnpm publish` → record. The Dockerfile installs the tarball it is given, not npm. A failed push stops the release before npm has the version (A18). Deploy runs `fly deploy --image ghcr.io/infinitedusky/indusk-always-on:<version> --ha=false` and never builds.
4. **The project records its server in config.** Connect writes `promises.jaeger` through `ensureConfigBlock` — `url`, `otlp_url`, `credential_env: INDUSK_SERVER_<PROJECT>_CREDENTIAL` — and the value into `~/.indusk/config.env` (mode 600). Deploy writes a `server` block, `{ provider: "fly", app, org, region }`, which a second run reads to find its app; an app of that name not recorded here is someone else's (A14).
5. **Secrets never cross a command line or a print.** The password is 24 random bytes as hex, generated by deploy; it and the webhook go to Fly through `fly secrets import` on stdin. Output is built from a redacting writer that knows both values and replaces them wherever they appear, including in Fly's own output (A9).
6. **Read-back gates the write.** Both commands call `probeWatcher` with the public addresses the project will use. Connect writes nothing when the probe does not return and says watcher blind with the intake and the reader (A15). Deploy, whose resources already exist by then, records the `server` block, says the server exists and that a second run finishes the connect (A17).
7. **The Fly configuration is generated**, per run, into a temporary directory from a template in the package: app, region, the five `[env]` settings, the mount, the two services, one machine. `docker/fly.always-on.toml` stays as the documented reference for people deploying by hand and is pinned equal to the template's output by test.

## Alternatives Considered

### Fly's Machines API
Direct HTTP, no CLI dependency. Rejected: it needs a Fly token InDusk would store, and the person's `fly auth` already holds their credential the right way. The CLI is also what the reference procedure used and what the guide documents.

### Build on Fly per project
`fly deploy --remote-only` with the Dockerfile shipped in the package. Rejected: minutes per deploy, a Dockerfile to keep in the npm tarball, and the image on every person's server built from npm, which is unavailable for minutes after each publish.

### One `deploy` with `--provider`
Rejected for now: a second provider is a second set of calls and states, and nobody has asked. Anywhere else is the published image plus connect; the guide says what the server needs. A provider can be added as its own command when wanted.

### Write the source even when the read-back fails
Tempting for a server that is merely slow. Rejected: the probe already waits for Jaeger's indexing window, and a named server that does not answer is read as watcher blind on every read thereafter, which is the failure the heartbeat plan exists to make loud rather than permanent.

### Keep the credential in the project's config
Rejected on the standing rule: the config file is committed; it names the variable, the value lives on the machine.

## Consequences

### Positive
- One command on Fly; one command plus `docker run` anywhere; no hosted service.
- The image and the npm package of a release are the same bytes, and the image needs no npm.
- The decision logic of deploy is pure over recorded Fly state, so it is tested in milliseconds.

### Negative
- `pnpm release` gains Docker and a registry login as requirements of the release machine.
- The package grows a Fly config template and a `server` config block to keep in step with the reference file.
- A dedicated IPv4 per server, $2 a month.

### Risks
- **Fly's CLI changes.** Mitigation: U1 — the live check at any release touching deploy; every refusal names the Fly command and its output.
- **The registry rejects the push** (expired login, rate limit). Mitigation: the push runs before `pnpm publish`, so the release stops with nothing published; the message names `docker login ghcr.io`.
- **Two servers for one project** when a person runs deploy with a different `--app`. Mitigation: the recorded `server` block is the identity; a second app is refused unless `--replace` is given and said back.

## Documentation Plan

### Pages
- New: `guide/run-your-own-server.md` — the three ways in order: Fly in one command, anywhere with the published image (what the server needs, then connect), and what connect records. Replaces the "On Fly" procedure in `guide/always-on.md`, which points here.
- New: `reference/cli/server.md` — `connect` and `deploy`, every flag, every refusal and its wording, the `server` config block.
- Update: `reference/cli/telemetry-server.md` — the image's new build (from the tarball) and its registry name.
- Update: `reference/skills/retrospective.md` — the release step's image push, for a project that publishes an image.

### Diagrams
- None. The order of deploy's steps is a list in the reference page.

### Changelog
- Added: `indusk server connect` and `indusk server deploy`; the server image published with each release.
- Changed: `pnpm release` builds and pushes the image before publishing.

### ADR in Docs
- Yes: `decisions/server-provisioning.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [day-always-on-deploy](../archive/day-always-on-deploy/retrospective.md), [watcher-heartbeat](../archive/watcher-heartbeat/brief.md), [promise-sources](../archive/promise-sources/brief.md)
- `docker/fly.always-on.toml`, `docker/Dockerfile.always-on`, `apps/indusk-mcp/package.json` (`release`)
