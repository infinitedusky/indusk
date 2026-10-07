# Demo App Template

The seat-holds example shows InDusk's promise loop in one small app: a
promise held, broken on cue, and caught by telemetry. Full ADR:
`.indusk/planning/archive/demo-app-template/adr.md`.

## What was decided

- **It lives in this repository, at `examples/seat-holds/`**, as the main
  repository's example, the way developer tools ship theirs. It is tested with
  the workspace and shipped in the npm package, so `indusk demo` copies the
  version that matches the install.
- **It is its own InDusk project**, with its own registry and the archived
  plan its promises came from. The promise scan skips any folder holding its
  own `.indusk/config.json`, and the example's files carry only its own
  promise tokens.
- **Plain OpenTelemetry, nothing else.** Each release is a span marked
  `upheld` or `violated` against `a-held-seat-is-released-in-time`.
- **A fault switch on the page, local only.** Break it makes releases late;
  Stop the fault makes them on time again, and the promise stays broken until
  the break is recorded and fixed. A deployed copy has no switch.
- **`indusk demo [dir]`** copies, initialises, installs and starts it.
- **It deploys to Fly**, and its own promise says its deployed page answers.

## Tradeoffs accepted

- A new command and a small example in the published package.
- Seats live in memory.
- Rejected: a separate demo repository (attention splits, it goes stale) and
  copying from GitHub with `degit` (needs the network, drifts from the
  install).
