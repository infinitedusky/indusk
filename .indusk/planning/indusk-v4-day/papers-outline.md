---
title: "Three papers, from one draft"
date: 2026-09-08
status: draft
---

# Three papers, from one draft

[thesis.md](thesis.md) explains two fears with one cause. The engineer's fear,
that the expertise was cheap, is the grift's product. The leader's fear, that
nobody can tell what came back, is earned, and the draft's own section 3 says
so. Filing both under "the grift" is what makes the arc feel mixed: a
critique, a diagnosis, and a prescription, each ending on the next one's
question, so none of them can be handed to its own reader.

Three papers, three readers, three verdicts. Each stands alone: no section
ends on another paper's question, each opens with its own problem statement,
each closes on its own finding.

**Recommendation:** three, with [obsolescence.md](obsolescence.md) folded into
the grift paper as its second half. Its closing move, the barrier to entry is
falling and the skill is learnable, is the grift paper's counter-claim, and it
is currently stranded in a companion piece.

## Where the current draft goes

| Current | Goes to |
|---|---|
| TL;DR | Rewritten per paper |
| 1. The grift, and where the anxiety lives | Paper 1, rebuilt for a non-technical reader. The engineer's identity fear (1.5) goes to Paper 2 section 5; paragraph 6's organizational damage and paragraph 7's "real" anxiety go to Paper 2's opening |
| 2. We are all vibe coding | Paper 2 |
| 3. What is worth worrying about | Paper 2 |
| 4. The wrong way to solve it | Paper 2, with the Greptile correction |
| 5. Tests and traces, the PR, the reviewer | Paper 3 |
| 6. What InDusk is doing about it | Paper 3 |
| Not "AI will not replace engineers" | The sizing to Paper 2; the obsolescence half to Paper 1 |
| Not "tests are enough" / a process / free / a correctness claim | Paper 3 |
| obsolescence.md | Paper 1, part two |

## Paper 1. The pernicious grift

**Reader:** the non-technical professional whose feed says "10 prompts you
are missing," "AI will not replace you, a person using AI will," and "enroll
before the cohort closes." Managers, founders, marketers, anyone who cannot
check the claim and is being charged for that.

**Thesis:** there is real skill here, and it is not in the prompt. The grift
puts it there because the prompt is the only part of the machine its reader
can see, so "the skill is how you talk to it" sounds right and cannot be
checked. The real skill is knowing what you want to be true and being able to
tell whether it is, which is expertise the reader already has. The technology
is one you can understand, build with, and grow with. There is no secret.

**Verdict it closes on:** the future people are afraid of has a cause, and it
is not the tool.

1. **The pitch.** The ten prompts, the certificate, the weekend course, the
   four-hour SaaS thread. Kept from 1.1, re-aimed at the feed a non-technical
   reader actually sees. The tone is the product: a clock is running, the
   tricks are secret, everyone else already has them.
2. **What is real.** The models are good; the tools are real. Kept from 1.2.
   Say it plainly so the reader knows this is not a skeptic's paper.
3. **Where the grift puts the skill.** New, and the center of the paper. It
   does not say there is no skill. It says the skill is in how you address
   the machine. For someone who has never seen the rest of the machine, the
   prompt is the whole thing, so the claim is plausible and unfalsifiable at
   once. That is the location chosen for you: a thing you lack, that others
   have, on a deadline. It is also the one location where nothing can be
   learned, because a trick is not a discipline.
4. **Where the skill actually is.** The hard part was never getting output
   (1.3). The hard part is knowing what you want to be true and being able to
   tell whether what came back is that. For this reader that is the good
   news: it is domain expertise, and they have it. The engineer's version,
   say what must be true and prove it, is one sentence here; Paper 2 carries
   it in full.
5. **Why it lands.** Rewritten. The engineer's fear (the work was cheap) is
   not this reader's fear and moves to Paper 2. This reader's fear is being
   left behind: a new thing arrived, other people seem to know it, and there
   is no way to tell what is true. That is the customer the grift is built
   for, because a person who cannot check a claim can only buy reassurance.
6. **Why it is predatory.** 1.5a, re-aimed. Its product is not a technique.
   It is the feeling of having caught up, sold to the people least able to
   tell whether they have, at the moment they are most afraid. It names the
   fear as a skills gap and charges for the cure.
7. **The framing that does the damage.** New. Not "learn this and grow" but
   "this will take over everything, and you had better know the tricks
   first." A technology described as a force to be survived rather than a
   thing to be understood. That framing follows the reader into whatever room
   they make decisions in, which is where the cost stops being the course fee.
8. **The future people are afraid of.** obsolescence.md, first three parts.
   The electrician is already a non-technical reader's example; keep it.
9. **It is easier to be an electrician now.** obsolescence.md, last two parts.
   The barrier to entry falls, the craft is still the craft, and the skill is
   learnable in the ordinary way. This is the paper's answer to section 3.

