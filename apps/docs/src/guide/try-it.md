# Try it in two minutes

InDusk's core idea fits in one small app: **a promise is a sentence about
what your running system will always do, and telemetry tells you the moment
it breaks.** The seat-holds example shows that, start to finish.

## 1. Start it

```bash
npx @infinitedusky/indusk-mcp demo
```

It copies the seat-holds example into `./seat-holds`, sets it up as an InDusk
project, starts the local telemetry daemon and the app, and opens the seat
page.

## 2. Watch the promise hold

The app makes one promise:

> **`a-held-seat-is-released-in-time`** — A seat that is held and not booked is released when its hold window passes, never late.

Hold a seat and don't book it. A few seconds later it comes free, and that
release is marked on its span, with plain OpenTelemetry:
`indusk.promise.outcome = upheld`. Open the admin (`indusk ui`), pick the
`seat-holds` project, and find the promise holding. Or, in the project:

```bash
indusk promises status
```

## 3. Break it

Press **Break it** on the seat page and hold another seat. This time its
release comes late on purpose. The span is marked `violated`, with a symptom
like `seat 3 released 4.1 s late`, and InDusk shows the promise broken, naming
the trace that broke it.

## 4. Stop the fault — and notice the promise stays broken

Press **Stop the fault**. Releases come on time again, but the promise is
still broken: it said *never*, and one late release breaks it however many
on-time ones follow. A promise holds again only once the break is recorded
as an incident, its cause written down, and fixed (`indusk promises fix`).

That is the loop: you promise, the system marks every time it keeps or
breaks the promise, and a break stays visible until someone fixes it on
purpose.

## Where to go next

- [`indusk demo`](/reference/cli/demo) — the command, its options and refusals
- [Promises](/guide/promises) — the three kinds, their states, how to write one
- [Always-on](/guide/always-on) — the same loop against production, with a server that tells Slack
- The example's [README](https://github.com/infinitedusky/indusk/tree/main/examples/seat-holds), including deploying it to Fly
