---
title: "Premises — why we are building this, scored over time, and never a gate"
date: 2026-10-01
status: draft
rewritten: 2026-10-01
---

# Premises — Brief

**What this is:** a place to put the *why*. A project states what it is for and
how it will judge that; doubts and outside material are read against it by an
advocate and a critic; the human scores it, with a date and a reason; the reading
is prominent in the admin. It runs when the developer raises a concern, or when
something they asked to be told about happens — then the agent mentions it, in
one line, and offers an intake. It informs where time goes. It refuses nothing.

Rewritten the day it was drafted. The first draft made premises a mandatory brief
section re-checked at every phase start — a gate. That was the wrong kind of
mechanism for this job, and the section below says why.

## Problem

InDusk gates the work, and it should. Gates exist to defeat the biases that
show up while coding — skipping the test because it is annoying, checking an
item off because it feels done. Those biases are predictable, the right answer
is known in advance, and a refusal is the correct response.

Nothing in InDusk holds the other question: **where should the time go, and what
do I do with a doubt.** That question has no right answer known in advance. It is
qualitative, it moves, and it is different for every project:

- **Is this still worth building?** A plan is written against a picture of the
  world — what exists, what others are doing, what it costs. Other people are
  smart and are working on the same problem. Without a record written in
  advance, "we looked and we are still right" cannot be told apart from "the
  frame absorbed whatever it was shown."
- **Am I pointed right?** A different failure. The work can be good and the aim
  wrong: an engagement where the developer optimised for visibility on a
  prestigious team while the client's actual value ran through onboarding new
  customers, so the prestigious work was the easiest thing to cut. Nothing was
  wrong with any plan. What was wrong was never written down: what the developer
  needed out of the engagement, and what the other side valued.

Today a doubt arrives as noise — a thread where colleagues list how they develop
with AI, an article about a graph-shaped agentic workflow — and it has nowhere
to land. It is either waved through or it derails a week. Neither is a decision.

## Proposed Direction

**A project states its aim and the metrics it will judge it by. Outside material
is read against them by two assigned roles. The human scores. The score is a
reading, not a verdict.**

1. **The aim, at the project or workbench root.** Why this exists, what the
   person building it wants out of it, and three to five **metrics defined up
   front**, in their own words. A product: "nobody else is doing this better",
   "a stranger reaches the point of it in ten minutes". A client workbench: "I
   am being paid", "their growth runs through my work", "I would be hard to
   cut". The metrics are the user's; InDusk ships none.
2. **Premises under the aim.** Observable claims the aim rests on, each with
   what it threatens if it stops holding, each revision dated. Plans inherit the
   root's and may add their own; "none beyond the root's" is a complete answer,
   and so is having none at all.
3. **Two triggers, and only two.**
   - **A concern, raised directly.** The developer says it — "I'm not sure this
     is still worth it", "read this article" — and the agent files an intake.
   - **A watch firing.** The developer attaches a watch to anything they want
     guarded: a premise, an ADR decision, a lesson, a warning in their own
     words — "tell me if we start building something that depends on Linear",
     "mention it if a plan contradicts the worktree-per-plan decision". Watches
     are checked **when a research doc is about to be marked complete or a
     brief is about to be accepted** — before the status flips. Those are the
     two moments of commitment: research is where outside material lands and
     gets absorbed into the frame (the Aeon and Jev analyses both did), and
     brief acceptance is where building is decided. Both are the cheapest
     points to change course, and each is one judgment per document rather
     than per write. If the document runs against a watched item, the agent
     says so **once, in one line**, naming the item and the document, and
     offers an intake. The developer can decline
     and accept anyway; declining is recorded and nothing else happens.

   Nothing is checked that nobody watched. Checking every piece of work against
   every decision and lesson would fire on almost everything and be ignored
   within a week; the watch list is what keeps a mention worth reading.
4. **Intake.** New material — a document, a thread, a competitor, a doubt in one
   sentence, a watch that fired — is filed as an entry and read twice, by two
   roles that are **assigned, not discovered**:
   - an **advocate**, told to argue the material strengthens the aim;
   - a **critic**, told to argue it weakens it, given the premises and the
     material but **not** the project's own thesis.

   An agent told to disagree will disagree: its stance is compliance with its
   role, so **the stance is never evidence**. Only the arguments and their
   sources are. That is why there are two roles and why neither writes a score —
   each proposes a movement per metric, with sources, and stops.
5. **The score.** The human records a score per metric, with a date and a
   one-line reason, after reading both. Scores roll up to one reading on a
   bearish-to-bullish scale. **Every metric at zero is a legal state and blocks
   nothing.** The history is the signal: a reading that has slid for three weeks
   says something a single number cannot.
6. **A falling score asks a question; it does not answer one.** Every intake
   entry ends with **"what this changes"**, chosen by the human: nothing, a
   plan revised, new research opened, a direction dropped. A better approach
   discovered elsewhere is at least as likely to improve the project as to end
   it, and the mechanism must leave room for that. The mitigation is recorded
   beside the score that prompted it.
7. **Where it shows.** Prominently in the admin — the project header carries the
   reading, its trend and the last intake — as **one line** in the catchup
   summary, and as the one-line mention when a watch fires. Beyond a fired
   watch, the agent does not raise it during work.

**What it never does.** No validator rule, no refused brief, no blocked phase,
no outranking the roadmap, no repeated mention of a watch already declined. A
check with a known right answer belongs in a gate; this has none, so it belongs
in view — and in a single sentence when the developer asked for one.

## Context

