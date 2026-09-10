---
title: "The landscape"
date: 2026-09-08
status: draft
kind: paper
---

# The landscape

Paper two of three, split from [thesis.md](thesis.md) along the lines in
[papers-outline.md](papers-outline.md). Companions: [The pernicious
grift](paper-1-the-grift.md) and [The right way](paper-3-the-right-way.md).
**A diagnosis, not a method.** Written for the person deciding what to fund,
and for the engineer advising them.

## TL;DR

A business has a new capability that is real, fast, and rising, and two
pieces of advice about it. The engineer says it cannot be put on autopilot,
you still need us, and proposes a team that reads what the machine produces.
The vendor says your people cannot read fast enough, buy the machine that
reads it for them. Both are right that it cannot run loose. Both are wrong
about the fix, because both keep reading at the center, and reading is the
thing that does not scale. Underneath the advice is a failure mode nobody in
the room is naming: an agent goal-seeks toward green, the builder's testimony
is worth nothing, and nobody can tell whether what came back is what was
asked for, before it merges or after it breaks. The arithmetic is an order of
magnitude per engineer, taken as ten times the output or a tenth of the
people, never both, and a review layer built to keep both is the one
indefensible choice. The decision in front of the leader is which "you still
need me" to fund: the person who reads, or the person who designs the system
that proves things and improves it over time. This paper ends where the
problem is fully stated. Nobody can tell, the volume is rising, and reading,
by anyone, is not going to fix it.

## 1. The room

Two sentences get said in the same meeting, and both are true.

"We are not doing enough with AI." The board is asking. A competitor
announced something. The engineers on the team are already using it, whether
or not there is a policy, because the tools are good and the alternative is
being slow on purpose. Doing nothing is not on the table.

"We cannot just let this thing run loose." Also true. Something is producing
code, and documents, and decisions, at a rate no one on the team has ever
reviewed anything at, and it is going into production. Somebody has to be an
adult about it.

Into that room come two advisers.

The engineer says: this cannot go on autopilot. You still need us. A
responsible team is one where people read what the machine produces before
it ships, the way we have always read each other's work. Here is the
headcount that takes.

The vendor says: your people cannot read fast enough, and they never could.
Buy the tool that reads it for them. It reads every line, it leaves comments,
it scores the pull request. It is what everyone has been waiting for.

Both sound like adulthood. That is the landscape. This paper is about what
is underneath it.

## 2. What is possible now

What is possible now is genuinely new. A feature that took a week takes an
afternoon. Agents run in parallel on separate branches. A plan can execute
overnight with nobody watching. The throughput is real and it is only going
up.

And it is already how the team works, whatever the policy says. Everyone,
including the people who say otherwise, now describes the change, reads the
summary, runs the tests, and merges. They skim the diff at best. This is not
a lapse in discipline. It is the correct mode when generation is no longer
the bottleneck, and treating generation as the bottleneck is waste. The
senior engineer and the junior one are doing the same thing. The difference
between them is that one of them can say what the code was supposed to do
and knows how to tell whether it did.

That difference is the whole subject of this paper. Everything that follows
is about what happens when the volume goes up and nobody is checking the
thing that actually distinguishes them.

## 3. What is worth worrying about

The anxiety the throughput creates is real, and it is worth separating the
part that matters from the part that does not.

Not worth worrying about: whether the code is good. It usually is. Whether
anyone understood every line. Nobody ever did, in any codebase larger than
their head.

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
process wrote the test. It was never worth much from a human either. The
difference is that a human's testimony was expensive to produce and an
agent's is free, so there is now an unlimited supply of it.

And the thing underneath both: at this throughput, with this failure mode,
**nobody can tell.** Not the engineer who prompted it, not the reviewer, not
the organization. Not before it merges, and not after, when it breaks in
production at three in the morning and the only record of what anyone
intended is a stack trace. That is the concern. Not that the code is bad,
but that nobody has a way to know, and the volume is rising.

Both advisers in the room are responding to that concern. Neither has named
it. They have each named a symptom and proposed a reader.

## 4. The first answer: people read every line

The engineer's proposal, taken seriously, is to keep the old reviewer's job
and staff it up. The old job was *be a second author*: read the diff as if
you had written it, and catch what the first author missed. It is an
honorable job and it worked, at human velocity, for a long time.

It fails now for three reasons.

It cannot keep up. The reading was already the expensive part of review when
a person wrote the code. When a machine writes it ten times faster, the
reading is the whole cost of the team, and the team can never be large
enough.

So it becomes a rubber stamp within a month. Not because the reviewers are
lazy but because the queue is infinite and the pressure is real, and a
review that has to happen but cannot happen turns into a click. A rubber
stamp is worse than no review, because it launders the output. Things that
were never checked now carry a signature saying they were.

And it consumes the gain. A week's work produced in an afternoon, followed
by four days of reading it, is the old week with extra steps. The business
paid for the capability and then spent the entire dividend on the one
activity the capability did not make faster. It also produces nothing
durable: a reading lives in the reader's head, and next week's reader starts
from zero.

## 5. The second answer: the machine reads every line

The vendor's proposal deserves a fair description, because part of it is
right.

An AI that reads the diff is fast, and it is genuinely useful. A
Greptile-class reviewer finds real things in seconds: the unhandled error,
the off-by-one, the call that will not scale. Speed matters here in a way
that is easy to underrate. A finding thirty seconds after the push is worth
more than a better finding on Thursday, because the author still has the
change in their head. Keep the tool. Treat it as a linter with judgment.

