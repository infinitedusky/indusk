---
title: "The pernicious grift"
date: 2026-09-08
status: draft
---

# The pernicious grift

Paper one of three, split from [thesis.md](thesis.md) along the lines in
[papers-outline.md](papers-outline.md). It absorbs
[obsolescence.md](obsolescence.md). Companions: [The
landscape](paper-2-the-landscape.md) and [The right
way](paper-3-the-right-way.md). **A critique, not a method.**

## TL;DR

There is real skill in building with these tools, and it is not where it is
being sold. Two grifts are running on one playbook. To the person who cannot
see inside the machine: the skill is in how you talk to it, learn the tricks
and you will be safe. To the engineer who can: nothing has moved, keep reading
the code and you are still the real thing. Both sell safety, and both sell it
through not changing the part that matters. Both work because the fear is real
for the first time: the thing does what you spent ten thousand hours becoming,
and everyone else seems to be doing it right. The technique on offer is
thinner than any that came before it, because the interface is a sentence and
the machine gets better at plain intent every release, while the stakes are
higher than any that came before. The skill that survives is the old one,
exposed: knowing what must be true and being able to tell whether it is. The
technology is one you can understand and grow with. There is no secret. And
the future people are afraid of has a cause, and it is not the tool.

## 1. Two feeds

The first feed looks like this. Ten prompts you are missing from your
toolbox. A certificate in prompt engineering. A weekend course that promises
you will ship an app by Sunday. "AI will not replace you; a person using AI
will." The cohort closes Friday. Frameworks with names, sold by people whose
product is the framework. Threads that begin "I built a SaaS in four hours"
and end with a link. The pitch is always the same: there is a technique, the
technique is secret, the secret is for sale, and the clock is running.

The second feed is quieter and has no checkout page. Real engineers read the
code. I am not a vibe coder. The post from the senior engineer about juniors
who ship things they do not understand. The craftsmanship thread. The company
blog about why they still do line-by-line review. The pitch here is the
opposite one: nothing has changed, the skill you have is the skill that
matters, keep doing what you did and you are the real thing.

These look like opposites. One says the skill moved, buy the new one. The
other says the skill did not move, hold on to the old one. They are the same
product sold to two customers, and this paper is about why it works and what
it costs.

## 2. What is real

The models are genuinely good. They write code that works, in most languages,
most of the time, faster than any person. They draft, summarize, translate,
analyze, and argue at a level that would have been science fiction four years
ago. The tools around them are real too. None of this is hype, and anyone
still arguing that the output is toy-grade has not used it recently.

The fear is real too, and that is what is new.

Every earlier wave had its panic. You do not understand social. Learn to
code. Move to the cloud. In each case the worst outcome was being behind,
which is to say uncool, or unfashionable, or in need of a skill you could
pick up in a season. The thing itself did not do your work. It was a place to
do your work, or a way to talk about it.

This time the thing does the work. Ten thousand hours at React, at contract
drafting, at financial analysis, at writing headlines that land, and now a
sentence gets most of it back in a few seconds. That is the first feeling,
and it is not irrational. The second feeling rides on top of it. Everyone is
having a conversation with this thing. Work is going through it. Other people
seem to know how, and you do not. Put the two together and what you get is
not "I am behind." It is "I will fail to have worth." That is different in
kind from every earlier panic, and it is why the oldest playbook in the
business lands harder this time than it ever has.

## 3. The same playbook, a thinner technique

None of the selling is new. Every technology that should, by definition,
make things easier arrives with someone explaining that it will actually make
your life harder unless you pay them. The pattern is older than software and
it will outlive this wave. On its own it would not be worth a section.

What is worth a section is how little there is to sell this time. Compare it
to social media, the last panic of this shape. There really was an algorithm.
It really did elevate some posts and bury others. There was a knowable system
you could be wrong about, a course could teach you its mechanics, and the
mechanics stayed put long enough to be worth learning. The technique was
real, even when the people selling it were not.

