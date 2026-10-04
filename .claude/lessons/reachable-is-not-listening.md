# A backend that answers is not one that hears — read health only after a probe you sent comes back

On 2026-10-01 a test's leaked Jaeger answered on the default ports, and every promise reader reported this repository's behaviour promises healthy after seven silent days. Each reader checked that Jaeger *answered*; none checked that it was receiving this project's telemetry. "Nobody could hear" read as "nothing broke".

Why it matters: an empty answer from the wrong backend, a broken intake or a dropped pipeline is indistinguishable from a quiet week by any check that only reads. A health read that cannot fail this way reports the reassuring answer exactly when it knows least.

What to do: before reading anything, send one span through the source's intake and read it back from its query API (`probeWatcher`, `lib/promises/probe.ts`, called first in `readPromiseMarks`). When it does not come back, say *watcher blind* — naming the intake and the query — and report no counts: no zero, nothing upheld. Every reader shares the one read path, so none can forget the probe. Cache a success briefly (30 s per source) so a refreshing page does not fill the backend with probes; never cache a failure. Guarded by `watcher-probe.test.ts` (A2).
