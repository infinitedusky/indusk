---
title: "Nothing here is self-reported"
date: 2026-10-05
status: draft
kind: paper
---

# Nothing here is self-reported

*A manifesto for the InDusk interface. Drafted 2026-10-05 from Sandy's
direction: build the successor to Linear, with the contract as the key
primitive.*

## What Linear got right

Linear launched against the ritual that had grown around agile: the
ceremonies, the fields, the tools that were slow because nobody who built them
used them. It kept the parts of the practice that make software move —
short cycles, small scoped projects, issues written plainly — and refused the
rest. It was fast, opinionated and built for the people doing the work. That
was the right instinct, and it won.

## Where it stops

A Linear issue is "In Progress" because someone dragged it there. A cycle's
burndown falls because people closed tickets. A project is "On Track" because
its lead said so. Every status in the system is a person's report about the
work, and the system has no way to check it. However fast and well made, that
is still management theatre: a picture of the work, kept up by the people who
should be doing it.

As the tools add agents, it gets worse, not better. An agent can move a ticket
to Done as easily as a person can, and with less reason to be right.

## The primitive is the contract

InDusk's unit is not the ticket. It is a contract with the system, at three
levels, and each level carries its own truth:

- **Premises** say why this should exist. They are judged by a person, because
  "is this still worth building" has no answer known in advance — but never on
  feeling alone: each judgment rests on an evidence report the system pulls
  together from the project's context and its telemetry.
- **Promises** say what will stay true. They hold or they fail, and the running
  system reports which, in production, continuously.
- **Phases** say what gets built. A phase is complete when its tests pass, and
  not before.

The hierarchy is functional as well as conceptual. A phase exists to keep a
promise; a promise exists because a premise holds. A failing promise reopens
the phase that owns it. A premise that stops holding questions every promise
built on it.

## What follows

1. **Nothing here is self-reported.** No status field anywhere is something a
   person types. Every badge traces to evidence: a test run, a production mark,
   an evidence report. A person's judgment appears where judgment is the point —
   scoring a premise — and it is shown as a judgment, with its date and its
   reason.
2. **Production is the first screen.** What the running system is doing to its
   promises is the most important thing the tool knows, and the thing
   ticket-trackers structurally cannot show.
3. **The ritual is the machine's.** Gates, tests-first, the checks that keep the
   work honest: the system enforces them and does not ask anyone to perform
   them. A person sees the three truths, not the machinery that produced them.
4. **Say what you know, never more.** A source that cannot be read is said. A
   window that may be missing runs says "at least". Silence is never drawn as
   health.
5. **Fast, and made by people who use it.** Linear was right about this, and it
   still decides whether anyone stays.
