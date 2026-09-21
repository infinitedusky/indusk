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

## The pass

The server does not only receive spans; it watches them. On an interval, in
its own process, it asks its own Jaeger one question — what has been marked
violated since the window began — and says each answer once, to Slack.

It does not know what promises exist. The registry lives in a plan
repository and the server has none, so a span carrying `indusk.promise` with
outcome `violated` is a violation and that is the whole of the server's
knowledge. Deciding which plan owns it happens later, on a developer machine,
when `indusk promises watch --source deployed` reads the same server.

A message looks like this:

```
Promise violated: seat-never-double-booked
seat 4 held by two players
staging · seats-api · hold-seat
https://your-server/trace/4f1e…
```

Every line comes from the span. The environment is the span's
`deployment.environment` — OpenTelemetry's own attribute, not an InDusk one,
because a system that is already instrumented has set it. When nothing set
it, the message reads `environment unknown` rather than guessing: saying
"production" about staging is worse than admitting it does not know.

### Announced once, and never lost

`<volume>/announced.json` holds the span ids already announced, pruned to the
pass window. A span in it is skipped.

It is written **after** Slack accepts the message, one span at a time. If the
post fails — Slack is down, the webhook is wrong, the network is out — the
span is *not* recorded, the pass logs `could not announce … it stays
unannounced for the next pass`, and the next pass says it. Saying something
twice is a nuisance; saying it never is the failure this whole thing exists
to prevent.

The record itself is read forgivingly: a corrupt or missing file reads as
empty, which costs a repeated message. The alternative — refusing to run —
would cost every violation from then on.

### Running a pass by hand

```bash
INDUSK_SERVER_VOLUME=/data \
INDUSK_SERVER_QUERY_URL=https://your-server \
INDUSK_SERVER_CREDENTIAL=indusk:the-password \
INDUSK_SERVER_SLACK_WEBHOOK=https://hooks.slack.com/services/... \
  indusk telemetry announce --once
```

The same pass the server runs, entered once, against a server this machine
did not start. `--once` is required: the scheduled pass belongs to
`indusk telemetry serve`. It exits non-zero when anything went unannounced.

## The environment

| Variable | Required | What it is |
|---|---|---|
| `INDUSK_SERVER_VOLUME` | yes | The directory badger's files and the rendered config live in. Created if absent. |
| `INDUSK_SERVER_OTLP_PORT` | yes | The port the OTLP HTTP receiver binds. |
| `INDUSK_SERVER_QUERY_PORT` | yes | The port the query API and the Jaeger UI bind. |
| `INDUSK_SERVER_USER` | yes | The basic-auth user, for both doors. |
| `INDUSK_SERVER_PASSWORD` | yes | Its password. Never commit it; give it to the host as a secret. |
| `INDUSK_SERVER_RETENTION_HOURS` | no | How long a span stays readable. Defaults to 672 (28 days). |
| `INDUSK_SERVER_SLACK_WEBHOOK` | yes | The incoming-webhook URL violations are announced to. A server that cannot say anything is not watching, so this is required. |
| `INDUSK_SERVER_PASS_INTERVAL_MS` | no | How often the pass runs. Defaults to 60000. |
| `INDUSK_SERVER_PASS_WINDOW_HOURS` | no | How far back each pass looks, and how long the announced record keeps a span. Defaults to 24. |

`indusk telemetry announce --once` reads `INDUSK_SERVER_QUERY_URL` and
`INDUSK_SERVER_CREDENTIAL` (`user:password`) in place of the ports, user and
password, because the server it asks may not be the machine it runs on. It
prints the same report the served pass prints, from the same code — the two
cannot describe a pass differently.

A Jaeger URL may be written with or without a trailing slash, and with
surrounding whitespace, wherever one is read — `INDUSK_SERVER_QUERY_URL` here
and `promises.jaeger.url` in a project's config. They are normalized the same
way because they are normalized in one place.

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
