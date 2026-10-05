---
title: "Nothing here is self-reported"
date: 2026-10-05
status: draft
kind: paper
---

# Nothing here is self-reported

*A manifesto for the InDusk interface. Drafted 2026-10-05 from Sandy's
direction: build the successor to Linear, with the contract as the key
primitive. Revised the same day so that it says what
[the aim](../plan-premises/aim.md) says, and what the conversations behind the
aim settled.*

## What Linear got right

Linear launched against the ritual that had grown around agile: the
ceremonies, the fields, the tools that were slow because nobody who built them
used them. It kept the parts of the practice that make software move, short
cycles, small scoped projects, issues written plainly, and refused the rest.
It was fast, opinionated and built for the people doing the work. That was the
right instinct, and it won.

## Where it stops

A Linear issue is "In Progress" because someone dragged it there. A cycle's
burndown falls because people closed tickets. A project is "On Track" because
its lead said so. Every status in the system is a person's report about the
work, and the system has no way to check it. However fast and well made, that
is still management theatre: a picture of the work, kept up by the people who
should be doing it.

As the tools add agents, it gets worse, not better. An agent can move a ticket
to Done as easily as a person can, and with less reason to be right. Software
is now built by agents whose work cannot be taken on trust. A builder like
that cannot also be the one who reports on the work.

## The primitive is the contract

InDusk's unit is not the ticket. It is a contract with the running system, at
three levels, and each level carries its own truth:

- **Premises** say why this should exist. They are judged by a person, because
  "is this still worth building" has no answer known in advance. But never on
  feeling alone: each judgment rests on an evidence report the system pulls
  together from the project's context and its telemetry. Its strongest
  evidence is what a promise cannot carry: an expectation of how people will
  use the thing, written down in advance and checked against what they did,
  and what those people say about it in their own words.
- **Promises** say what will stay true. A person states them, in plain
  language: "a person can always log out", "checkout never charges twice". A
  promise stays that person's even when an agent drafts the words. It holds or
  it fails, and the running system reports which, in production,
  continuously. A promise is named before the code exists, so the report
  arrives already meaning something.
- **Phases** say what gets built. A phase is complete when its tests pass, and
  not before. The plan behind a phase can be written anywhere: in InDusk's own
  documents, or in the tracker a team already has. Its status cannot be typed.

The hierarchy is functional as well as conceptual. A phase exists to keep a
promise; a promise exists because a premise holds. A failing promise reopens
the phase that owns it. A premise that stops holding questions every promise
built on it.

That is what makes the building self-correcting, and a system like that
corrects toward whatever it is held to. So the promises come from the person.
If the builder also wrote what it is judged against, the system would correct
toward what the builder wanted.

## What a person does here

The interface has two jobs: writing the promises, and managing the agents that
keep them. Scoring a premise is how a person decides what to promise next.

A person is asked whether a promise is right, and shown whether it was kept.
They are not asked to approve each step in between. Once the promise is
written, how the agents build toward it is theirs to choose.

That is why so little has to be on the screen. Other tools get simple by
leaving things out. Here the process decides what a person needs, so what is
left is essential and not merely small, and it is small enough to use from a
phone.

When a person wants more, they ask, and each answer is one step more concrete:
what happened, why, how it was built, and only then the code.

## What follows

1. **Nothing here is self-reported.** No status field anywhere is something a
   person types. Every badge traces to evidence: a test run, a production mark,
   an evidence report. A person's judgment appears where judgment is the point,
   in writing a promise and in scoring a premise, and it is shown as a
   judgment, with its date and its reason.
2. **Production is the first screen.** What the running system is doing to its
   promises is the most important thing the tool knows, and the thing
   ticket-trackers structurally cannot show. It shows promises, not spans, and
   an incident, not a chart. The telemetry is read by the agents, which can
   read all of it and know what was promised. A person reads what broke, where,
   and which work owns it.
3. **The ritual is the machine's.** Plans, gates, tests before code, review:
   they exist to make the promises hold and to catch it when they do not. The
   system enforces them and does not ask anyone to perform them. A person sees
   the three truths, not the machinery that produced them.
4. **Say what you know, never more.** When the tool cannot reach the running
   system, it says it cannot see. It never shows a zero or a green badge in
   place of an answer. When a count may be incomplete, it says "at least 12",
   not "12". No news is shown as no news, never as good news.
5. **Fast, and made by people who use it.** Linear was right about this, and it
   still decides whether anyone stays.

## The test

A person opens it and sees what the software promises, whether each promise
holds, and what is being built to keep them. They write a promise in a
sentence and never set a status. If it works, they say: this isn't doing that
much, but it's so powerful.

## What this is not

- **Not a telemetry dashboard.** In a telemetry tool, a person finds the
  problem and then works out what to do about it. Here that path is defined
  before the code is written, and a person sees only what it could not close.
- **Not a test language.** A promise stays a sentence in its author's words.
  The agents write the test and keep it; the person never maintains one.
- **Not the end of planning.** Plans, gates and tests before code still run
  underneath. They answer to the promises, and a person who wants to see them
  can.
