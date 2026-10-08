# indusk server

Gives a project its recording server: the Jaeger with the always-on pass that
holds the project's production marks, and that the admin reads as the
**production** source beside the local one. Every server is the person's own.
InDusk runs none for anyone.

- [`server connect`](#server-connect) points the project at a server you run,
  wherever it runs.
- [`server deploy`](#server-deploy) creates one in your own Fly account and
  connects it.

The [run your own server](/guide/run-your-own-server) guide walks through both.

## server connect

```bash
indusk server connect <query-url> --intake <otlp-url> [--credential-env <NAME>]
```

| Argument | What it is |
|---|---|
| `<query-url>` | The server's query API as you reach it, e.g. `https://my-server.fly.dev:16687`. |
| `--intake <otlp-url>` | The server's OTLP/HTTP intake, e.g. `https://my-server.fly.dev`. A mark is sent here to read the server back. |
| `--credential-env <NAME>` | Read `user:password` from this environment variable. Without it you are asked, and what you type is not shown. |

The credential is never an argument: shell history and the process list keep
arguments.

### What it does, in order

1. **Reads the server back.** It sends one mark through the intake and looks
   for it through the query API, at the addresses you gave, which are the
   addresses the project will read. This is the same probe every promise read
   runs.
2. **Stores the credential on this machine**, in `~/.indusk/config.env`
   (`$INDUSK_HOME/config.env` when that is set), under a variable named for the
   project: `INDUSK_SERVER_<PROJECT>_<HASH>_CREDENTIAL`, where the hash is of
   the project's repository (shared by its worktrees), or of its folder outside
   git, so two projects in folders of the same name never share one. The file is readable by its
   owner only. Other lines in it are kept.
3. **Names the server in the project's config**, `.indusk/config.json`:

   ```json
   "promises": {
     "jaeger": {
       "url": "https://my-server.fly.dev:16687",
       "otlp_url": "https://my-server.fly.dev",
       "credential_env": "INDUSK_SERVER_MY_PROJECT_CREDENTIAL"
     }
   }
   ```

   The config names the variable, never the value, so it can be committed.

The next promise read, in the CLI or the admin, shows two sources: `local`
and `production`. The production source takes its credential from the
environment when the variable is set there, and from `~/.indusk/config.env`
otherwise, so no shell restart is needed.

Running it again replaces both the named server and the stored credential.
One of each remains.

### When it refuses

Nothing is written unless the server was read back.

| Output | Exit | Why |
|---|---|---|
| `watcher blind — a probe sent to <intake> did not come back from <query-url>: <reason>` | 2 | The server answered and did not hear the mark: a wrong intake, a broken pipeline, a wrong credential. |
| `Jaeger could not be reached (<query-url>): <reason>` | 2 | Nothing answered at the query address. |
| `<NAME> is not set — export it, or leave out --credential-env to be asked.` | 2 | `--credential-env` named a variable that is empty. |
| `No InDusk project here: run indusk init first, or run this inside one.` | 2 | No `.indusk/config.json` here or above. |

Each refusal ends with `Nothing was written: the project still reads what it
read before.` when the server was the problem.

Nothing the command prints contains the credential.

## server deploy

```bash
indusk server deploy [--app <name>] [--org <slug>] [--region <code>]
                     [--slack-webhook-env <NAME>] [--server-version <version>] [--rotate]
```

Needs the Fly CLI, signed in (`fly auth login`). It runs your `fly`, so
everything it creates is in your account and on your bill. InDusk holds no Fly
token.

| Option | Default | What it is |
|---|---|---|
| `--app <name>` | `indusk-<project>`, or the app this project recorded | The Fly app name. Fly app names are global. |
| `--org <slug>` | your only organisation | Needed when your account has several; the refusal lists them. |
| `--region <code>` | `iad` | Where the machine and its volume live. |
| `--slack-webhook-env <NAME>` | none | Read the Slack webhook from this variable. Without it, announcements are off: the server records every violation and the admin shows it, and nothing is posted. |
| `--server-version <version>` | this `indusk`'s version | The server image to run. (`--version` is the CLI's own.) |
| `--rotate` | off | Set a new server password. |
| `--build-from <tarball>` | none | Build the image here from a packed tarball (`pnpm pack`), for a version no release has published. It is built for `linux/amd64`, pushed to the app's own Fly registry (`registry.fly.io/<app>:<version>-local-<stamp>`) and deployed from there. Needs Docker. |

### What it does, in order

It reads first — who is signed in, your organisations, whether the app exists
and what it has — and then runs only what is missing:

1. `fly apps create <app> --org <org>`
2. `fly volumes create indusk_telemetry --size 3 --region <region>`
3. `fly secrets import --stage`, on stdin, never on the command line: a new
   password for a new app, with `--rotate`, or when this machine does not
   hold the project's credential; the webhook whenever one is given, so
   `--slack-webhook-env` on an existing server sets it and keeps the password.
4. `fly deploy --image ghcr.io/infinitedusky/indusk-always-on:<version> --ha=false`
   with a Fly configuration generated for the app: one machine that never
   stops, the volume, the two services. It pulls the published image and
   never builds.
5. `fly ips allocate-v6` and `fly ips allocate-v4 --yes`. The query port is
   not 443, so reading it over IPv4 needs a dedicated IPv4, which Fly charges
   $2 a month for.

Right after the app is created, the project's config records it:

```json
"server": { "provider": "fly", "app": "indusk-my-project", "org": "personal", "region": "iad" }
```

Then it runs [`server connect`](#server-connect) against
`https://<app>.fly.dev:16687` and `https://<app>.fly.dev`, which reads the
server back before naming it. A new app's address and certificate come up a
minute or two after the deploy, and its two ports not together, so deploy
waits up to five minutes while the server is not reachable yet, trying every
ten seconds. A refused login is not waited on.

Running it again on a project with a server updates it: it redeploys the
version and creates nothing else.

### When it refuses

Each refusal exits 2 and has created nothing, unless it says otherwise.

| Output | Why |
|---|---|
| `The Fly CLI is not installed. Install it (…), run fly auth login, then run this again.` | No `fly` on PATH. |
| `fly is not signed in. Run fly auth login, then run this again.` | |
| `Your Fly account has several organisations; name one with --org: …` | |
| `A Fly app named <app> already exists and is not recorded as this project's server. Choose another name with --app <name>.` | |
| `This project's server is <app>, recorded in its config. …` | `--app` names a different app from the one recorded. |
| `` `fly <step>` failed (exit N); nothing after it ran. Its output is above. `` | A Fly call failed; what ran before it stays. |
| `` `fly volumes list -a <app> --json` failed (exit N): … Nothing was created; run this again when Fly answers. `` | Fly did not answer a read. A failed read is never taken for "nothing there", which would create a second volume or address. |
| `… answered 401` then `… connected with the credential this machine stored before (<variable>), and the server did not accept it; run indusk server deploy --rotate to set a new password.` | The server is up and refused the stored login. Deploy does not wait on it. |
| `watcher blind — …` then `The server <app> exists and is recorded in this project's config; run indusk server deploy again to finish connecting.` | The server was created but did not read back. A second run creates nothing and tries the connect again. |

Every line it prints, Fly's own output included, passes through a writer that
replaces the password and the webhook with `[redacted]`.
