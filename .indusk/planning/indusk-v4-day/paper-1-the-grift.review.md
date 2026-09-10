---
title: "Review — The pernicious grift"
date: 2026-09-09
paper: paper-1-the-grift.md
status: draft
---

# Review: The pernicious grift

Two passes from `/write`, recorded without edits to the paper. Section numbers
are the paper's own. The paper is `published`; the published copy at
`~/code/site/writing/the-pernicious-grift.md` was read alongside the plan
copy, and the only source drift since `source_commit` 1ad363e1 is the
provenance block publish wrote back.

## Read as the reader

1. **Who is the reader.** The paper does not say. The outline
   (papers-outline.md) names the non-technical professional whose feed sells
   prompt courses: managers, founders, marketers, anyone who cannot check the
   claim. The draft as written addresses two readers, that one (sections 1
   to 4, 9) and the engineer (sections 5 to 7), and the outline describes a
   one-grift, nine-section paper; the draft is a two-grift, fourteen-section
   paper. The outline is stale against the published text, which the voice
   sheet says to state plainly. This pass reads as the non-technical
   professional.

2. **Does the opening stand without the companion papers?** No, and this is
   live on the blog. The first paragraph the published reader sees is:
   "Paper one of three, split from thesis.md along the lines in
   papers-outline.md. It absorbs obsolescence.md. Companions: The landscape
   and The right way." Five links: three to plan-internal documents that were
   never published, two to companion papers still in draft. On the site all
   five are dead, and the reader is told in the first sentence that they are
   holding one third of something. The TL;DR that follows stands alone
   completely; the paper's real first sentence is "There is real skill in
   building with these tools, and it is not where it is being sold," and it
   is a good one. The header note belongs in the plan copy only, or publish
   should strip it.

