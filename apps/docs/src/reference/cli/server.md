# indusk server

Gives a project its recording server: the Jaeger with the always-on pass that
holds the project's production marks, and that the admin reads as the
**production** source beside the local one. Every server is the person's own.
InDusk runs none for anyone.

- [`server connect`](#server-connect) points the project at a server you run,
  wherever it runs.
- `server deploy` creates one in your own Fly account and connects it. It is
  being built; until it lands, the [always-on guide](/guide/always-on#on-fly)
  has the steps by hand.

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
   project: `INDUSK_SERVER_<PROJECT>_CREDENTIAL`. The file is readable by its
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
