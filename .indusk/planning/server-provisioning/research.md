---
title: "Server provisioning — one command gives a project its server"
date: 2026-10-08
status: complete
---

# Server provisioning — Research

## Question

What does it take for one command to give a project its own always-on server,
when today that takes a person, seven Fly commands, two secrets and a reading
of the retrospective that explains what the written steps got wrong?

## Background

The always-on server exists once, for dusk: the Fly app `indusk-always-on`,
deployed by hand on 2026-10-04
([day-always-on-deploy](../archive/day-always-on-deploy/retrospective.md)).
The demo's script opens with "a new project starts; the local environment and
its own always-on server come up" ([indusk-demo](../indusk-demo/master.md),
step 1), and the people the demo brings in will each want a server for their
own project. Neither can be asked to repeat the 2026-10-04 procedure.

The direction was set on 2026-10-04 in this plan's first brief (a note, now
superseded by the brief beside this file): a command that creates the Fly app
and volume, generates and stores the password, takes the Slack webhook, sets
the public query URL, deploys the published version, allocates addresses and
writes the project's production source into its config; idempotent; Fly only.
It is the minimal slice of
[workbench-watch-provisioning](../workbench-watch-provisioning/brief.md),
which adds a GitHub connection for the server to write back through. That
part stays there.

Sandy accepted the promises on 2026-10-08 (see Decisions). The demo master
places this plan after the launch: the demo app can point at the server that
exists, so the recording does not wait on this.

## Findings

### What the first deployment actually did

