# Promise Timeline

The Promises page showed one chip per source, and the chip could not tell a
live break from a fixed one: a promise read *violated* for a week after its
fix landed. This decision gives every behaviour promise a history, one strip
per source, and one rule for what a break's colour means.

Full ADR: `.indusk/planning/archive/promise-timeline/adr.md`.

## What was decided

**An incident records when it was fixed.** `indusk promises fix <incident>`
writes `status: fixed` and `fixed: <now>`, and returns the promise to
`enforced` when no other incident of it is open. It refuses an incident whose
root cause is still unwritten.

**One rule for a violation's state.** `violationState` says *unrecorded*,
*open* or *fixed*. The chip and the strip both call it, so they cannot
disagree. Production's chip follows the incidents: purple `fixed` once every
violation in the window is fixed. Local's chip, beside production, follows
the newest local run, because nobody records an incident for a break during
development.

**One reader for a window.** `readTimeline` reads a source's marks between two
moments through the one query, `marksBetween`, keeping only the compact facts
(when, outcome, trace, environment). A query that fills is halved down to a
minute, and what still fills says "at least".

**The admin keeps what it has read.** A week of one promise's runs can be
megabytes, because Jaeger returns whole traces, and the page refreshes every
few seconds. The admin's store reads only what it has not covered, keyed by
the server it read. Falsification widened "what it has not covered":
- every refresh re-reads the last ten minutes, for runs that arrive late;
- the whole window is read again every ten minutes;
- a window too slow for one refresh is read newest first, in slices, each
  kept as it lands.

**Drawing.** A row is a strip of cells fixed to the clock: 96 for 24 hours,
84 for 7 days, 90 for 30 days. Each cell takes the worst state among its runs,
and each incident is a band beneath it. A break older than the window still
says "violated N ago — open".

## Tradeoffs accepted

- The store is per admin process: a restart starts empty, and the first load
  after it reads the whole window.
- A run later than ten minutes is found within ten minutes more, not at once.
- Grouping the table moved to `contract-ui`, which replaces the table with the
  premises → promises → phases hierarchy.
- The tests that pin the store's rules boot `next dev` and Jaeger servers, and
  take minutes. `test-kinds` moves them to unit tests through clock and reader
  seams.
