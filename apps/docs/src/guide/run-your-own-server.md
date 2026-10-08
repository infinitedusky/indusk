# Run your own server

A recording server holds your project's production marks: every promise held
or broken by the running system. Your local admin reads it as the
**production** source beside the local one. It is the
[always-on server](/guide/always-on) InDusk ships, and it is yours: InDusk runs
no server for anyone.

There are two ways to get one, and one command that connects either.

## On Fly, in one command

With the Fly CLI installed and signed in (`fly auth login`), in your project:

```bash
indusk server deploy
```

It creates the app, its volume, its password and its addresses in your own Fly
account, deploys the server image for your version of InDusk, and connects the
project. When it ends, the next promise read shows production. Add
`--slack-webhook-env SLACK_URL` (a variable holding your webhook) for Slack
announcements; without it, the server records and nothing is posted. Every
option is in the [reference](/reference/cli/server#server-deploy).

It costs what Fly charges for one small machine, a 3 GB volume and a dedicated
IPv4 ($2 a month).

::: info Observed, 2026-10-08
A fresh server on Fly, deployed and connected by `indusk server deploy`, took
about six minutes end to end, most of it Fly creating the app and the new
address and certificate coming up; the command waits for them. It costs about
$8 a month by Fly's price list: one small machine, a 3 GB volume, and a $2
dedicated IPv4.
:::

## Anywhere else: the published image

Every InDusk release publishes the server as an image:

```
ghcr.io/infinitedusky/indusk-always-on:<version>
```

It runs on anything that runs a container with a disk and gives it TLS: a VPS,
a small Kubernetes deployment, the provider your application already uses.
Match the version to the `indusk` you run.

### What the server needs

| Setting | What it is |
|---|---|
| `INDUSK_SERVER_VOLUME` | Where the server keeps its data, on a mounted volume. Without a volume it forgets every violation when the container is replaced. |
| `INDUSK_SERVER_OTLP_PORT` | The port the OTLP/HTTP intake listens on, where your application sends its marks. |
| `INDUSK_SERVER_QUERY_PORT` | The port the query API and the Jaeger UI listen on, where your admin reads. |
| `INDUSK_SERVER_USER` | The basic-auth user for both ports. |
| `INDUSK_SERVER_PASSWORD` | The basic-auth password. A secret: set it the way your platform sets secrets. |
| `INDUSK_SERVER_SLACK_WEBHOOK` | Optional. Where violations are announced. Without it, the server records and nothing is posted. |
| `INDUSK_SERVER_PUBLIC_QUERY_URL` | Optional. The query address as people reach it, so Slack messages can link to a trace. |

Run exactly one instance: its store is single-writer, and two instances would
each hold half the violations. Keep it from sleeping: a server that is
stopped when a violation arrives cannot announce it. Put TLS in front of both
ports, since basic auth sends the password on every request.

```bash
docker run -d --name indusk-server --restart unless-stopped \
  -v indusk-data:/data \
  -p 4318:4318 -p 16686:16686 \
  -e INDUSK_SERVER_VOLUME=/data \
  -e INDUSK_SERVER_OTLP_PORT=4318 \
  -e INDUSK_SERVER_QUERY_PORT=16686 \
  -e INDUSK_SERVER_USER=indusk \
  -e INDUSK_SERVER_PASSWORD="$(openssl rand -hex 24)" \
  ghcr.io/infinitedusky/indusk-always-on:<version>
```

Or with compose:

```yaml
services:
  indusk-server:
    image: ghcr.io/infinitedusky/indusk-always-on:<version>
    restart: unless-stopped
    volumes: ["indusk-data:/data"]
    ports: ["4318:4318", "16686:16686"]
    environment:
      INDUSK_SERVER_VOLUME: /data
      INDUSK_SERVER_OTLP_PORT: "4318"
      INDUSK_SERVER_QUERY_PORT: "16686"
      INDUSK_SERVER_USER: indusk
      INDUSK_SERVER_PASSWORD: ${INDUSK_SERVER_PASSWORD}
volumes:
  indusk-data:
```

Then, in your project, with the addresses your TLS front serves:

```bash
indusk server connect https://your-host:16686 --intake https://your-host:4318
```

It asks for `user:password` without showing it, reads the server back, and
only then names it as the project's production source.

## What `connect` records

Both ways end with [`indusk server connect`](/reference/cli/server#server-connect).
It sends one mark through the server and reads it back, and only then:

- names the server in `.indusk/config.json` as `promises.jaeger`, with the
  *name* of the variable that holds the credential;
- stores the credential in `~/.indusk/config.env`, readable by you only.

The config can be committed. The credential never is.
