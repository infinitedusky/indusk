# A store that reads only what is new must still read what arrives late — "new" is when it arrived, not when it happened

The admin's mark store re-read only the last minute on each refresh, because it asked Jaeger for runs by when they ended. A run reaches Jaeger when its exporter sends it: a buffered exporter or a reconnecting app delivers a violation minutes after its moment. Such a violation landed behind the store's covered range and was never read. The chip stayed green.

Why it matters: reading incrementally was added to save bytes (A12) and it introduced a missed violation — the worst failure a promise watcher can have.

What to do: an incremental reader keyed by event time re-reads a late tail on every pass (here ten minutes) and the whole window on a bounded schedule (here every ten minutes), keeping what it holds. Guarded by `http-promise-timeline-falsify.test.ts` (promise-timeline A17).
