---
title: "Review — The landscape"
date: 2026-09-09
paper: paper-2-the-landscape.md
status: draft
---

# Review: The landscape

Two passes from `/write`, recorded without edits to the paper. Section numbers
are the paper's own.

## Read as the reader

1. **Who is the reader.** The business leader deciding what to fund, and the
   engineer advising them. The paper names both in its header line, which is
   the one thing this pass checks first, and it passes.

2. **Does the opening stand without the companion papers?** The TL;DR and
   section 1 stand alone; a leader who has never seen paper 1 or paper 3 can
   read them cold. The first sentence that assumes a companion is the header
   note: "Paper two of three, split from thesis.md along the lines in
   papers-outline.md." The first sentence inside the argument that assumes one
   is in section 7: "It is the same fear the grifters sell to." A reader
   without paper 1 does not know which grifters, and the sentence is doing
   work (it is why the fear "deserves respect"). One clause naming them (the
   people selling prompt courses to the non-technical) would free it.

3. **Does the close land as a finding?** Mostly. Section 9 states the verdict
   plainly: the careful option on the table is not careful. But its last
   paragraph pivots to "It is what would count as knowing," which is the
   question paper 3 answers, and the outline for this paper said in so many
   words not to end on "so what is left?" The paper ends one sentence past
   its finding, on the next paper's question. The finding is there; the
   cliffhanger is one sentence and could be cut or turned into a statement
   ("what the leader has to decide first is what would count as knowing").

4. **Terms or IDs the reader does not have.**
   - **"green"** (TL;DR, section 3: "an agent goal-seeks toward green"). This
     is the paper's central failure mode and the word is never defined. A
     leader does not know that green means the test suite passes. Section 3
     goes on to "a test that cannot fail" which gestures at it, but the load-
     bearing sentence arrives first, undefined.
   - **"diff"** (sections 2, 5, 6). Used nine times; never said to mean the
     list of lines a change adds and removes.
   - **"linter with judgment"** (section 5). "Linter" is undefined for a
     leader, and the sentence is the paper's positive advice about the vendor
     tool.
   - **"pull request"** (section 1: "it scores the pull request") and
     **"branches"** (section 2). Standard for the engineer; not for the leader.
   - **"Greptile-class reviewer"** (section 5). A named thing, which the voice
     sheet favors, but the leader may not know it is a product. The sentence
     before ("An AI that reads the diff") carries enough that it survives.
   - No plan IDs (`A2`, `Phase 3`) are cited. Good.

5. **What would this reader do differently?** The leader: decline to fund a
   read-every-line team; keep the AI reviewer as a fast first pass and refuse
   it as the sign-off; fund the person who states claims and builds the thing
   that proves them; ask "what would count as knowing" before approving any
   review layer. The engineer: stop proposing the reading job and propose the
   proving job. That is a real verdict with a decision attached, which is
   more than most landscape pieces earn. Its weakness is that the second job
   is described in one paragraph (section 7) and the leader cannot size it:
   how many people, how long, what it produces in the first quarter. The
   paper says "not this paper's subject" and that is a fair boundary, but the
   leader is being asked to fund something with no shape on the page.

## Falsify the argument

### 1. Strongest objection per section

- **TL;DR.** "Reading is the thing that does not scale" assumes the
  alternative does. Stating claims in English, getting them approved, and
  building a proving system is also human work per change; the paper never
  shows its cost curve is flatter than reading's.
- **1. The room.** The vendor is a straw man. Current AI review products
  pitch "catch defects before the human reviews," not "replace your
  reviewers," and most accept the PR description and linked issue as intent.
- **2. What is possible now.** "It is the correct mode" is asserted, and then
  the rest of the paper argues that nobody can tell whether the output is
  right. If nobody can tell, on what evidence is skimming correct rather than
  merely universal?
- **3. What is worth worrying about.** "Not worth worrying about: whether the
  code is good. It usually is." Two sections later, an AI reviewer "finds real
  things in seconds: the unhandled error, the off-by-one." Both cannot be
  true at the same rate. Also, "testimony from the builder is worth nothing"
  is right when the same process wrote the test and the code, and the paper
  says so, then generalizes past it; an independently authored passing test
  is evidence.
- **4. People read every line.** Treats "read every line" as the only human
  option. Sampled review, risk-tiered review, and review of the boundary
  files only are all human readings that do scale, and the paper's own
  paper 3 ends up keeping one of them ("the only code anyone has to read").