**Cut:** the italic hand-off to vibe coding. The engineer's identity fear
(1.5's "fifteen years were this easy") moves to Paper 2, section 5, where the
engineer advising the leader is the subject. The organizational damage line
moves to Paper 2's opening.

## Paper 2. The landscape

**Reader:** the business leader deciding what to fund, and the engineer
advising them.

**Thesis:** this is real, fast, and rising, and it cannot run loose. The
leader is hearing two answers and both keep reading at the center: the
engineer's "you still need me to read it" and the vendor's "buy the AI that
reads it for you." Neither is where confidence comes from. The question the
leader actually has to decide is which "you still need me" to fund.

**Verdict it closes on:** nobody can tell, the volume is rising, and reading,
by anyone, is not going to fix it.

1. **The leader's position.** New, from this conversation. There is a new
   technology and doing nothing is not on the table. The team is under
   pressure to do more with it. It also cannot be let loose. The advice
   arriving is "we cannot put this on autopilot, you still need us," which is
   true, and the job proposed behind it, a team that reads the machine's pull
   requests, is the one job with no future.
2. **We are all vibe coding, and that is good.** Section 2 kept whole.
   Everyone describes, skims, runs, merges, including the senior engineer who
   sneers. A real engineer states what must be true and proves it. Retire the
   stigma.
3. **What is worth worrying about.** Section 3 kept whole. Throughput is real;
   not code quality; the agent goal-seeks; testimony is worthless; nobody can
   tell.
4. **The two obvious fixes.** Section 4 with one correction. Humans reading
   every line becomes a rubber stamp within a month. An AI reading the diff is
   fast and genuinely useful as a first pass (Greptile is good, and speed
   matters), and it is not where confidence comes from: no stopping rule, a
   score the builder chases, no knowledge of intent. The false choice is
   human-reads versus machine-reads. Both are readings, and readings do not
   scale.
5. **Which "you still need me."** New. The engineer's instinct is right and
   the proposed job is wrong. The engineer's own fear, from the old section
   1.5, belongs here: if the work was this easy then fifteen years were cheap,
   and "you still need me to read it" is the answer that keeps that from
   being true. Name it without contempt; it is the same fear the grift sells
   to, felt by someone with a real craft to protect. The role that survives is designing the system
   that proves things and improving it over time. It is quaint to think a
   person reading is a better judge than the tool. It is equally wrong to
   think the tool reading is the judge. The judge is evidence that is not
   testimony, and someone has to build that.
6. **The arithmetic.** From "What this paper is not," bullet 1, promoted to a
   section. An order of magnitude per engineer. Ten times the output or a
   tenth of the people, never both. Inventing slow work to keep both is the
   indefensible choice, and a review layer built to protect jobs is exactly
   that.
7. **Close.** Nobody can tell, at rising volume, and every answer on offer is
   a reading. State it as a finding. Do not ask "so what is left?"

**Cut:** every italic hand-off (1 to 2, 2 to 3, 3 to 4, 4 to 5). Section 4's
"worse than nothing" narrows to "worse than nothing as the source of
confidence."

## Paper 3. The right way

**Reader:** the team that will do it, the reviewer who will approve it, and
the leader who funded Paper 2's answer.

**Thesis:** tests and traces are the only evidence in the system that is not
testimony. Build everything around them, give the pull request a fixed shape
with binary verdicts, and the reviewer gets a job with a stopping rule that
does not require reading code.

**Verdict it closes on:** it is not free, the curve is load-bearing, and it
pays on the tenth task.

0. **Problem statement, in its own words.** One paragraph, new. Agents
   goal-seek toward green, the builder's testimony is worthless, nobody can
   tell, and reading is out. Do not point at Paper 2. Say it.
1. **Tests and traces.** Section 5 intro: two artifacts, one claim, before
   and after.
2. **Tests.** Section 5, Tests: TDD and BDD died on reading; the agent binds
   sentence to test; mutation proves the binding; what a test can carry to
   the PR.
3. **Traces.** Section 5, Traces: telemetry records intentions; the outage
   without intent adds layers; the outage with intent names the claim; a test
   that passed while production broke; three moments, one vocabulary.
4. **The pull request and the reviewer.** Section 5, PR: two questions with
   answers; the reviewer's job and its stopping rule; neither side reads
   code; judgment stays human.
5. **The boundary is fixed, the path is free.** 6.2: the adoption principle;
   each artifact pulls its discipline in behind it; a team that reaches the
   shape another way has met the standard.
6. **What InDusk is doing.** 6.1, 6.3, 6.5: the opinionated path; Dawn,
   Midnight, Day; the shape is the product; pointer to pr-shape.md.
7. **No free lunch.** 6.4, closing. Implement it, learn it, change what
   "done" means; costs on the first task, pays on the tenth. Keep the grift
   callback as one clause ("anyone who says otherwise is selling you
   something"), not a section reference.

**Keep as "what this paper is not":** tests are enough; a process; free; a
claim the code is correct. Drop the first bullet; its two halves now live in
Papers 1 and 2.

## If two instead of three

Paper 1 stands alone either way. Papers 2 and 3 can merge into one "how a
business should build with AI" paper, with 2's sections as its first half. The
cost is length and a mixed reader: the leader deciding what to fund does not
need Tests and Traces, and the team implementing it does not need the
arithmetic. Three is the recommendation. Two is the fallback if the landscape
paper cannot earn its own verdict in draft.