What it cannot be is the thing you rely on. As the source of confidence, it
is worse than nothing, for four reasons.

**It has no stopping rule.** There is always something to say about code. A
reviewer with no contract to check against can only say "this could be
better," and it will say that forever. Nothing ever gets a verdict; things
get worn down until someone merges anyway.

**It produces a score, and a score is a target.** The builder is a
goal-seeking system. Put a number in front of it and it will optimize for
the number. Now you have an agent writing code to satisfy an agent reviewing
code, and neither of them is looking at what you asked for. Review becomes
theater on both sides.

**It reviews against the wrong thing.** A diff reviewer has general priors
about good code. It has no idea what you were trying to do. So its findings
are uncorrelated with your intent, and the ones that matter are buried in the
ones that do not.

**It slows everything down while proving nothing.** Every finding costs a
round trip. None of them answers the only question that matters, which is
whether the change does what was asked.

"Worse than nothing" is the right phrase and it needs the qualifier. Worse
than nothing *as the source of confidence*, because it produces the feeling
of review without the fact of it, and a feeling of review is exactly what
lets the volume rise unchecked.

## 6. The false choice

So the leader is being asked to choose between people reading and a machine
reading, and it is not a choice. Both are readings. Readings do not scale,
and a reading was never the judgment in the first place.

Consider what "I reviewed it" ever meant, even from a careful human. It meant
"I paid attention to this for a while and did not see a problem." That is
testimony about attention. It was never evidence about behavior. It was
accepted because attention was expensive and the person giving it had
something to lose. Neither of those is true of a reading now, from a person
under an infinite queue or from a machine with no idea what was intended.

The judgment was always a different question: is the thing that must be true,
true? What answers that is evidence that is not testimony, produced by
something other than the author, and it does not come from reading the code
at all. That is one sentence here, and how to build it is not this paper's
subject. What this paper needs from it is only this: both advisers in the
room have put reading at the center, and the center is empty.

## 7. Which "you still need me"

The engineer's instinct is right. This cannot run on autopilot, and someone
in the building has to be the person who knows whether the output is what
was asked for. The job they have proposed for themselves is the wrong one,
and it is worth being precise and unsentimental about why.

Part of it is fear, and it should be named without contempt. If the models
really make the work this easy, then fifteen years of getting good at it
were this easy, and nobody wants that to be true. "You still need me to read
it" is the answer that keeps it from being true. It is the same fear the
grifters sell to, felt by someone with a real craft to protect, and it
arrives in the leader's office sounding like caution because it is also
caution.

But it is quaint to believe that a person reading the code is a better judge
of it than the machine that wrote it. And it is equally wrong to believe the
machine reading it is the judge. Neither reader has what a judge needs,
which is a statement of what was supposed to be true and a way to check.

So there are two versions of "you still need me," and they are different
jobs.

The first: you need me to read what the machine produces. That job has no
future. It cannot keep up, it leaves no record, and it resets every morning.

The second: you need me to say what must be true, to build the system that
proves it, and to improve that system every time production shows it was
incomplete. That job compounds. Every claim proven stays proven. Every
failure in production sharpens a claim instead of adding a meeting. It is
the job the engineer was always doing underneath the typing, and it is the
one that gets more valuable as the volume goes up rather than less.

The leader's decision is which of these to fund. The first is the one being
proposed, because it is the one the fear can see.

## 8. The arithmetic

The gain on offer is roughly an order of magnitude per engineer. A business
takes that as ten times the output with the same people, or the same output
with a tenth of the people. It does not get both; that would be a
hundredfold, and that is not what is on offer.

The one indefensible choice is taking neither: keeping the headcount and the
velocity by inventing slow work to fill the gap. A review layer added to
protect jobs is exactly that. It looks like caution, it is staffed by the
people whose caution is most trusted, and it converts the entire dividend
into reading.

The ambitious choice, ten times the output, has a requirement that is easy
to miss. Ten times the output is ten times the claims that have to be true,
and ten times the ways for them not to be. Somebody has to build the thing
that proves them. That is the second "you still need me," and it is not
optional at the new scale. It is the only way the new scale is survivable.

## 9. Where this leaves the leader

Here is the landscape, fully stated.

The capability is real and the team is already using it. The failure mode is
that the builder goal-seeks and its testimony is free. The consequence is
that nobody can tell whether what came back is what was asked, before it
merges or after it breaks. The volume is rising. And every answer currently
on offer, from the engineer and from the vendor, is a reading, which is the
one thing that cannot scale and never was the judgment.

So the question in the room is not which reader to hire. It is what would
count as knowing. Until that question is answered, the careful option on the
table is not careful. It is the old pace, staffed by the people most afraid
of the new one, and it is how a company falls behind while feeling
responsible.

## What this paper is not

- **Not "AI review tools are bad."** They are fast and useful. They are not
  the verdict, and buying one as the verdict is the mistake.
- **Not "the engineers are obstructing."** Their instinct is correct. The job
  they have proposed for themselves is the wrong one, and the fear behind it
  deserves respect, not a rebuttal.
- **Not "go faster."** Adults are required. The point is that the careful
  option on offer is not careful.
- **Not a method.** A statement of the problem, ended where the problem is
  fully stated.