- **5. The machine reads every line.** The four reasons attack a reviewer
  with no contract. Give the same tool the approved claims and three of the
  four reasons weaken. And the "a score is a target" objection applies with
  equal force to any binary gate the paper's alternative proposes; a
  goal-seeker games a checkbox as readily as a number.
- **6. The false choice.** "A reading was never the judgment." Security,
  performance, and architecture review are judgments that cannot be made
  without reading, and the paper concedes in paper 3 that bad judgment
  "stays a human call." A hostile expert says you cannot exercise judgment on
  what you have not read.
- **7. Which "you still need me."** "It is quaint to believe that a person
  reading the code is a better judge of it than the machine that wrote it."
  Section 3 said the machine that wrote it has testimony worth nothing. The
  sentence concedes that same machine is at least as good a judge as the
  human reader. And "Every claim proven stays proven" is false on its face:
  code moves, dependencies drift, tests rot. Paper 3 says a test proves a
  claim once.
- **8. The arithmetic.** "Roughly an order of magnitude per engineer" is the
  paper's most falsifiable number and it has no support. The best-known
  controlled measurement to date (the METR randomized trial of experienced
  open-source developers, mid-2025; confidence high that it exists, moderate
  on the exact figure) found those developers slower with AI tools on their
  own repositories, and the field studies that show gains report tens of
  percent, not 10x. Paper 1 hedges its 3x as "illustrative"; this paper does
  not hedge its 10x, and the leader's decision is computed from it.
- **9. Where this leaves the leader.** "How a company falls behind while
  feeling responsible" has no example. Some of the most successful software
  organizations run the heaviest review cultures.

### 2. Claims asserted without support, by sentence

- "Everyone, including the people who say otherwise, now describes the
  change, reads the summary, runs the tests, and merges." (section 2)
- "It usually is." (section 3, of code quality)
- "This is not malice and it is not rare." (section 3; no rate)
- "So it becomes a rubber stamp within a month." (section 4; the timeline)
- "A Greptile-class reviewer finds real things in seconds." (section 5;
  plausible, unsourced, and it names one vendor)
- "It has no idea what you were trying to do." (section 5; not true of tools
  that read the PR description or linked spec)
- "Every claim proven stays proven." (section 7)
- "The first is the one being proposed, because it is the one the fear can
  see." (section 7; motive attributed to the engineer)
- "The gain on offer is roughly an order of magnitude per engineer." (section 8)
- "A review layer added to protect jobs" (section 8; motive attributed)
- "It is how a company falls behind while feeling responsible." (section 9)

### 3. Where the papers disagree with each other

- **The arithmetic.** This paper (section 8): ten times the output with the
  same people, or the same output with a tenth of the people, "never both."
  Paper 1 (sections 11 to 13): the good future is reading three, where
  ambition grows and you need three times as many people. Paper 2's binary
  excludes the future paper 1 argues for.
- **The engineer.** This paper (section 7, and "What this paper is not"): the
  engineer's instinct is correct and the fear "deserves respect, not a
  rebuttal"; "not 'the engineers are obstructing.'" Paper 1 (sections 5 to
  7): the engineer's stance is a grift, "the more dangerous of the two," and
  their habits are "the most actively harmful." A reader of both will ask
  which the author believes.
- **What stays proven.** This paper (section 7): "Every claim proven stays
  proven." Paper 3 (Traces): "A test proves the claim held once, on the
  author's machine, against the scenario the author thought of."
- **Duplication, not disagreement.** Section 2 here is paper 1's section 5
  nearly verbatim (the senior engineer who skims); sections 3 to 5 here are
  paper 3's section 1 nearly verbatim. Each paper stands alone, which is the
  design, but a reader of the set reads the goal-seeking paragraph three
  times.

### 4. Which the author should answer, and which are the reader's

**Answer in the text:**
- Define "green" where it first appears; the central claim is unreadable to
  the named reader without it.
- Source the 10x or hedge it the way paper 1 hedges its 3x. As written it is
  the sentence a hostile expert will use to dismiss the paper.
- Reconcile "the code is usually good" with "finds real things in seconds."
- Fix or cut "better judge than the machine that wrote it"; it undercuts
  section 3.
- Replace "stays proven" with something paper 3 agrees with.
- Acknowledge sampled or risk-tiered review as a third human option, even to
  reject it; ignoring it makes section 4 look like it chose the weakest
  opponent.
- Decide, with paper 1, whether the engineer's caution is a grift or deserves
  respect. Both papers cannot carry both.

**The reader's to weigh:**
- Whether the vendor pitch is a straw man.
- Whether skimming is "correct" or merely what everyone does.
- Whether judgment can be exercised without reading.
- Whether companies with heavy review are in fact falling behind.