Here the interface is a sentence. The machine is trained to understand plain
intent, and it gets better at that with every release. Every trick that
worked in March is redundant by September because the model learned to do
without it. The "ten prompts" are ten ways of saying what you want, and the
whole trajectory of the technology is toward not needing them.

So the technique decays while the fear compounds. Highest stakes there have
ever been, thinnest skill there has ever been to sell against them. That
asymmetry is the whole of what is pernicious here. Everything else in this
paper is a consequence of it.

## 4. The first grift: the skill is in the prompt

For someone who has never seen the rest of the machine, the prompt is the
machine. It is the only part they touch. So when someone says the skill is in
how you talk to it, that sounds right, and there is no way to check it,
because there is nothing else in view to compare it against. Plausible and
unfalsifiable at once is the ideal shape for a product.

Notice where that puts the skill. In a thing you lack, that others have, on a
deadline. Not in what you know, which would be free and would already be
yours. In a technique, which is scarce and can be sold. It is also the one
location where nothing can be learned, because a trick is not a discipline.
It does not compound. It does not transfer. The next release deletes it.

Underneath the technique is the promise, and the promise is the part to look
at. Learn to use it properly and you will be safe.

"Properly" is not the lie. Learn the tools. Learn them in the ordinary way,
by using them, by being wrong, by getting better. Nobody should be talked out
of that.

"Safe" is the lie. No technique makes you safe from a thing that does your
craft. A better prompt does not change what the machine can do; it changes
how quickly you get it to do it, and the machine is closing that gap on its
own. What changes your position is what you and the people you work for do
with the capability, and that is the last third of this paper.

## 5. The second grift: nothing has moved

"Vibe coding" was coined in early 2025 as a half-joke: describe what you
want, accept what comes back, do not read the diff, iterate by running it. It
became an insult almost immediately. A vibe coder is someone who does not
really understand what they shipped. A real engineer reads the code.

Both halves of that are wrong.

The definition is right. That is how everyone builds now, including the
people who sneer at it. The senior engineer with twenty years of experience
describes the change, reads the summary, runs the tests, and merges. They
skim the diff at best. They are vibe coding. The difference between them and
the person they look down on is not that they read the code. It is that they
can say what the code was supposed to do, and they know how to tell whether
it did.

That is the whole distinction, and it has nothing to do with reading. **A
real engineer is not someone who reads the code. A real engineer is someone
who can state what must be true and can prove that it is.** That was always
the job. Writing the code was the expensive part, so it looked like the job,
and the people who could do it were called engineers. Now the expensive part
is cheap and the actual job is exposed.

So the second grift takes a true sentence, the skill that matters is the old
one, and attaches the wrong instruction to it: therefore keep doing what you
did. The comfort it sells is precise. You are not a vibe coder. You are a
real engineer. The reading is what makes you one.

Nobody charges for this. Engineers tell it to each other for free, in
threads, in review culture, in the tone of voice used for "juniors these
days." That makes it the more dangerous of the two grifts, because a thing
nobody is selling does not look like a sale.

## 6. Why the engineer is the one in the most precarious position

Not the most replaceable. The one whose old habits are the most actively
harmful, for two reasons.

The first is where the expertise lives. "I understand React inside and out"
was a true and valuable sentence. The expertise it describes is in the how:
which pattern, which hook, which way the framework wants you to do the thing.
That is exactly the part that got cheap. The asset did not become worthless;
acting on it the old way became a cost, because it consumes the gain. An
engineer who can now produce a week's work in an afternoon, and then spends
the rest of the week reading it line by line, has banked nothing. The
identity says the reading is the work. The arithmetic says the reading is the
waste.

The second is who defers to whom. The engineer's habits are the ones the
organization adopts, because the organization cannot evaluate the technology
itself and the engineer is the person in the room who can. So when the
engineer says "I am not a vibe coder, I read the code," the sentence does not
stay in the engineer's head. It travels into a leader's office and comes out
as a decision: a review team, a freeze, a sign-off step, a policy. The
engineer's comfort becomes the company's pace. And it resonates with the
non-technical people in that room for the same reason it resonates with the
engineer: it sounds like adulthood.

