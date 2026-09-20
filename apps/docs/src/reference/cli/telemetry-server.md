# `indusk telemetry serve`

Runs the Jaeger InDusk already ships as a long-lived server, so the promise
loop keeps running when no developer machine is on.

It is not the local daemon. `indusk telemetry start` picks free ports, writes
a PID file, registers the project and runs in the background; `serve` does
none of that. It reads its settings from the environment, writes a config onto
its volume, and runs Jaeger in the foreground as a container's process 1 — the
supervisor that started it (Fly, systemd, docker) is what restarts it.

```bash
INDUSK_SERVER_VOLUME=/data \
INDUSK_SERVER_OTLP_PORT=4318 \
INDUSK_SERVER_QUERY_PORT=16686 \
INDUSK_SERVER_USER=indusk \
INDUSK_SERVER_PASSWORD="$(openssl rand -hex 24)" \
  indusk telemetry serve
```

## Two differences from the daemon

**Storage is badger on the volume**, not memory: a trace survives a restart,
which is the whole point of a server. Badger's files live under
`<volume>/badger/`.

**Both doors are behind basic auth** — the OTLP receiver and the query API.
Without credentials each answers `401`, and nothing unauthenticated is stored.
An application sends them the standard way:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-server/
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64 of user:password>
```

Basic auth sends the credentials on every request, so anything off localhost
needs TLS in front of it — the host's, or a reverse proxy's.

`jaeger_mcp` and `healthcheckv2` are deliberately absent from the server's
config. Each would be another unauthenticated door on a public host, nothing
in the loop reads either remotely, and a supervisor can check the query port
instead.

## The environment

| Variable | Required | What it is |
|---|---|---|
| `INDUSK_SERVER_VOLUME` | yes | The directory badger's files and the rendered config live in. Created if absent. |
| `INDUSK_SERVER_OTLP_PORT` | yes | The port the OTLP HTTP receiver binds. |
| `INDUSK_SERVER_QUERY_PORT` | yes | The port the query API and the Jaeger UI bind. |
| `INDUSK_SERVER_USER` | yes | The basic-auth user, for both doors. |
| `INDUSK_SERVER_PASSWORD` | yes | Its password. Never commit it; give it to the host as a secret. |
| `INDUSK_SERVER_RETENTION_HOURS` | no | How long a span stays readable. Defaults to 672 (28 days). |

## What it refuses

A missing or unusable setting stops the process, naming the variable, rather
than starting a server without it:

```
indusk telemetry serve: INDUSK_SERVER_PASSWORD is not set. The always-on
server reads every setting from the environment; see
/reference/cli/telemetry-server.
```

A port that is not a port number, and a retention that is not a positive
number of hours, refuse the same way and quote what they were given. A server
that starts with no credentials is an open ingestion endpoint on the internet,
so this is a refusal rather than a default.

## Why 28 days

`monitor` — the position a closed plan holds while its behaviour promises are
being watched — waits out a quiet window of `promises.quiet_window_days`,
seven by default. A violation has to still be readable when a person comes to
look at it, and the person who comes to look may be a week late. The default
retention is four quiet windows, so nothing in the loop's own cadence can
outlive the evidence it is about. Shorten it with
`INDUSK_SERVER_RETENTION_HOURS` if the volume is small.

## Reading it from a developer machine

A project names the server it reads in `.indusk/config.json`; naming none
still reads the local daemon. See [the promises guide](/guide/promises).
