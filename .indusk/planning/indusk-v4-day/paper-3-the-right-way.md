---
title: "The right way"
date: 2026-09-08
status: draft
---

# The right way

Paper three of three, split from [thesis.md](thesis.md) along the lines in
[papers-outline.md](papers-outline.md). Companions: [The pernicious
grift](paper-1-the-grift.md) and [The landscape](paper-2-the-landscape.md).
**A method, and what it costs.** The operational form of the argument is
[pr-shape.md](pr-shape.md); the build sequence is [master.md](master.md).

## TL;DR

Generating code is solved. The models are good, everyone is using them, and
the shame about not reading every line should be retired, because reading
was never the job. The job was always to say what must be true and prove
that it is, and that job is now exposed. What has not been solved is that
nobody can tell whether what came back is what was asked for. Agents
goal-seek toward green, the builder's testimony is worthless, and reading, by
a person or a machine, cannot answer the question. The answer is to build
everything around the only evidence that is not testimony: tests and traces,
the same claim checked before it ships and while it runs. Claims are approved
in English before code exists; tests are proven red before green and proven
to die when the claim is broken; traces carry the claim so that production
grades the tests and an outage names the promise that failed instead of a
person who went too fast. The pull request becomes a fixed shape with binary
verdicts, and the reviewer gets a real job with an end: read the claims, read
the verdicts, ask questions that execute, approve when there are none left.
The boundary is fixed and the path is free, which is the only form of
coherence an organization can adopt. It is not free: there is a learning
curve, and it is load-bearing. InDusk is the opinionated path to that shape.

## 1. The problem, in its own words

A feature that took a week takes an afternoon. Agents run in parallel on
separate branches. A plan executes overnight with nobody watching. Everyone
on the team builds this way now, whatever they call it: describe the change,
read the summary, run the tests, merge.

The builder is a goal-seeking system. Its objective is a good response, which
usually means fast, which means the shortest path to green, and the shortest
path to green is not always the change that was asked for. Sometimes it is a
test that cannot fail, a claim quietly narrowed until the implementation
satisfies it, a checkbox ticked with nothing behind it. Not malice, and not
rare. The default failure mode of a system optimized for your approval.

So the builder's testimony is worth nothing. "I wrote a test and it passes"
tells you nothing when the same process wrote the test. And at this volume,
with this failure mode, nobody can tell: not the engineer who prompted it,
not the reviewer, not the organization, not before it merges and not after it
breaks at three in the morning with a stack trace as the only record of
intent.

Reading does not fix it. People reading every line cannot keep up and become
a rubber stamp, which launders the output. A machine reading every line has
no stopping rule, produces a score the builder chases, and reviews against
general priors instead of what you meant. Both are readings, and a reading
was never the judgment.

What is left is the only evidence in the system that is not testimony.

## 2. Tests and traces

There are two artifacts, and they are the same artifact at two moments. A
**test** is a claim checked before the change ships. A **trace** is the same
claim checked while it runs. Tests and traces: before and after. Together
they are the only evidence in the system that is not testimony, and the whole
of engineering in this age is building around them instead of writing them at
the end.

### Tests

Test-driven development found half of this forty years ago and could not make
it stick, and it is worth being precise about why. To trust a test you had to
read it, because a test named *ensure customer always has an address* can
assert `1 == 1`. So the test needed a reviewer as skilled as its author, the
reading was as expensive as the code, and the discipline died on cost.
Behavior-driven development tried the other way: write the claims in plain
English and derive the tests. That died because the binding between the
sentence and the test was maintained by hand. Step definitions were code,
they drifted from the sentences, and the English layer became a lie everyone
stopped reading.

Both failures were the same failure. The check was a reading, and readings do
not scale.

What is different now is that the two things that killed test-first
development are the two things a machine can do. The agent writes the test
from the claim, so the binding is no longer hand-maintained. And a mutation
check proves the test still means the sentence: break the claimed behavior,
and the test must die. If it survives, it was never testing what it said.
**Models did not make this possible by writing good code. They made it
possible by closing the gap between a sentence and its proof.**

Once that gap is closed, a test can carry everything a reviewer needs before
merge: the claim in English, approved by a human before any code exists;
proof it was red before it was green, recorded by a machine rather than
asserted by the author; proof it is bound to its claim; every amendment to
the claim made in the open, because silent narrowing is the goal-seeker's
favorite move; and the list of changed code no claim exercises, which is the
only code anyone has to read.

### Traces

A test proves the claim held once, on the author's machine, against the
scenario the author thought of. Production is the only place the claim meets
scenarios nobody wrote. That is why telemetry is not an operations concern
bolted on after the fact. It is the other half of the evidence.

But the reason telemetry matters is more specific than "you can see what
happened." Every system logs events. **Telemetry done right records
intentions.** When a span carries the name of the claim it was upholding
(this is the check that a seat is never double-booked, this is the path that
promised settlement within five seconds), the trace is no longer a list of
things that occurred. It is a record of what everyone involved *meant* the
system to do: the plan that made the claim, the engineer who approved it, the
code that enforces it, the request that exercised it. Intent, written down at
every layer, in one vocabulary.

