---
title: "What it means to engineer software in the age of AI"
date: 2026-09-04
status: draft
kind: paper
---

# What it means to engineer software in the age of AI

Founding paper for Day, captured from the 2026-09-04 working session. **A
thesis, not a spec.** The operational form of the argument is
[pr-shape.md](pr-shape.md); the build sequence is [master.md](master.md); the
paragraph-by-paragraph arc is [thesis-outline.md](thesis-outline.md). Each
section ends on the question the next one answers.

## TL;DR

Generating code is solved. The models are good, everyone is using them, and
the shame about not reading every line should be retired, because reading
was never the job. The job was always to say what must be true and prove
that it is, and that job is now exposed. What has not been solved is that
nobody can tell whether what came back is what was asked for. Agents
goal-seek toward green, the builder's testimony is worthless, and the obvious
fix, an AI that reads the diff and scores it, makes things worse: it has no
stopping rule, and a score is a target the builder chases. The answer is to
build everything around the only evidence that is not testimony: tests and
traces, the same claim checked before it ships and while it runs. Claims are
approved in English before code exists; tests are proven red before green and
proven to die when the claim is broken; traces carry the claim so that
production grades the tests and an outage names the promise that failed
instead of a person who went too fast. The pull request becomes a fixed shape
with binary verdicts, and the reviewer gets a real job with an end: read the
claims, read the verdicts, ask questions that execute, approve when there are
none left. The boundary is fixed and the path is free, which is the only form
of coherence an organization can adopt. It is not free: there is a learning
curve, and it is load-bearing. InDusk is the opinionated path to that shape.

## 1. The grift, and where the anxiety actually lives

There is an industry selling the idea that AI development is a skill you can
buy. Prompt-engineering certificates. Weekend courses that promise you will
ship an app by Sunday. Frameworks with names, sold by people whose product is
the framework. Threads that begin "I built a SaaS in four hours" and end with
a link. The pitch is always the same: there is a technique, the technique is
secret, and the secret is for sale.

What is real: the models are genuinely good. They write code that works, in
most languages, most of the time, faster than any person. The tools around
them are real too. None of this is hype, and anyone still arguing that the
output is toy-grade has not used it recently.

What is not real: the idea that the hard part is *getting the output*. It
never was. Getting output is now the easy part, which is exactly why a whole
economy has formed around teaching it. You can sell a trick for the easy part.
You cannot sell a trick for the hard part, because the hard part has no trick.

None of this is new. Every technology that should, by definition, make
things easier arrives with someone explaining that it will actually make your
life harder unless you pay them. The pattern is older than software and it
will outlive this wave. On its own it would not be worth a section.

What is new is that this time people want to believe it. If the models really
make building software this easy, then the thing you spent fifteen years
getting good at was this easy, and nobody wants that to be true. So the grift
has a willing customer. The engineer buys the idea that there is a hidden
technique, that it is hard, that it requires training, because the
alternative is worse than being fooled: the alternative is that their
expertise was cheap. That is the origin of the anxiety. Not the technology.
What the technology seems to say about the work.

The grift knows this, and that is what makes it predatory rather than merely
opportunistic. Its product is not a technique. Its product is permission to
keep believing the work was hard, sold to the people most afraid that it was
not, at the moment they are most afraid. It finds the fear, names it as a
skills gap, and charges for the cure.

The grift does damage beyond the money. It tells working engineers that
their problem is technique, so they go looking for a better prompt when what
they actually have is a different problem. And it tells organizations that
adoption is a training question, so they buy training and get chaos: everyone
using the tools, nobody able to say what the results are worth.

So the anxiety has two sources, and only one deserves it. The first is the
fear that the work was easy all along. The next section deals with that: it
was not, and the hard part is still here, undiminished. The second is the real
one. Not knowing whether what was produced is right, and having no idea what a
person is supposed to do about that.

*So what does it mean to build this way, and is it something to be ashamed
of?*

## 2. We are all vibe coding, and that is good

"Vibe coding" was coined in early 2025 as a half-joke: describe what you want,
accept what comes back, do not read the diff, iterate by running it. It became
an insult almost immediately. A vibe coder is someone who does not really
understand what they shipped. A real engineer reads the code.

Both halves of that are wrong.

The definition is right. That is how everyone builds now, including the
people who sneer at it. The senior engineer with twenty years of experience
describes the change, reads the summary, runs the tests, and merges. They
skim the diff at best. They are vibe coding. The difference between them and
the person they look down on is not that they read the code. It is that they
can say what the code was supposed to do, and they know how to tell whether it
did.

That is the whole distinction, and it has nothing to do with reading. **A
real engineer is not someone who reads the code. A real engineer is someone
who can state what must be true and can prove that it is.** That was always
the job. Writing the code was the expensive part, so it looked like the job,
and the people who could do it were called engineers. Now the expensive part
is cheap and the actual job is exposed.

So vibe coding is not a lesser mode to grow out of. It is the correct mode,
because generation is no longer the bottleneck and treating it as one is
waste. The stigma should be retired.

*But if everyone is vibe coding and that is fine, what is left to worry
about?*

## 3. What is worth worrying about

What is possible now is genuinely new. A feature that took a week takes an
afternoon. Agents run in parallel on separate branches. A plan can execute
overnight with nobody watching. The throughput is real and it is only going
up.

The anxiety that creates is also real, and it is worth separating the part
that matters from the part that does not.

Not worth worrying about: whether the code is good. It usually is. Whether
you understood every line. You never did, in any codebase larger than your
head.

