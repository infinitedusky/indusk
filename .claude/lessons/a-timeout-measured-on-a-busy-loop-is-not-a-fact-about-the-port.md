# A timeout measured on a busy loop is not a fact about the port — retry a timed-out connect before calling it closed

`isPortListening` gave a connection 500 ms. The timer runs on the caller's own event loop, and in the admin that loop belongs to `next dev`, which can hold it longer while it renders a page. When it does, Node's timer phase fires the timeout before the poll phase delivers a connect that already happened, and a listening port reads as closed. `daemonStatus` took that answer as a dead daemon and deleted its record, so every later read in the process said "no telemetry daemon is running" — found when the timeline added one more read to the Promises page's render and the watcher-blind page test began failing.

Why it matters: a check that deletes state on a negative answer must not produce negative answers from its own load. The deletion is right for a reused process ID; the error was trusting a timeout as evidence.

What to do: treat a refused connection as final, and a timeout as "try once more" — the second attempt runs on a loop that has just come free. More generally, a liveness check with a short timeout measures the checker as much as the target; do not act destructively on one timeout. Guarded by `lib/telemetry/port-listening.test.ts`, which holds the loop for 700 ms and requires a listening port to read as listening.
