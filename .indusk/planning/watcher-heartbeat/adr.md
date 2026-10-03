---
title: "The watcher proves it is watching"
date: 2026-10-03
status: proposed
---

# The watcher proves it is watching

## Goal

**"Nothing broke" is only ever reported by a watcher that has just proved it
can hear.**

On 2026-10-01 a test's leaked Jaeger answered on the default ports, and every
promise reader reported this repository's behaviour promises as healthy after
seven silent days — reachable read as listening. After this decision, a reader
that cannot get its own probe back says *watcher blind* instead of a count; a
deployed server that stops hearing its own heartbeat tells Slack once; and a
promise that is meant to fire regularly can say how silent is too silent.

## Y-Statement

**In the context of:**
the promise loop, whose readers — `promises status`, `promise_health`, the
admin's Promises page, `promises watch`, catchup — all read promise marks from
a Jaeger through `readPromiseMarks`, locally from a machine-global daemon of
two detached binaries, deployed from one always-on server per workbench.

**Facing:**
a reader that checks only that Jaeger *answers*: an answering Jaeger with
nothing arriving — the wrong process on the port, a broken intake, a dropped
pipeline — reads exactly like seven quiet, healthy days; and no local process
exists that could send a periodic heartbeat.

**We decided for:**
a probe inside `readPromiseMarks` — before reading any promise it sends one
span through the source's OTLP intake and reads it back, and when the span
does not return it throws `WatcherBlind`, which every reader reports as
*watcher blind* in place of counts, the probe result reused for 30 s per
source; on the always-on server, a heartbeat span sent by every pass into the
server's own intake, read back by the next pass, with one Slack message when
it goes stale and one when it recovers; and an optional `expect_every`
duration on a promise, past which silence from a listening watcher needs
attention.

**And against:**
a third detached heartbeat process beside the local daemon; the collector's
own self-traces; treating the evaluator's marks as a heartbeat; and a daemon
per project locally.

**To achieve:**
one answer to "was the watcher listening", given by every reader at once
because they share one read path, that cannot be faked by a process that
merely answers on the right port — and on the server, an alarm that does not
travel the path it reports broken.

**Accepting:**
a probe span written into Jaeger at most every 30 s per reading process; a
read that waits up to a few seconds for Jaeger to index the probe; and a local
answer about *now*, not *since when* — locally nothing runs between sessions
to have missed anything.

**Because:**
a probe that has to come back proves the whole path — intake, storage, query —
and the identity of the Jaeger on the other end, which reachability never did;
putting it in the one function every reader calls means no reader can forget
it; and the server already runs a 60 s pass, so its heartbeat needs no new
process either.

## Context

See [research.md](research.md) and [brief.md](brief.md). The local daemon is
`jaeger` + `otelcol`, detached, and nothing else; neither config emits on a
timer. Every reader reaches marks through `readPromiseMarks`
(`lib/promises/telemetry.ts`), which today throws `JaegerUnreachable` on any
failure to read and otherwise returns empty marks for an empty Jaeger. The
always-on server (`lib/telemetry/server.ts`) is a long-running process whose
pass (`lib/always-on/schedule.ts`, `pass.ts`) runs every
`INDUSK_SERVER_PASS_INTERVAL_MS` and emits no spans.

## Decision

**D1 — The probe, in the one read path.** `readPromiseMarks` begins with
`probeWatcher(source)`:

- It POSTs one OTLP/JSON span to the source's intake (`/v1/traces` on the
  local daemon's `otlpPort`, or the deployed server's intake with its
  credential): service `indusk-watcher`, span `watcher.probe`, attributes
  `indusk.project` (`markProjectId`) and `indusk.probe.id` (random).
- It queries the source's API for that probe id, retrying for up to 5 s
  (Jaeger indexes asynchronously).
- Found → the watcher is listening; the read continues as today. Not found →
  `throw new WatcherBlind(where, reason)`, a new error beside
  `JaegerUnreachable`, naming the intake it sent to and the query it read.
- The result is cached in-process for **30 s per source URL**, so the admin's
  five-second refresh probes twice a minute, not twelve times.

Every reader maps `WatcherBlind` the way it maps `JaegerUnreachable` today —
an explicit state, never zero: `promises status` and `promises watch` exit 2
naming both URLs; `promise_health` returns an error with `blind: true`; the
admin shows every behaviour chip hollow with "watcher blind — … sent, not
returned"; catchup says it on its own line ahead of the roadmap.

