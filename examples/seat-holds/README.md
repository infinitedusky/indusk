# Seat holds

A small app with one promise you can break on cue. It is the example InDusk's
demo starts from.

Hold a seat on the page and it is yours for a few seconds. If you don't book
it, it is released, and the app promises that release is never late:

> **`a-held-seat-is-released-in-time`** — A seat that is held and not booked is released when its hold window passes, never late.

Every release is marked with plain OpenTelemetry on the span that does the
work: `indusk.promise = a-held-seat-is-released-in-time` and
`indusk.promise.outcome = upheld` or `violated`, with a symptom like
`seat 2 released 3.2 s late`. Nothing else in the app knows InDusk exists.
InDusk reads those marks from your local telemetry daemon (or your project's
server) and shows the promise holding, or broken.

## Run it

The quickest way is from InDusk:

```bash
npx @infinitedusky/indusk-mcp demo
```

That copies this example into `./seat-holds`, sets it up as an InDusk project,
starts the local telemetry daemon and the app, and prints the page's address
and the admin's.

To run it by hand instead:

```bash
pnpm install
SEAT_HOLDS_FAULT_TOGGLE=1 \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
pnpm start
```

## Break it

With `SEAT_HOLDS_FAULT_TOGGLE=1`, the page shows a **Break it** switch. Turn it
on and releases come late on purpose: the next lapsed hold is marked
`violated`, and InDusk shows the promise broken with the span that broke it.
Turn it off and the promise holds again.

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | the page and the API |
| `SEAT_HOLDS_SEATS` | `8` | how many seats |
| `SEAT_HOLDS_WINDOW_MS` | `5000` | how long a hold lasts |
| `SEAT_HOLDS_TOLERANCE_MS` | `1500` | how late a release may be and still keep the promise |
| `SEAT_HOLDS_FAULT_TOGGLE` | unset | `1` shows the Break it switch |
| `SEAT_HOLDS_FAULT` | unset | `slow-release` starts with releases late |
| `SEAT_HOLDS_ENV` | `local` | `deployment.environment` on every span |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | where spans go: the InDusk daemon, or your project's server |

## What's in it

- `src/seats.ts` — the rules: hold, book, release, and whether a release was on time. The clock is an argument, so the tests never wait.
- `src/telemetry.ts` — OpenTelemetry, and one mark per release.
- `src/server.ts` — the page, the API, the fault switch, and the sweeper that releases lapsed holds once a second.
- `public/index.html` — the page.
- `.indusk/` — the example's promise and the plan it came from.

Seats live in memory, so a restart frees them all. That is fine for a demo and
wrong for anything else.
