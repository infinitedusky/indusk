# indusk demo

Start the seat-holds example: a small app with one promise you can break on
cue. It is the quickest way to see InDusk's promise loop working.

```bash
indusk demo [dir] [--no-open]
# or, without installing:
npx @infinitedusky/indusk-mcp demo
```

## What it does

1. Copies the seat-holds example from the installed package into `dir` (default `./seat-holds`).
2. Runs `git init` and `indusk init` there, so it is an InDusk project, registered with the admin.
3. Installs its dependencies.
4. Starts the local telemetry daemon if it isn't running.
5. Starts the example with its **Break it** switch on, sending its spans to the daemon, and prints the page's address.

It runs in the foreground; Ctrl-C stops the example. The project, its promise
and the daemon stay.

## Options

| Option | |
|---|---|
| `--no-open` | Do not open the seat page in a browser |

## Refusals

- **`dir` exists and is not empty.** Nothing is written; name an empty or new folder.
- **The example is not in this install.** An install older than 1.65 has no example.
- **The telemetry daemon did not start.** Run `indusk telemetry start`, then try again.

## What to try

Hold a seat and let it lapse: its release is marked `upheld`, and
`indusk promises status` (or the promise's page in the admin) shows
`a-held-seat-is-released-in-time` holding. Press **Break it** and hold another
seat: its release comes late, is marked `violated` with a symptom like
`seat 2 released 3.2 s late`, and the promise shows broken with its trace.
Press **Fix it** and it holds again.

The example itself, including deploying it to Fly, is described in its
[README](https://github.com/infinitedusky/indusk/tree/main/examples/seat-holds).