3. **Does the close land as a finding?** Yes. Section 14's last sentence,
   "It is to build the businesses that can keep up with the engineer," is a
   verdict, and the "What this paper is not" bullets do not reopen it. The
   fourth bullet ("what to do about that is a different question, with a
   different reader, and it is not answered here") points sideways without
   asking a question; it is a boundary, not a cliffhanger. Passes.

4. **Terms or IDs the reader does not have.**
   - **"the diff"** (section 5: "They skim the diff at best"). The whole of
     section 5 turns on this sentence and the non-technical reader does not
     know a diff is the list of lines a change added and removed. It is the
     one term that fails the reader where it matters.
   - **"React"** (sections 2 and 6: "Ten thousand hours at React," "I
     understand React inside and out"). Used as the example of expertise; a
     marketer does not know it is a web framework. One appositive would fix
     it.
   - **"which hook"** (section 6). Jargon inside the sentence that explains
     what got cheap.
   - **"runs the tests, and merges"** (section 5). Followable from context.
   - **"SaaS"** (section 1). The reader's feed says it; passes.
   - No plan IDs (`A2`, `Phase 3`) are cited. Good.

5. **What would this reader do differently?** Stop buying courses; practice
   stating what the output must be true of and checking it (section 9 says
   this plainly and it is the paper's gift to this reader); and, if they sit
   in a decision-making room, push for reading three (more ambition) rather
   than reading one (fewer people). That is a verdict. Its limit is that the
   paper's closing instruction, "build the businesses that can keep up," is
   addressed to "the people who run the businesses," and section 14 says
   reading one is decided "in a room neither of them is in." The named reader
   is told the future is chosen elsewhere. Section 9 rescues the paper for
   them; the close does not.

## Falsify the argument

### 1. Strongest objection per section

- **TL;DR.** "The technique on offer is thinner than any that came before
  it." Evaluation design, tool and context design, decomposition of work for
  agents, and reading a model's failure modes are skills that compound and
  survive releases. The paper conflates "prompt tricks" with "skill in using
  the tools," and the second is real.
- **1. Two feeds.** The second feed has no seller, no product and no price;
  calling it a grift is a category error the paper has to argue around three
  sections later ("Nobody charges for this"). A hostile reader says: then it
  is not a grift, it is a culture, and the paper wanted the symmetry more
  than the accuracy.
- **2. What is real.** "The thing does what you spent ten thousand hours
  becoming." Section 9 says the hard part was never getting the output. The
  paper first amplifies the fear it later diagnoses, and the amplification is
  the grift's own move.
- **3. The same playbook, a thinner technique.** "Every trick that worked in
  March is redundant by September" has no evidence and some counter-evidence:
  worked examples, structured output, decomposition, and stating acceptance
  criteria have persisted for years. And the social-media algorithm was also
  opaque and shifting; "a knowable system" is generous to the comparison.
- **4. The first grift.** "Plausible and unfalsifiable at once." Prompt skill
  is falsifiable in the most ordinary way: run two prompts, compare outputs.
  The reader does have something to check against, the output, and the paper
  says they have nothing.
- **5. The second grift.** "They skim the diff at best" is an empirical claim
  about senior engineers' behavior with no source, and it is false in
  regulated domains where line review is mandated and done. And the
  definition "a real engineer is someone who can state what must be true and
  can prove that it is" is chosen to make the argument work; it excludes
  design, taste and systems judgment, which the paper's companion (paper 3)
  says stay human.
- **6. The precarious engineer.** "The reading is the waste" with nothing on
  the page to replace it. The paper concedes in its last bullet that "this
  cannot run loose," so the engineer's habit is called harmful without the
  alternative being named even in one sentence. Also, "the organization
  cannot evaluate the technology itself and the engineer is the person in
  the room who can" is asserted.
- **7. Why it is predatory.** "The grift knows this." Predatory requires
  knowledge; opportunistic does not; the paper asserts the knowledge for a
  diffuse market of course sellers most of whom believe their product.
  Without the knowledge, the section's title is wrong.
- **8. A force to be survived.** "This is a technology you can understand."
  The models are famously not understood, including by their makers. The
  paper means "understand how it behaves in use," which is a defensible and
  different claim.
- **9. Where the skill actually is.** "There is nothing to buy" sits beside
  "learn the tools, in the ordinary way." Learning the tools costs time and
  sometimes money, and a course on evaluation and verification would be
  legitimate under the paper's own theory. The blanket "nothing to buy"
  overreaches.
- **10. The future people are afraid of.** The electrician imports physical
  constraints (houses, walls, ladders) that software does not have: near-zero
  marginal cost and demand untied to construction. The analogy's arithmetic
  may not transfer.
- **11. The arithmetic, three ways.** "It rarely is" (that demand is fixed)
  is the paper's most contested economic claim and it is a bare assertion.
  The historical record on automation and employment is mixed; demand is
  elastic for some professions and inelastic in the short run for others.
- **12. The cause of the feared future.** Blaming "a business's lack of
  ambition" ignores capital, market saturation and regulation. A firm cannot
  always choose reading three.
- **13. It is easier to be an electrician now.** A falling barrier to entry
  lowers wages for those already inside. That is the feared future in
  another form, and the section treats it as pure good.
- **14. Back to the two feeds.** "The electrician is not a metaphor. It is
  the same structure." The vetted, checkable plan on the software side is the
  thing paper 3 says InDusk is building, and pr-shape.md, the accepted
  document that defines it, marks five of its ten rows "missing." Section 10
  says "the near future is the one that is already here." The paper's
  counter-claim to the grift rests on a thing not yet built, which is the
  shape of the sale the paper is critiquing.

### 2. Claims asserted without support, by sentence

- "That is different in kind from every earlier panic." (section 2)
- "Every trick that worked in March is redundant by September because the
  model learned to do without it." (section 3)
- "The interface is a sentence." (section 3; agentic tooling has more
  surface than a sentence)
- "The machine is closing that gap on its own." (section 4)
- "They skim the diff at best." (section 5)
- "Nobody charges for this." (section 5; code-review and craftsmanship
  content is monetized)
- "The organization cannot evaluate the technology itself and the engineer is
  the person in the room who can." (section 6)
- "What makes this predatory rather than merely opportunistic is that the
  grift knows this." (section 7)
- "It rarely is." (section 11)
- "Most organizations are not willing to move at the speed their people can
  now move." (section 12)
- "Right now those people are rarer than the people who can build at the new
  speed." (section 12)
- "The near future is the one that is already here." (section 10; against
  the plan's own status)

### 3. Where the papers disagree with each other

- **The arithmetic.** This paper (sections 11 to 13): reading three, ambition
  grows and you need three times as many people. Paper 2 (section 8): ten
  times the output with the same people, or the same output with a tenth,
  "never both." Paper 2's binary excludes this paper's preferred future.
- **The engineer.** This paper (sections 5 to 7): the engineer's "I read the
  code" is a grift, "the more dangerous of the two," and the engineer's
  habits are "the most actively harmful." Paper 2 (section 7, and its "What
  this paper is not"): the engineer's instinct is correct and the fear
  "deserves respect, not a rebuttal." A reader of both will ask which the
  author believes.
- **Siege or no siege.** This paper (section 8): "there is no secret and
  there is no siege," a technology you can understand. Paper 2 (section 3):
  "a system that is good at code is also good at making this look fine,"
  and nobody can tell. A hostile reader says paper 2 is the siege paper 1
  denies.
- **What exists.** This paper (sections 10 and 14) and paper 3 (section 4)
  both present the vetted plan and the shape as present. Paper 2 (section 6)
  says how to build it is not its subject. The plan folder's status
  documents side with paper 2.
- **How much reading survives.** This paper (section 6): "the reading is the
  waste." Paper 3 (Tests): the uncovered surface is "the only code anyone has
  to read." Paper 3's narrowing is the defensible claim; this paper's
  absolutism does not carry it.
- **Duplication, not disagreement.** Section 5 here is paper 2's section 2
  nearly verbatim (the senior engineer who skims). Fine for standalone
  papers; a reader of the set reads it twice.

### 4. Which the author should answer, and which are the reader's

**Answer in the text:**
- The published header. Strip the plan-folder note from the rendered copy or
  have publish do it; today the blog's first paragraph is five dead links and
  a "one of three."
- Sections 10 and 14's tense. "Already here" and "the same structure" against
  pr-shape.md's five missing rows. Say "being built," or make the analogy
  about what the plan does when it exists.
- "The reading is the waste" needs one sentence naming what replaces it
  (evidence that is not reading), even if the argument lives in paper 2.
- "Nothing to buy" against "learn the tools." Say what is legitimately
  learnable and paid for, so the claim is precise instead of total.
- "Predatory" needs the knowledge it asserts, or a weaker word.
- Name the reader in one line, and decide whether the engineer is this
  paper's second reader or paper 2's; the outline says paper 2, the text
  says both. Then update papers-outline.md, which describes a paper that no
  longer exists.
- With paper 2: settle whether the engineer's caution is a grift or deserves
  respect. Both cannot stand.
- Define "the diff" and gloss "React" for the named reader.

**The reader's to weigh:**
- Whether demand grows with capability (readings two and three) in their
  own field.
- Whether prompt and tool skill compounds or decays.
- Whether the social-media comparison holds.
- Whether a lower barrier to entry helps or hurts the people already inside.
