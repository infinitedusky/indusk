# A cache keyed by a name outlives what the name points at — key it by the thing itself

The admin's mark store was keyed by project and source name (`production`). Repointing `promises.jaeger.url` at another server kept the name, so the store went on drawing the old server's break as the new server's, and only read the new server from where the old coverage ended.

Why it matters: config changes are exactly when a person is watching closely, and the screen showed a break the new server never had.

What to do: key cached reads by what was read — here the source's resolved query URL — and drop the entries a new key replaces. Guarded by `http-promise-timeline-falsify.test.ts` (promise-timeline A16).