This precariousness is behavioral, not existential. It is about the
transition, not the destination. And it comes with a way out that the first
grift's customer does not get. The engineer already has the skill that
survives. They have just been told it is the wrong one.

## 7. Why it is predatory

People want to believe both stories. If the models really make the work this
easy, then the thing you spent ten thousand hours getting good at was this
easy, and nobody wants that to be true. So the grift has a willing customer
on both sides. The non-technical reader buys the idea that there is a hidden
technique, that it is hard, that it requires training, because the
alternative is worse than being fooled: the alternative is that there is
nothing to buy and the fear has no cure. The engineer buys the idea that
nothing has moved, because the alternative is that the expertise was cheap.

What makes this predatory rather than merely opportunistic is that the grift
knows this. Its product is not a technique, and it is not craftsmanship. The
first grift sells the feeling of having caught up. The second sells the
feeling of not having to. Both are sold to the people least able to tell
whether they have, at the moment they are most afraid. It finds the fear,
names it as a skills gap for one customer and a loyalty test for the other,
and charges for the cure or the comfort.

The damage goes beyond the money. It tells the non-technical reader that
their problem is technique, so they go looking for a better prompt when what
they actually have is a different problem. It tells the engineer that their
problem is discipline, so they go looking for a stricter review when what
they actually have is the same different problem. And it tells organizations
that adoption is a training question or a policy question, so they buy
training and get chaos, or buy reading and get slow.

## 8. A force to be survived

Strip away the two customers and the two products and what both grifts share
is a way of describing the technology. It is a force. It is going to take
over everything you do. You had better learn the tricks before other people
do, or you had better dig in before it gets to you. Either way, the
relationship on offer is survival.

Neither says the other thing, which happens to be true: this is a technology
you can understand. You can learn how it behaves, build with it, and grow
with it, the way people have with every tool that came before, and the
learning is ordinary. There is no secret and there is no siege.

The survival framing is the grift's real product, more than any prompt or
any review policy. And it does not stay in the feed. It follows the reader
into every room where decisions get made, and that is where the cost stops
being the course fee.

## 9. Where the skill actually is

The hard part was never getting the output. It never was. Getting output is
now the easy part, which is exactly why a whole economy has formed around
teaching it. You can sell a trick for the easy part. You cannot sell a trick
for the hard part, because the hard part has no trick.

The hard part is knowing what you want to be true, and being able to tell
whether what came back is that.

For the non-technical reader, that is the good news in this paper. Knowing
what you want to be true is domain expertise. The lawyer knows what the
clause must do. The marketer knows what the campaign must say. The analyst
knows what the number must mean. That knowledge used to sit behind a
production skill that was expensive to acquire, and it is now the thing that
matters most, because the production skill is what got cheap. There is
nothing to buy. There is something to practice, and it is the thing you
already know how to do.

For the engineer, it is the job that was always the job. State what must be
true. Prove that it is. Everything else was the expensive part, and the
expensive part is gone.

Neither of these has a secret. Both are learnable in the ordinary way: by
doing it, by being wrong, by getting better. The technology rewards that kind
of learning and punishes the other kind, because the trick stops working and
the understanding does not.

## 10. The future people are afraid of

The fear underneath both grifts is a picture of the future, and it is worth
looking at directly, because the cause of that future is not the one people
assume.

There is a far future in which robots do the work. For an electrician, that
is the one where small machines crawl the walls of a house and install the
wiring themselves, end to end, with nobody on a ladder. That future raises a
different set of problems and we are not close to it. Set it aside. Arguing
about it now is how the near future gets ignored.

The near future is the one that is already here, and it looks like this. The
old way of wiring a house was intuitive. A skilled person walked the site,
knew from experience where things go, and did the work by feel. That was
genuinely good, and it is worth saying so. But it is a much better experience
for everyone if the electrician can show the customer a three-dimensional
plan of exactly where every run and every outlet will go, and that plan has
been vetted by something trained on the best way to wire a house, and the
customer can put their own input directly into it before anyone touches a
wall. The craft is still the craft. What changed is that the intent is
written down, checked, and visible before the work starts.