- **The two intakes waiting.** A thread in which colleagues each described their
  AI development process, to be read for where it cuts with or against InDusk —
  are we doing what everyone does, and is someone doing it better. And an
  article on graph-shaped (DAG) agentic workflows, to be evaluated against what
  is built here. These are the plan's first two real entries and its acceptance
  test.
- **Intake has already happened twice here, with nowhere to put the result.**
  The Aeon case study in [user-zero/research.md](../user-zero/research.md) and
  the Jev analysis in [jev-decision-model/research.md](../jev-decision-model/research.md)
  are both outside systems read against InDusk, each ending in a verdict in
  prose and no movement recorded anywhere.
- **The rule this appears to break, and does not.** The pull-request shape
  ([indusk-v4-day/pr-shape.md](../indusk-v4-day/pr-shape.md)) says verdicts are
  binary and never a score, because a score is a target the *builder*
  goal-seeks. This score is set by the human about their own aims; no agent
  writes it and nothing is built toward it.
- **`/falsify`** (`/decisions/falsification-ritual`) is the template for the
  critic: goal-flipped, authoring arguments rather than acting on them.
- **Promises** (`/decisions/day-promises`) are claims about our system's
  behaviour, checked by telemetry, and a violation outranks the roadmap.
  Premises are claims about the world and about the builder's own aim, checked
  by judgment, and outrank nothing. Same idea of a declared claim with a dated
  state; opposite consequence.
- **The tier-one "goal set"** in the user-zero research — the creator's stated
  aims, changed only at a version boundary — is this same object seen from the
  product side.
- **Isolation is demonstrated.** A headless session started from an empty
  directory, given only what it is handed, was used on 2026-10-01 to measure
  context loading ([context-tiers/research.md](../context-tiers/research.md),
  Finding 4). The critic runs that way.

## Scope

### In Scope
- The aim record: its shape, where it lives, user-defined metrics.
- Premises under it, dated revisions, inheritance down the declared plan
  hierarchy.
- Watches: declaring one against a premise, decision, lesson or free-text
  warning; when work is checked against them; the one-line mention; recording
  a decline.
- Intake: the entry shape, the advocate and critic roles, the critic's
  isolation, "what this changes".
- Scores: per metric, dated, with a reason; the roll-up reading; history.
- The admin header reading and the one catchup line.
- The two waiting intakes, run through it for real.

### Out of Scope
- **Any gate** or refusal, and any check against items nobody watched.
- An agent setting, adjusting or defaulting a score.
- Automated monitoring or scraping of competitors or markets.
- Shipped metrics or templates of metrics. Examples in the docs only.
- Retroactively adding premises to existing plans.
- A write surface in the admin, which is read-only by decision; scores are
  written from a session on the user's word and displayed there.

## Success Criteria
- A project with no aim record behaves exactly as it does today; nothing asks
  for one and nothing refuses.
- An intake of an outside document produces an advocate reading and a critic
  reading, each citing specific passages of the material, each making at least
  one argument the other did not, and neither containing a score. (Opposite
  stances alone prove nothing — the roles guarantee them.)
- The critic is shown, not assumed, to have run without the project's thesis in
  its context.
- The human records a score with a reason; the admin project header then shows
  the reading and which way it has moved; the catchup summary carries one line.
- With every metric at zero, a plan can still be accepted, worked and closed.
- A brief about to be accepted, or a research doc about to be marked complete,
  that runs against a watched decision produces one mention naming the
  decision and the document; declining it is recorded and the same watch does
  not mention the same document again.
- A document that runs against an **unwatched** decision produces no mention.
- A concern stated in one sentence becomes an intake entry without the
  developer naming a command.
- Every intake entry ends with a "what this changes" line, including when the
  line is "nothing".
- The two waiting intakes each have an entry, two readings, a score and that
  line.

## Open Questions
- **The scale.** Zero-to-five per metric, or signed from bearish to bullish
  around a neutral middle? A signed scale says "this got worse" more plainly.
- **Where the records live**, and what kind of artifact they are. Like the
  promise registry they are plan documents — not code, not machine state — and a
  new tracked artifact must be registered with every "what changed" detector in
  the commit that first writes it.
- **The roll-up.** A plain average hides one metric at zero. Lowest-metric-wins,
  or show the spread rather than one number?
- **How the check is wired.** A hook on the edit that flips a research doc to
  `complete` or a brief to `accepted` (it can hand the model the active watches via
  `additionalContext` without blocking), or a step in the planner skill beside
  the existing brief-accepted highlight? The hook cannot be skipped; the skill
  step is simpler and the check refuses nothing either way.
- **What checking only at research and brief misses, accepted knowingly.** Drift after the brief — an
  ADR or impl heading somewhere the brief did not — is not re-checked;
  retrospective is the cheap second point if that proves to matter. A watch on
  an outside event ("tell me when Linear ships X") never coincides with a
  brief; it reaches the project only as a concern the developer raises.
- **Matching is judgment.** "Runs against" a decision is not a string match; the
  agent decides. A watch that never fires and one that is broken look the same,
  so a watch needs a way to be tested against a known example when declared.
- **A person's aims in a shared repository.** "I am being paid" belongs to one
  developer, not to the team's repo. A workbench is per-developer, which is the
  natural home; a normal-mode project needs an answer.
- **The name.** The folder says premises; the thing the user sees is the aim
  and its reading.

## Follow-On (later, not this plan)
- **The agent holding the aim as standing context**, so developer and agent
  work from the same picture outside of intakes. Where it sits belongs to
  [context-tiers](../context-tiers/brief.md), the plan that decides where
  context lives; whichever lands second adapts to the other.

## Depends On
- Nothing.

## Blocks
- Nothing.
