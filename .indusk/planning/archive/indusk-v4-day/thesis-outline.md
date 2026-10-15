---
title: "Thesis — outline and arc"
date: 2026-09-04
status: draft
---

# Thesis — outline and arc

Paragraph-by-paragraph map of [thesis.md](thesis.md): what each paragraph is
trying to do and why it sits where it does. Use this to judge whether a
paragraph is earning its place, and to see the arc without re-reading the
prose.

## The arc in one line

Concede that generation is solved → locate the real anxiety, its origin in
what the technology implies about the work, and how the grift weaponizes it
(genuinely predatory: it sells permission to keep believing the work was
hard) → retire the shame about how we build → separate the deserved worry
(nobody can tell) from the undeserved one → show the obvious fix makes it
worse → present the only evidence that is not testimony (tests and traces) →
show what the pull request and the reviewer become → say who is building it
and what it costs → point to the obsolescence piece for the question this
paper leaves open.

Every section ends on the question the next section answers. The reader
should never be told where we are going; they should keep asking the next
question themselves.

## TL;DR (opening paragraph)

**Achieves:** the whole argument in one breath, so a reader who stops here
still has the thesis. **Why first:** the paper is polemical and long enough
that a reader needs to know the destination before trusting the detours.

## 1. The grift, and where the anxiety actually lives

**Purpose of the section:** earn the right to be critical by first conceding
what is real, then relocate the reader's anxiety from "producing code" to
"knowing whether it is right." The paper's problem statement, delivered as an
attack so it is read.

1. *The industry selling technique.* Name the target: certificates, weekend
   courses, named frameworks, "built it in four hours" threads. Establishes
   tone and gives the reader something they already resent.
2. *What is real.* Concede fully that the models are good. Without this the
   paper reads as skepticism and loses everyone who has used the tools.
3. *What is not real.* The hard part was never getting output. The hinge of
   the whole paper: you can sell a trick for the easy part, not the hard
   part. Everything later is "what the hard part is."
4. *None of this is new.* The grift is perennial: every easier technology
   arrives with someone selling the claim that it is harder. Said briefly so
   the next paragraph's "what is new" lands.
5. *What is new: people want to believe it.* If it really is this easy, then
   the work they spent years on was this easy. The grift has a willing
   customer because the alternative is worse than being fooled. This is the
   origin of the anxiety: not the technology, what it implies about the work.
   The paper's diagnosis of its reader.
5a. *The grift knows this.* What makes it predatory rather than
   opportunistic: its product is permission to keep believing the work was
   hard, sold to the most afraid at the moment of most fear. Names the fear
   as a skills gap and charges for the cure.
6. *The damage.* Two victims: the engineer sent looking for a better prompt,
   and the organization that buys training and gets chaos. Introduces the
   organizational reader, who returns in section 6.
7. *Two sources of anxiety, one deserved.* The identity fear (handed to
   section 2, which dissolves it) and the real one: not knowing whether the
   result is right. First statement of the real problem.

→ *Is building this way something to be ashamed of?*

## 2. We are all vibe coding, and that is good

**Purpose:** remove the shame so the reader can think clearly. If "not
reading the code" is a sin, the rest of the paper (which says stop reading
the code) is unhearable. Also delivers the paper's definition of an
engineer.

1. *Define vibe coding and its stigma.* Neutral definition, then the insult.
2. *Both halves are wrong.* Short, blunt paragraph; a beat.
3. *The definition is right.* Everyone does it, including the senior engineer
   who sneers. The distinction is not reading; it is being able to say what
   the code was for and tell whether it did it.
4. *The reframe.* A real engineer states what must be true and proves it.
   Writing code was the expensive part, so it looked like the job. Now the
   actual job is exposed. This sentence is the thesis in miniature.
5. *Retire the stigma.* Vibe coding is the correct mode because generation is
   not the bottleneck.

→ *If everyone is vibe coding and that is fine, what is left to worry about?*

## 3. What is worth worrying about

**Purpose:** name the failure mode precisely so the reader stops worrying
about the wrong thing (code quality) and starts worrying about the right one
(nobody can tell). Sets up why review is necessary and why testimony is
worthless, both of which section 4 and 5 depend on.

1. *What is possible.* Throughput is real and rising. Establishes the scale
   that makes the problem urgent.
2. *Separate the anxiety.* One-line signpost.
3. *Not worth worrying about.* Code quality; understanding every line. Frees
   the reader from the old instinct.
4. *An agent goal-seeks.* The core mechanism: shortest path to green is not
   always the change asked for. Concrete examples (a test that cannot fail, a
   narrowed claim, a ticked checkbox). Not malice, a default.
5. *Testimony is worth nothing.* "I wrote a test and it passes" from the
   same process. The line every later section leans on.
6. *Nobody can tell.* Before merge and after, at three in the morning with
   only a stack trace. Plants the telemetry thread for section 5.

→ *If that is the concern, the answer is review. Right?*

## 4. The wrong way to solve it

**Purpose:** kill the obvious answer before offering ours, because the
obvious answer is what the market is currently buying. Also introduces the
two properties our answer must have: a stopping rule, and no score.

1. *Yes, and the obvious way is the worst.* Accept the premise, reject the
   execution.
