# Always-on Deploy

[Always On](/decisions/day-always-on) built a server that keeps the promise loop
running when no developer machine is on. It shipped with an image and a Fly
configuration that nobody had run. This plan deployed them to Fly (the app
`indusk-always-on`, personal org) and ran the
[smoke procedure](/guide/always-on#smoke-testing-a-deployment) against the
result, including a violation sent after an idle hour. The plan was a bugfix
workflow with no ADR. The decisions below were made during the build, each
when the deployment showed it was needed.

Plan archive: `.indusk/planning/archive/day-always-on-deploy/` (brief, test
plan, impl, retrospective).

## What was decided

**Every port the server binds comes from its settings, and a port nobody
outside needs binds loopback.** Jaeger's gRPC query port was left at its
default, `0.0.0.0:16685`, without basic auth. That was a listener anyone could
read, and it was a port two servers on one host could not share. It is now
`INDUSK_SERVER_GRPC_PORT`, bound to `127.0.0.1`. It shipped as 1.58.1, before
the deploy.

**A record is written durably, or not at all.** The announced record and the
watcher state are written to a temp file, flushed, renamed, and the directory
is flushed (1.58.2). Write-then-rename alone left a zero-byte record after a
machine restart, which silenced every announcement after it. Since 1.58.5 the
write also loops until every byte is written. A short write on a full volume
fails, and the old record stays.

*Against:* repairing an unreadable record by announcing everything again. The
server still refuses to guess, and the reference documents the repair (remove
the file).

**Slack links use a public address the operator names.**
`INDUSK_SERVER_PUBLIC_QUERY_URL` is optional (1.58.3). Without it, a message
names the trace and asks for the setting, rather than linking to the server's
loopback address. Since 1.58.5 it must be an absolute http(s) URL with no
credential, query or fragment, or the server refuses to start. The URL goes
into every message, so a password in it would be posted to the channel.

**A query door in front of Jaeger adds the login challenge, and decides
nothing.** Jaeger's basic auth refuses with a bare 401, so a browser never asks
for a login. The server's own process answers the public query port, forwards
everything to Jaeger on a loopback port, and adds `WWW-Authenticate: Basic` to
Jaeger's refusals (1.58.4). Jaeger is still the only thing that reads a
password. Since 1.58.5 the door binds before Jaeger starts, so a taken port
starts nothing. It also ties its two connections together: either side
dropping ends the other.

*Against:* a reverse proxy (Caddy, nginx) in the image. That would be a second
process to supervise and a second auth configuration to keep in step, all to
add one header.

**On Fly: `fly apps create`, one machine, a dedicated IPv4.** `fly launch`
rewrites the config and drops its comments. `--ha=false` is needed because
badger is single-writer. The query port is not 80 or 443, so it needs a
dedicated IPv4.

## Tradeoffs accepted

- **The deployment costs money while it runs.** That is one always-on
  `shared-cpu-1x` machine, a 3 GB volume, and $2/month for the IPv4. `fly
  scale count 0` keeps the volume.
- **The fixes went out as four releases during one plan** (1.58.1–1.58.4),
  because the image installs the published package. Each was a separate
  publish and a merge back into the branch.
- **Two smoke rows need a person.** One is reading the Slack message. The other
  is an hour of waiting for the idle-machine check. The rest is
  `e2e/deployed-smoke.e2e.test.ts`, which runs again against any deployment
  named by environment variables.

See [the guide's Fly section](/guide/always-on#on-fly),
[the query door](/reference/cli/telemetry-server#the-query-door) and
[the lessons](/lessons/day-always-on-deploy).
