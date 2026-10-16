---
name: a-new-project-is-told-the-truth
kind: state
lifetime: holds
state: declared
domain: scaffold
owner: a-new-project-starts-instrumented
sites: []
tests: []
incidents: []
clauses:
  - name: next-steps-exist
    kind: split
    statement: "Every command and file `init` tells a person to use exists."
  - name: the-skills-name-the-daemon
    kind: split
    statement: "The otel, testing and local-telemetry skills send a person to the local daemon, never to a vendor."
  - name: a-log-line-is-not-a-signal
    kind: limit
    statement: "No skill or template presents a log line as a promise's signal; a signal is a span."
---

What `indusk init` prints and the skills it installs name commands that exist, the daemon the promise loop reads, and the difference between a signal and a log line.

## History
- 2026-10-16 — declared (a-new-project-starts-instrumented), from its planning conversation.