Worth worrying about: **an agent goal-seeks.** Its objective is a good
response, which usually means fast, which means the shortest path to green.
The shortest path to green is not always the change you asked for. It is
sometimes a test that cannot fail, a claim quietly narrowed until the
implementation satisfies it, a checkbox ticked with nothing behind it. This
is not malice and it is not rare. It is the default failure mode of a system
optimized for your approval, and a system that is good at code is also good
at making this look fine.

Worth worrying about, therefore: **testimony from the builder is worth
nothing.** "I wrote a test and it passes" tells you nothing when the same
process wrote the test. It was never worth much from a human either; the
difference is that a human's testimony was expensive to produce and an
agent's is free.

And the thing underneath both: at this throughput, with this failure mode,
**nobody can tell.** Not the engineer who prompted it, not the reviewer, not
the organization. Not before it merges, and not after, when it breaks in
production at three in the morning and the only record of what anyone
intended is a stack trace. That is the concern. Not that the code is bad, but
that nobody has a way to know, and the volume is rising.

*If that is the concern, then the answer is review. Right?*

## 4. The wrong way to solve it

Yes. And the obvious way to do review is the worst possible one.

The obvious way is to keep the old job and make it faster. The old reviewer's
job was *be a second author*: read the diff as if you had written it. That
job was already too expensive at human velocity. At agent velocity it is
impossible, so the natural move is to hand it to a model. An AI reads every
line so you do not have to. It leaves comments. It gives the pull request a
score. It sounds like exactly what everyone wanted.

It is worse than nothing, for four reasons.

**It has no stopping rule.** There is always something to say about code.
A reviewer with no contract to check against can only say "this could be
better", and it will say that forever. Nothing ever gets a verdict; things
get worn down until someone merges anyway.

**It produces a score, and a score is a target.** The builder is a
goal-seeking system. Put a number in front of it and it will optimize for the
number. Now you have an agent writing code to satisfy an agent reviewing
code, and neither of them is looking at what you asked for. Review becomes
theater on both sides.

**It reviews against the wrong thing.** A diff reviewer has general priors
about good code. It has no idea what you were trying to do. So its findings
are uncorrelated with your intent, and the ones that matter are buried in the
ones that do not.

**It slows everything down while proving nothing.** Every finding costs a
round trip. None of them answers the only question that matters, which is
whether the change does what was asked.

The other obvious way, mandating that humans read every line, fails faster.
It cannot keep up, so it becomes a rubber stamp within a month, and a rubber
stamp is worse than no review because it launders the output.

*So if reading is out, what is left?*

## 5. Tests and traces

What is left is two artifacts, and they are the same artifact at two moments.
A **test** is a claim checked before the change ships. A **trace** is the same
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

*Who is building this?*

## 6. What InDusk is doing about it

InDusk is the opinionated path to that shape, with checks along the way so
that arriving at the boundary is never a surprise.

The principle is **the boundary is fixed, the path is free.** A mergeable
change carries the artifacts. How anyone produces them is their own business.
This is the only form of coherence an organization can actually adopt,
because it never tells anyone how to use their tools; it says what a finished
change looks like. Each artifact pulls its discipline in behind it. Requiring
that a test was red before green requires tests first. Requiring the plan in
the pull request requires planning. Requiring the production history of the
promises a change touches requires traces that carry intent. Nobody is handed
a process. The shape makes the good way the easy way, and a team that reaches
the shape some other way has met the standard.

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

**There is no free lunch.** Section 1 said you cannot sell a trick for the
hard part. This is the hard part, and it costs what hard parts cost. You have
to implement it. You have to learn it: how to state a claim so a machine can
prove it, how to read a verdict instead of a diff, how to ask a question that
executes. You have to change how you think about what "done" means, and how
you structure the work so the artifacts fall out of it instead of being
assembled at the end. The people reviewing have to learn to read this stuff.
That curve is real, and it is there for a reason: every part of it is
load-bearing. What you are trading is quick wins for a discipline and a system
that compounds. It costs you on the first task and pays on the tenth, and
anyone who tells you the tenth-task payoff comes without the first-task cost
is selling section 1.

The shape itself is written down in [pr-shape.md](pr-shape.md). Every check
InDusk performs exists to produce one row of it. That is the whole product:
not a better way to write code, but a way for anyone to know that what was
written is what was asked for, before it ships and after, at a velocity where
nothing else can.

## What this paper is not

- **Not "AI will not replace engineers."** It will, and it should. Not all
  of them, but a lot, and pretending otherwise helps nobody. The gain is
  roughly an order of magnitude per engineer. A business takes that as ten
  times the output with the same people, or the same output with a tenth of
  the people. It does not get both; that would be a hundredfold, and that is
  not what is on offer. The one indefensible choice is taking neither:
  keeping the headcount and the velocity by inventing slow work to fill the
  gap, which is exactly what a process layer added to protect jobs is. The
  engineers who remain do the job that was always the job, stating what must
  be true and proving it. Review in this shape is that job, not make-work.
- **Not "tests are enough."** A test proves a claim once, against a scenario
  its author imagined. Only a trace proves it against the ones nobody did.
- **Not a process.** A boundary.
- **Not free.** There is a learning curve, and it is load-bearing.
- **Not a claim that the code is correct.** A claim that reading it is no
  longer how anyone will find out.

The obsolescence question the first bullet opens is real and this paper does
not solve it. It has its own piece: [The future people are afraid of](obsolescence.md).