That electrician is faster. Call it three times faster; the number is
illustrative and the argument does not depend on it.

## 11. The arithmetic, three ways

Here is where the fear comes from, and here is where it goes wrong.

**Reading one: fixed demand.** Three times faster means a third as many
electricians wire the same number of houses. Two thirds of the profession
needs a new one. This is the future people are afraid of, and it is the only
reading anyone talks about.

But it assumes the number of houses is fixed. It rarely is.

**Reading two: output grows.** Keep every electrician. Wire three times as
many houses. Each house is three times cheaper to wire, and more houses get
built because wiring is no longer the constraint it was. Nobody loses their
job; the work gets cheaper and there is more of it.

**Reading three: ambition grows.** Nothing says the house has to be cheaper.
Each house could instead be three times as elaborate, at the same price, for
the same labor: more circuits, better design, things that were not worth
specifying when specifying was expensive. Now, if you want to build at the
pace the technology allows, you do not need a third of the electricians. You
need three times as many.

All three readings are the same arithmetic. What differs is whether demand
and ambition are allowed to grow with capability. That is not a property of
the technology. It is a decision, and the people who make it are the people
who run the businesses.

## 12. The cause of the feared future

So the future people are afraid of has a cause, and the cause is not the
tool. It is a business that receives a threefold gain in capability and
decides to keep building the same house at the same complexity at the same
pace. That business has exactly one way to realize the gain, which is to shed
people, and the people pay for the business's lack of ambition.

The fear is real because that business is common. Most organizations are not
willing to move at the speed their people can now move. They are structured
around the old constraint, and when the constraint disappears they do not
know what to do with the slack except cut it.

That is what should be worried about, and it is what should be worked on.
Not how to protect the old pace, and not how to sell people courses about a
skills gap that does not exist. How to find, build, and incentivize the
businesses that will run at the new speed, and the people who can run one.
Right now those people are rarer than the people who can build at the new
speed, and that gap, not the one between workers and their tools, is the one
that determines which of the three futures arrives.

## 13. It is easier to be an electrician now

There is a second effect that the fixed-demand reading misses entirely. The
work got easier to enter. The vetted plan carries knowledge that used to live
only in a master electrician's head. A person with less experience can now do
work that used to require more, because the intent is written down and
checked before they start. The barrier to entry fell.

That matters for reading three. If ambition grows and three times as many
electricians are needed, they have to come from somewhere, and the same
technology that made each one faster made it possible for more people to
become one. The profession can grow to meet the demand it created. That is
not a consolation prize. It is the mechanism by which the good future is
reachable at all.

## 14. Back to the two feeds

The electrician is not a metaphor. It is the same structure.

The three-dimensional plan, vetted before work starts, is knowing what must
be true, written down where it can be checked. The customer putting their own
input into the plan is the non-technical reader's domain expertise, now in
the loop directly instead of translated through someone else's production
skill. The craft done by feel is what everyone does now and should stop being
ashamed of. And the barrier to entry falling is the same event as the
engineer's how becoming cheap: more people can do this work, because the part
that took ten thousand hours is now done by the machine and the plan.

The first grift's customer is afraid of reading one and is being sold a
trick against it. The second grift's customer is afraid of reading one and is
being sold the old pace against it. Reading one is a choice made by someone
else, in a room neither of them is in. The work worth doing is making
readings two and three the ones that happen, and the way to do that is not
to learn the ten prompts, and not to slow the engineer down until the old
business can keep up. It is to build the businesses that can keep up with the
engineer.

## What this paper is not

- **Not "AI will not replace people."** It will, a lot of them, and it
  should. The cause of the bad version of that future is above, and it is not
  the tool.
- **Not "do not learn the tools."** Learn them, in the ordinary way. The lie
  is safety, not learning.
- **Not "engineers are obsolete."** The job that survives is the one that was
  always the job, and engineers are the people who already know how to do it.
- **Not "the instinct to be careful is wrong."** This cannot run loose. What
  to do about that is a different question, with a different reader, and it
  is not answered here.
- **Not a method.** A diagnosis of a sale.