**D2 — The server's heartbeat.** Each pass, before reading violations:

- Read the newest `watcher.heartbeat` span from the server's own Jaeger. If
  it is older than `max(3 × interval, 3 min)` — or the read fails — the
  watcher is **blind**.
- Send this pass's heartbeat (service `indusk-watcher`, span
  `watcher.heartbeat`) into the server's own intake, with its basic-auth
  credential — the same door a project's marks use.
- The blind/listening state is kept in `<volume>/watcher-state.json`. A
  transition into blind posts once to Slack — "watcher blind since <newest
  heartbeat time>" — and a transition back posts once — "watcher recovered,
  blind from … to …". No message while the state holds. Slack is reached over
  HTTPS, not through Jaeger, so the alarm survives the failure it reports.

**D3 — The per-promise expectation.** A promise's frontmatter may carry
`expect_every: <duration>` (`30m`, `6h`, `1d`, through the existing
`parseDuration`). When the watcher is listening and the newest mark of that
promise, upheld or violated, is older than the duration (the read window is
widened to it when it is longer), the promise **needs attention**: "silent for
<age>, expected every <duration>" in `promise_health`, `promises status` and
the admin. `promises check` refuses an `expect_every` that does not parse.
`every-commit-evaluated` declares one here.

## Alternatives Considered

### A third detached heartbeat process locally

Rejected: another process for `daemonStop` and `verifyIdentity` to learn,
another thing to leak — the week this plan began with 860 leaked processes —
and it would prove only that *a* process can reach *a* port. The probe proves
the same path from the side of the reader that needs the answer.

### The collector's own traces (`service.telemetry.traces`)

Rejected: Jaeger traces its own work, and an idle Jaeger does no work, so
silence still produces silence — it cannot tell idle from deaf.

### The evaluator's marks as the heartbeat

Rejected: they are a promise's own signal, irregular by nature, and they
exist only where the evaluator runs. That is what D3 is for, per promise.

### A telemetry daemon per project locally

Rejected (Sandy, 2026-10-03: per-workbench applies to the deployment). It
reverses the local-telemetry decision for processes, ports and per-project
`.mcp.json` wiring; the probe is already per project, tagged with the
project's id.

## Consequences

### Positive
- No reader can report zero from a deaf watcher: they share one path, and the
  path probes.
- The founding case — a Jaeger that answers and is not this project's — is
  caught by construction.
- A deployed watcher that goes deaf says so once, through a channel that does
  not depend on it.

### Negative
- A probe span lands in Jaeger every 30 s per reading process; `indusk-watcher`
  becomes a service in Jaeger's list.
- A blind read waits up to 5 s before it says so.

### Risks
- **Jaeger's indexing lag exceeds 5 s under load** — a false *blind*.
  Mitigated by the retry window and by A1's real-daemon test; a false blind
  is loud and recoverable, the opposite of the failure it replaces.
- **The server's pass stops entirely** (process wedged) — no heartbeat, and
  nothing left to notice. Out of reach of an in-process check; the platform's
  own restart policy and `day-always-on-deploy`'s idle-hour step cover it.

## Documentation Plan

### Pages
- Update: `guide/promises.md` — *watcher blind*, and how it differs from
  unreachable.
- Update: `reference/cli/promises.md` — `status` and `watch` exit 2 when blind;
  `expect_every` in the promise file.
- Update: `reference/cli/telemetry-server.md` and `guide/always-on.md` — the
  heartbeat, `watcher-state.json`, the two Slack messages.
- Update: `reference/skills/catchup.md` — the blind line.

### Diagrams
- Mermaid in `guide/promises.md`: reader → probe → (returned → marks |
  not returned → watcher blind).

### Changelog
- Added: the watcher probe, the server heartbeat, `expect_every`.

### ADR in Docs
- `decisions/watcher-heartbeat.md` at close.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/archive/day-monitor/adr.md` (the mark, `promises status`)
- `.indusk/planning/archive/day-always-on/adr.md` (the server and its pass)
- `.indusk/planning/archive/local-telemetry/adr.md` (the machine-global daemon)
- [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md) (one instance per workbench)