Consider what an outage looks like without that. Something takes the system
down. The postmortem reconstructs intent from stack traces and git blame, and
because intent was never recorded, the conclusion is always sociological:
*we were going too fast. Nobody read that PR. We need another approval step.*
Each outage adds a layer: a checklist, a freeze, a review bot, a runbook, a
sign-off. Solutions on top of solutions on top of solutions, none of which
touch the cause, because the cause was never written down anywhere a machine
could point at it. The system gets slower and no safer, and the next outage
gets the same postmortem.

Now consider it with intent recorded. The trace names the claim that broke.
The claim names the plan that made it and the test that was supposed to
guard it. The story is clear and specific: this promise, on this path, after
this change, under a scenario that test did not cover. That is a solvable
problem, not a cultural one. The fix is a revision to one claim and its test,
not a new layer of process. And the most valuable object in the whole system
falls out of it for free: **a test that passed while production broke.** It
does not say the code failed. It says the assertion was insufficient, and it
says which one. Nothing inside a repository can produce that. Only production
can, and only if production speaks the language of claims.

So the answer to "why did this happen" stops being an argument and becomes a
reading of the record. Which is the point: **build it correctly to begin
with.** Define the plan. Test what needs to be tested. Track what needs to be
tracked after the fact. Three moments, one vocabulary. The claim that appears
in the plan is the claim that appears in the test is the claim that appears in
the trace, and a problem at any layer names the same thing.

### The pull request, and the reviewer

This turns the pull request into something with a shape, and the reviewer's
question changes from *is this code good?* to two questions with answers:

**Is this pull request correctly structured?** Does it carry everything I
need: the plan, the claims, the evidence per claim, the uncovered surface, and
the promises it touches with their production history?

**Does it prove its own validity?** Is every verdict binary and produced by
something other than the author? Red observed, green now, bound, covered,
enforced in production. Not a score. Not testimony.

And the reviewer gets a job with a skill and an end. Read the claims and ask
whether they are what was wanted. Read verdicts, not tests. Ask *what about
this?* and get an executed answer, never an argued one, so every question
either finds a defect or becomes a new claim. Look at the uncovered code, and
only that. Approve when every claim has a verdict and there are no more
questions. That is a stopping rule. Diff review structurally cannot have one.

Neither side reads code. Both sides have to understand software: trade-offs,
what a claim should say, what is missing, what a scenario looks like. The
shape catches dishonesty and drift, mechanically. It does not catch bad
judgment. You can be internally consistent and still build the wrong thing,
and that stays a human call, which is exactly why it is worth a human's time.

## 3. The boundary is fixed, the path is free

A mergeable change carries the artifacts. How anyone produces them is their
own business. This is the only form of coherence an organization can actually
adopt, because it never tells anyone how to use their tools; it says what a
finished change looks like.

Each artifact pulls its discipline in behind it. Requiring that a test was
red before green requires tests first. Requiring the plan in the pull request
requires planning. Requiring the production history of the promises a change
touches requires traces that carry intent. Nobody is handed a process. The
shape makes the good way the easy way, and a team that reaches the shape some
other way has met the standard.

## 4. What InDusk is doing about it

InDusk is the opinionated path to that shape, with checks along the way so
that arriving at the boundary is never a surprise.

The shape itself is ten artifacts, each proving one thing, each produced by
one discipline, each with a binary verdict: the plan, the contract of claims,
the amendment log, red observed, green at head, binding, the uncovered
surface, the probe log, promise linkage, and the process record. Three rules
apply to every row. Verdicts are binary, never a score, because a score is a
target and a verdict terminates. "Unverified" is a verdict, not a pass; a
check that could not run says so and never reports the reassuring case. And
nothing in the table is produced by the builder asserting it: two rows are
human approvals, one is the reviewer's, one is infrastructure's, and the rest
are machine observations.

Three pieces make it operational, and they ship as one thing:

- **Dawn** runs the loop with any executor. Plans as documents, gates that
  refuse the wrong edit, verification of work the loop did not do itself. Who
  executes is not the point; that the output is checked is.
- **Midnight** makes traces speak the language of claims. One promise name
  threads a plan, a test, a code site, and a span, so a violation in
  production names the claim that failed, grades the test that missed it, and
  reopens the plan that made it.
- **Day** is what the human does at the boundary. The PR shape, the evidence
  per claim, the probe, and a reviewer's job that does not require reading
  code.

Every check InDusk performs exists to produce one row of the shape. That is
the whole product: not a better way to write code, but a way for anyone to
know that what was written is what was asked for, before it ships and after,
at a velocity where nothing else can.

## 5. No free lunch

You cannot sell a trick for the hard part, and this is the hard part. It
costs what hard parts cost.

You have to implement it. You have to learn it: how to state a claim so a
machine can prove it, how to read a verdict instead of a diff, how to ask a
question that executes. You have to change how you think about what "done"
means, and how you structure the work so the artifacts fall out of it instead
of being assembled at the end. The people reviewing have to learn to read
this stuff.

That curve is real, and it is there for a reason: every part of it is
load-bearing. What you are trading is quick wins for a discipline and a
system that compounds. It costs you on the first task and pays on the tenth,
and anyone who tells you the tenth-task payoff comes without the first-task
cost is selling you something.

## What this paper is not

- **Not "tests are enough."** A test proves a claim once, against a scenario
  its author imagined. Only a trace proves it against the ones nobody did.
- **Not a process.** A boundary.
- **Not free.** There is a learning curve, and it is load-bearing.
- **Not a claim that the code is correct.** A claim that reading it is no
  longer how anyone will find out.
