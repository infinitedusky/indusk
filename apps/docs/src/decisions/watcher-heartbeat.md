# Watcher Heartbeat

The promise loop could only say whether Jaeger *answered*. On 2026-10-01 a
leftover test Jaeger answered on the default ports, and every reader reported
this repository's promises healthy after seven silent days. "Nobody could
hear" read as "nothing broke". This decision makes every report of health come
from a watcher that has just proved it can hear.

Full ADR: `.indusk/planning/archive/watcher-heartbeat/adr.md`.

## What was decided

**A probe in the one read path.** `readPromiseMarks` is the call behind
`promises status`, `promises watch`, `promise_health`, the admin and catchup.
It now sends one `watcher.probe` span through the source's OTLP intake and
reads it back from the query API before reading any promise. A probe that does
not come back is `WatcherBlind`, and every reader says *watcher blind*, naming
the intake and the query, with no counts. Because all five share the path, none
can forget the check. A probe that came back is trusted for 30 seconds per
source, and the probe never waits longer than its caller allows: 5 seconds for
the CLI, 2 for the admin.

*Against:* a third detached heartbeat process beside the local daemon, which
would be another thing to leak and would prove only that *a* process reaches
*a* port. Also against the collector's own traces (an idle Jaeger produces none)
and against the evaluator's marks (irregular by nature, and only where the
evaluator runs).

**A heartbeat on the always-on server's own clock.** Every pass sends a
`watcher.heartbeat` span into the server's own intake and reads the newest
back. When it is older than `max(3 × interval, 3 min)`, or cannot be read, the
watcher is blind. Slack hears once on going blind and once on recovering, over
HTTPS rather than through the Jaeger that broke. The state is recorded in
`watcher-state.json`, only after Slack accepts, and only once it is proven
writable. A restart while blind stays blind until a real beat lands.

**An opt-in `expect_every` per promise.** Silence from a listening watcher is
the good outcome for most promises. A behaviour promise about something known
to happen regularly can say how silent is too silent. Past that, it needs
attention in every reader, judged by one function, `silencePastExpectation`.

**A named server names its intake.** A deployed server's OTLP intake is a
different address from its query API, so `promises.jaeger.otlp_url` sits
beside `url`. A server named without it reads blind. This was found during the
build; the ADR had not named it.

## Tradeoffs accepted

- A probe span lands in Jaeger at most every 30 seconds per reading process,
  and `indusk-watcher` appears in Jaeger's service list.
- A blind read waits up to its caller's timeout before saying so. A Jaeger
  slower than 2 seconds to index reads blind in the admin: a false alarm, but a
  loud and recoverable one, the opposite of the failure it replaces.
- Locally the answer is about *now*, not *since when*. Nothing runs between
  sessions to have missed anything.

See [the promises guide](/guide/promises#watcher-blind) and
[the heartbeat](/reference/cli/telemetry-server#the-heartbeat).