From the [always-on guide](../../../apps/docs/src/guide/always-on.md#on-fly)
and the deploy plan's retrospective, the steps that worked:

```bash
fly apps create <app> --org <org>
fly volumes create indusk_telemetry --size 3 --region <region> -c <config>
fly secrets set INDUSK_SERVER_PASSWORD="$(openssl rand -hex 24)" --stage -c <config>
fly secrets set INDUSK_SERVER_SLACK_WEBHOOK="https://hooks.slack.com/…" --stage -c <config>
fly deploy -c <config> --build-arg VERSION=<release> --ha=false --remote-only
fly ips allocate-v6 -c <config>
fly ips allocate-v4 --yes -c <config>        # dedicated, $2/month
```

What the written steps got wrong, each found by running them:

- `fly launch` rewrites the config file and drops its comments; use
  `fly apps create` and `fly config validate`.
- Fly's default is two machines; badger is a single-writer store on one
  volume, so `--ha=false`.
- A first deploy gets no public IP. The query port, 16687, is not 80 or 443,
  so Fly's shared IPv4 does not route it: reading the server over IPv4 needs
  a dedicated IPv4. IPv6 is free, but many home networks have none.
- `INDUSK_SERVER_PUBLIC_QUERY_URL` must name the address people reach
  (`https://<app>.fly.dev:16687`), or Slack messages cannot link to a trace.
- Fly spells auto-stop `"off"`, not `false`; `min_machines_running = 1` and no
  auto-stop is the point of the deployment, not a tuning.

The reference configuration is `docker/fly.always-on.toml` (app name, region,
the five `[env]` settings, the volume mount, two services, one machine). The
image, `docker/Dockerfile.always-on`, installs the **published** package at
`--build-arg VERSION` and runs `indusk telemetry serve` as process 1.

### What a server needs, and what a project records

The server reads fourteen `INDUSK_SERVER_*` settings
(`apps/indusk-mcp/src/lib/telemetry/`); a deployment sets five in the config
(`VOLUME`, `OTLP_PORT`, `QUERY_PORT`, `USER`, `PUBLIC_QUERY_URL`) and two as
secrets (`PASSWORD`, `SLACK_WEBHOOK`). The rest default.

A project names its production source in `.indusk/config.json` as
`promises.jaeger` — `url` (the query API), `credential_env` (the **name** of
the variable holding `user:password`, never the value) and `otlp_url` (the
intake, which the heartbeat probe needs; without it every read says *watcher
blind*). The shape is typed in `lib/config.ts` (lines 172–191); it has one
reader, `lib/promises/sources.ts`. The credential's value lives in
`~/.indusk/config.env`, read by `lib/infra-config.ts`; today the one deployed
server's is `INDUSK_DEPLOYED_CREDENTIAL`. Config blocks are written through
`ensureConfigBlock` in `lib/config.ts`, the one writer.

### Reading a server back

`probeWatcher` (`lib/promises/probe.ts`) sends a span through the OTLP intake
and reads it back from the query API, and throws *watcher blind* naming the
intake, the reader and the reason when it does not return. It is what every
promise read already does (watcher-heartbeat), so "the command ends only
after the server is read back" is one call to it with the new server's
addresses and credential.

`e2e/deployed-smoke.e2e.test.ts` runs the full smoke against a deployed
server named by `INDUSK_DEPLOYED_QUERY_URL`, `_OTLP_URL`, `_CREDENTIAL` and
`_FLY_APP`: it is the live check for a server this command creates.

### Fly, on this machine

`fly` v0.4.111 is installed and signed in (`fly auth whoami` answers). The
account has one org, `personal`, with seven apps, `indusk-always-on` among
them. `fly apps create` refuses a name that exists; a second run must detect
the app first (`fly status -a <app>` or `fly apps list --json`) and update
rather than create. Volumes and addresses likewise: `fly volumes list -a`,
`fly ips list -a`. A dedicated IPv4 costs $2/month per app.

### Structural scope

- One reader of `promises.jaeger` (`sources.ts`); one writer of config blocks
  (`ensureConfigBlock`); one credential file reader (`infra-config.ts`).
- No `server` command exists in `bin/cli.ts`; `telemetry serve` is the
  server itself. The CLI has 40-odd commands registered in one file.
- The Fly reference config is a file in `docker/`, not in the package. A
  command that deploys needs the config and the Dockerfile from the installed
  package, so both move into (or are generated by) the package.

## Decisions

Sandy accepted the five promises and the expectation as read back on
2026-10-08. The five questions asked with them were not answered one by one;
these are the defaults the plan takes, each to be corrected if wrong:

- **A separate command, run by a person.** `indusk server deploy` (name
  provisional), by someone with `fly` signed in. Not a step of `indusk init`:
  init writes files, this creates things that cost money. The demo's step 1
  runs it right after init.
- **One server per project**, the direction from 2026-10-02 in the larger
  provisioning brief. App name `indusk-<project>` unless given.
- **Nothing required beyond a signed-in `fly`.** Org and region default (the
  account's only org; the reference region) and can be given. The Slack
  webhook is optional: without it the server records and the admin shows,
  and the command says announcements are off.
- **The version is the running `indusk`'s**, so the server is the release the
  person runs; overridable.
- **Done means read back.** The command ends after the project's config
  names the server, the credential is stored under a per-project variable in
  `~/.indusk/config.env`, and the heartbeat has returned through the public
  address.

## Open Questions

- Build on Fly per project (`--remote-only`, minutes) or deploy a prebuilt
  image from a registry (seconds, and no Dockerfile in the package)? The ADR's
  question.
- Where the demo's Slack webhook comes from, if the recording wants Slack.
- Tearing a server down is not promised; `fly apps destroy` by hand until a
  plan wants it.

## Sources

- [day-always-on-deploy retrospective](../archive/day-always-on-deploy/retrospective.md),
  [decision page](../../../apps/docs/src/decisions/day-always-on-deploy.md)
- [always-on guide](../../../apps/docs/src/guide/always-on.md), `docker/fly.always-on.toml`
- [workbench-watch-provisioning brief](../workbench-watch-provisioning/brief.md)
- `apps/indusk-mcp/src/lib/config.ts`, `lib/promises/sources.ts`, `lib/promises/probe.ts`,
  `lib/infra-config.ts`, `e2e/deployed-smoke.e2e.test.ts`
