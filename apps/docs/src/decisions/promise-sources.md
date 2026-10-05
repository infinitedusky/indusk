# Promise Sources

A project read one Jaeger — its laptop daemon, or the server `promises.jaeger`
names — and nothing said which. A developer building a change could not see
the one thing that matters while building: the same promise green in
production and red on the laptop. This decision reads both, side by side, in
every reader, and lets only one of them raise the alarm.

Full ADR: `.indusk/planning/archive/promise-sources/adr.md`.

## What was decided

**Sources are derived, not configured.** Every project has `local`, its
telemetry daemon. A project that names `promises.jaeger` also has
`production`. No list in the config, no migration: a project that names
nothing has one source and behaves exactly as before.

**One read per source, failure per source.** `readSources` returns each
source's marks or its failure — unreachable or blind, where it looked, why. It
never throws for one source. Falsification widened what counts as a source's
failure: a malformed `promises.jaeger` is production's refusal by key, not a
crash, and a source that never answers fails within the reader's timeout
instead of stalling the other.

**Production raises the alarm.** The alarm source is production when there is
one, otherwise local. `promise_health`'s top-level `needsAttention`, the admin
sidebar's red, `status`'s exit code and catchup's "raise first" all come from
it. A local-only break is shown under `local` and not raised: during
development it is work in progress.

**Every reader shows every source.** `status` prints a section per source;
`promise_health` adds `sources`; the admin draws a chip per source, the alarm
source's first. `watch --source deployed` reads production and `local` reads the
laptop — the flag chooses what is read, not only the incident's label.

**One module.** Sources and their reads live in `lib/promises/sources.ts`
(`promises/sources`); `telemetry.ts` is how to ask one Jaeger. The split ended
an import cycle between the query layer and the probe.

## Tradeoffs accepted

- **The status exit code follows the alarm source**, refined from "any source
  failed". A laptop with no daemon beside a production that answered exits 0,
  and says local's failure in its section. "Any source" would have failed every
  status run on such a laptop, and broke an existing test that asserts exactly
  that case.
- **No merged "worst of both" health.** It would hide the picture the demo needs
  and turn every local experiment into a production alarm.
- **Two sources, not a list.** A `promises.sources` list is the obvious next step
  when a third source (staging) is asked for; nobody has asked yet.

See also: [`indusk promises`](/reference/cli/promises), the
[promises guide](/guide/promises#local-and-production), and the
[lessons](/lessons/promise-sources).