2. *The obvious way.* Keep the second-author job, hand it to a model. State
   it attractively so the reader recognizes their own instinct.
3. *Worse than nothing, four reasons.* Signpost.
4. *No stopping rule.* Always something to say about code; nothing gets a
   verdict.
5. *A score is a target.* The goal-seeker optimizes the number; agent
   satisfies agent; theater.
6. *Reviews against the wrong thing.* Generic priors, no intent; the findings
   that matter are buried.
7. *Slows everything while proving nothing.* Round trips that never answer
   the only question.
8. *Human mandate fails faster.* Rubber stamp within a month, which launders
   the output. Closes the door on "just read more carefully."

→ *If reading is out, what is left?*

## 5. Tests and traces

**Purpose:** the constructive core. Present the two artifacts as one claim at
two moments, explain why each failed historically and why it works now, then
show what the pull request and the reviewer become. Longest section by
design; everything before it was clearing the ground.

**Intro paragraph.** Two artifacts, same claim, before and after. Names the
pairing ("tests and traces") and states they are the only evidence that is
not testimony. Reframes engineering as building around them.

### Tests

1. *TDD and BDD, and why each died.* TDD: the test needed a reader as skilled
   as the author. BDD: the English-to-test binding was hand-maintained and
   drifted. Historical grounding so the idea does not sound new.
2. *Same failure.* The check was a reading; readings do not scale. Ties to
   section 4.
3. *Why now.* The agent writes the test from the claim (binding automated);
   mutation proves the test means the sentence. The paper's "why now"
   argument in one paragraph. Bold line: models closed the gap between a
   sentence and its proof.
4. *What a test can carry.* Claim approved before code; red before green,
   machine-recorded; bound; amended in the open; uncovered surface listed.
   This is the pre-merge half of the PR shape, in prose.

### Traces

1. *A test proves the claim once.* Production is where the claim meets
   scenarios nobody wrote. Telemetry as the other half of the evidence, not
   an ops concern.
2. *Telemetry records intentions.* The specific reason it matters: a span
   that carries its claim is a record of what everyone meant. Plan, approver,
   code site, request, one vocabulary.
3. *The outage without intent.* Postmortem reconstructs from stack traces;
   the conclusion is sociological; each outage adds a layer of process; the
   system gets slower and no safer. The reader has lived this.
4. *The outage with intent.* The trace names the claim, the claim names the
   plan and the test; a specific, solvable problem; the fix is one claim, not
   a new layer. Then the paper's most valuable object: a test that passed
   while production broke, which only production can produce.
5. *Build it correctly to begin with.* Define the plan, test what needs
   testing, track what needs tracking. Three moments, one vocabulary. The
   section's thesis stated plainly.

### The pull request, and the reviewer

1. *The PR has a shape; the question changes.* Signpost.
2. *Is it correctly structured?* The inventory question.
3. *Does it prove its own validity?* The evidence question: binary verdicts,
   produced by something other than the author.
4. *The reviewer's job.* Read claims, read verdicts, probe with executed
   answers, read only the uncovered code, stop when there are no more
   questions. Delivers the stopping rule section 4 said was missing.
5. *Neither side reads code.* Both understand software; the shape catches
   dishonesty and drift, not judgment; judgment stays human and that is why
   the human is worth it.

→ *Who is building this?*

## 6. What InDusk is doing about it

**Purpose:** land the argument on something that exists, state the adoption
principle for the organizational reader from section 1, and be honest about
cost so the paper does not become the grift it opened by attacking.

1. *The opinionated path.* One sentence; InDusk is a path to the shape with
   checks along the way.
2. *The boundary is fixed, the path is free.* The adoption principle. Each
   artifact pulls its discipline in behind it. Nobody is handed a process; a
   team that reaches the shape another way has met the standard.
3. *Three pieces.* Dawn (any executor), Midnight (traces speak claims), Day
   (the human at the boundary). Ship as one thing.
4. *No free lunch.* Callback to section 1. This is the hard part and costs
   what hard parts cost: implement it, learn it, change how you think and
   structure work, learn to read the artifacts. The curve is load-bearing.
   Costs on the first task, pays on the tenth.
5. *The shape is the product.* Pointer to pr-shape.md; not a better way to
   write code but a way to know, before and after, at velocity.

## What this paper is not

**Purpose:** pre-empt the five misreadings that would let a reader dismiss
it. Each bullet is a misreading and its correction, one line each, except
the first, which is the paper's most contestable claim and gets its
argument in full.

1. *Not "AI will not replace engineers."* It will and should; an order of
   magnitude per engineer; output or headcount, not both; absorbing the gain
   into slow work is the indefensible choice; the remaining job is the one
   that was always the job.
2. *Not "tests are enough."* A test proves a claim once; only a trace proves
   it against the scenarios nobody imagined.
3. *Not a process.* A boundary.
4. *Not free.* Learning curve, load-bearing.
5. *Not a claim the code is correct.* A claim that reading is no longer how
   anyone will find out.

## Closing pointer

**Purpose:** acknowledge the problem the first "not" bullet opens and this
paper does not solve, so the paper is not read as indifferent to it. One
sentence, pointing to [obsolescence.md](obsolescence.md), which carries the
argument in full: the electrician, the arithmetic three ways, the cause of
the feared future, the falling barrier to entry, and the map back to
software.
