---
title: "Review — The right way"
date: 2026-09-09
paper: paper-3-the-right-way.md
status: draft
---

# Review: The right way

Two passes from `/write`, recorded without edits to the paper. Section numbers
are the paper's own; "Tests," "Traces," and "The pull request" are the
subsections of section 2.

## Read as the reader

1. **Who is the reader.** The paper does not say. Its header line gives the
   genre ("A method, and what it costs") and points at two plan documents;
   the outline (papers-outline.md) names the reader as the team that will do
   it, the reviewer who will approve it, and the leader who funded paper 2's
   answer. The voice sheet requires the paper to name its reader itself. This
   pass reads as the team and the reviewer.

2. **Does the opening stand without the companion papers?** Yes, and
   deliberately: section 1 restates the problem in its own words instead of
   pointing at paper 2, which is what the outline asked for. The first
   sentence that assumes a companion is the header note ("Paper three of
   three... Companions..."). Inside the argument, the first lean is the
   TL;DR's last sentence: "InDusk is the opinionated path to that shape." A
   cold reader has not been told what InDusk is (a product, a company, a
   method) and does not find out until section 4. The second lean is section
   5's opening, "You cannot sell a trick for the hard part," which is paper
   1's argument compressed to an aphorism; it survives as an aphorism.

3. **Does the close land as a finding?** Yes. Section 5 ends on the verdict
   the outline promised: it costs on the first task and pays on the tenth,
   and anyone who says otherwise is selling something. No hand-off question.
   "What this paper is not" follows and is tight.

4. **Terms or IDs the reader does not have.**
   - **"span"** (Traces: "When a span carries the name of the claim"). The
     team member who has done OpenTelemetry knows it; the reviewer and the
     leader do not, and the paragraph it opens is the paper's most original
     claim (telemetry records intentions).
   - **The ten artifacts** (section 4): "the plan, the contract of claims, the
     amendment log, red observed, green at head, binding, the uncovered
     surface, the probe log, promise linkage, and the process record." Listed
     as names. Binding, amendment, red-before-green and the probe were
     explained in section 2; "promise linkage" is explained only by the
     Midnight bullet that follows; **"the process record"** is explained
     nowhere in the paper. The reader is pointed at pr-shape.md, which is a
     plan document, not a companion paper.
   - **"green"** (TL;DR, section 1). The team knows it; the leader in the
     named readership does not. Same gap as paper 2, less costly here.
   - **"step definitions"** (Tests), **"git blame"** (Traces). Jargon for the
     reviewer and the leader; both sentences survive without them.
   - **"mutation check"** (Tests). Defined in the same sentence ("break the
     claimed behavior, and the test must die"). Passes.
   - **Dawn, Midnight, Day** (section 4). Each gets one line saying what it
     does. Passes.
   - No plan IDs (`A2`, `Phase 3`) cited. Good.

5. **What would this reader do differently?** A great deal, and specifically:
   the team writes claims in English and gets them approved before code,
   records red before green by machine, runs a mutation check per claim, and
   names spans after claims; the reviewer reads claims and verdicts, asks
   questions that execute, reads only the uncovered files, and stops when
   there are no more questions; the leader funds that. It is the most
   actionable of the three papers. The problem is that it is not actionable
   today by the path the paper names: section 4 says the three pieces "ship
   as one thing," and master.md (the build sequence the paper's own header
   points to) marks components 5 through 10 "not started," while
   pr-shape.md's Today column marks rows 4, 6, 7, 8 and 9 "missing." A team
   that reads this paper and installs InDusk will find no red-observed
   record, no binding check, no uncovered-surface report, no probe, and no
   promise linkage. The reader would do the right things and discover the
   opinionated path stops halfway.

## Falsify the argument

### 1. Strongest objection per section

- **TL;DR.** "Generating code is solved." For greenfield and well-trodden
  code, yes; for large legacy systems, novel algorithms and performance-
  critical paths, the controlled evidence (the METR mid-2025 trial of
  experienced developers, which found them slower on their own repositories;
  confidence high that it exists) says otherwise. The paper's whole
  structure rests on generation being free.
- **1. The problem, in its own words.** "Nobody can tell" is asserted in the
  same paper that says a machine can tell (the shape). The honest statement
  is "nobody can tell cheaply today," which is weaker and truer.
- **Tests.** Three objections, in rising order. (a) TDD did not die "on
  cost" of reading tests; it is practiced widely, and its cost was writing
  tests first through design churn, not reviewing them. "Forty years ago" is
  also loose: test-first as a named discipline dates to the late 1990s.
  (b) "The agent writes the test from the claim, so the binding is no longer
  hand-maintained": the binding is now maintained by the goal-seeker whose
  testimony section 1 said is worthless. (c) The rescue, "a mutation check
  proves the test still means the sentence," overstates what mutation
  testing proves. A mutation check proves the test is sensitive to the code
  it exercises, not that it asserts the sentence. A snapshot test, or an
  over-specific test of the wrong property, dies under mutation and still
  does not mean the claim. Equivalent mutants and mutation of the wrong site
  are known limits. This is the paper's load-bearing "why now" claim (the
  bold line) and it is the one a testing expert will attack first.
- **Traces.** "The conclusion is always sociological" is a straw postmortem.
  Blameless, contributing-factor postmortems have been standard practice
  for over a decade, and they routinely name the missing test. Separately,
  "telemetry records intentions" requires the invariant to be checkable at
  runtime by a span. Latency and double-booking are; "the migration is
  reversible" and "no PII leaves this boundary" are not, and the paper does
  not say which claims the trace half of the evidence can carry.
- **The pull request, and the reviewer.** "Approve when every claim has a
  verdict and there are no more questions. That is a stopping rule. Diff
  review structurally cannot have one." The stopping rule is "when the
  reviewer runs out of questions," which is the diff reviewer's stopping
  rule too (when they run out of comments). What differs is that probes
  execute, not that there is a structural stop. And "neither side reads
  code" cedes security, performance and architecture review, where the
  expensive failures live, to "bad judgment... stays a human call" without
  saying how that call is made unread.
- **3. The boundary is fixed, the path is free.** "Not a process. A
  boundary." The same section says "Each artifact pulls its discipline in
  behind it": red-observed requires tests first, the plan requires planning,
  promise history requires instrumented code. A boundary that dictates the
  workflow needed to reach it is a process with a different name. "The only
  form of coherence an organization can actually adopt" is a superlative
  with no comparison.
- **4. What InDusk is doing about it.** Present tense against the plan's own
  record: "Three pieces make it operational, and they ship as one thing"
  while master.md marks components 5 through 10 not started and pr-shape.md
  marks five of ten rows missing. Also, "nothing in the table is produced by
  the builder asserting it" holds only if the builder's process cannot write
  to the infrastructure that records the observations; an executor with
  shell access can. The project's own record notes this class of hole for
  the run gate.
- **5. No free lunch.** "Pays on the tenth" is the same unsupported-payoff
  shape the paper attributes to the grift; and the cost list omits compute
  (mutation testing is slow, minutes to hours per run) and omits that the
  probe's executed answer is authored by an agent of the same class whose
  testimony section 1 distrusts. Verdicts are binary; the paper calls that a
  cure for the score-as-target problem, but a goal-seeker games a binary
  gate too. The shape's own acceptance test (born-green tests, silently
  weakened claims, wrong-property tests) is a list of exactly those games.
  What makes the shape hold is that it detects the games, not that its
  verdicts are binary, and the paper says the weaker thing.

### 2. Claims asserted without support, by sentence

- "Generating code is solved." (TL;DR)
- "Test-driven development found half of this forty years ago and could not
  make it stick." (Tests; the date and the death)
- "So the test needed a reviewer as skilled as its author, the reading was
  as expensive as the code, and the discipline died on cost." (Tests)
- "A mutation check proves the test still means the sentence." (Tests)
- "Because intent was never recorded, the conclusion is always sociological."
  (Traces)
- "Diff review structurally cannot have one." (The pull request)
- "This is the only form of coherence an organization can actually adopt."
  (section 3)
- "Three pieces make it operational, and they ship as one thing." (section 4)
- "Nothing in the table is produced by the builder asserting it." (section 4)
- "It costs you on the first task and pays on the tenth." (section 5)

### 3. Where the papers disagree with each other

- **What exists.** This paper (section 4) and paper 1 (sections 10 and 14:
  "the near future is the one that is already here," "the electrician is not
  a metaphor, it is the same structure") both describe the vetted plan and
  the shape as present. Paper 2 (section 6) is the honest one: "how to build
  it is not this paper's subject." The plan folder's own status documents
  side with paper 2.
- **Not a process.** This paper's section 3 says "Not a process. A boundary"
  and one paragraph later says each artifact pulls its discipline in behind
  it. Internal, but it is the sentence paper 2's leader will quote back.
- **What stays proven.** Paper 2 (section 7): "Every claim proven stays
  proven." This paper (Traces): a test proves the claim held once. This paper
  is right; paper 2 should move.
- **How much reading survives.** Paper 1 (section 6): "the reading is the
  waste." This paper (Tests, and pr-shape.md): the uncovered surface is "the
  only code anyone has to read," and row 7 acknowledgement is a reading. Not
  a contradiction, but paper 1's absolutism does not carry this paper's
  narrowing, and a reader of both will notice.
- **Binary verdicts versus scores.** Paper 2 (section 5) argues that the
  builder optimizes any number put in front of it. This paper (section 4)
  says a verdict terminates because it is binary. Paper 2's argument, taken
  seriously, applies to this paper's verdicts; the reconciliation (detection
  of the games, not binariness) is in pr-shape.md and not in either paper.
- **Duplication, not disagreement.** Section 1 here is paper 2's sections 3
  to 5 nearly verbatim; the TL;DR is thesis.md's TL;DR nearly verbatim.
  Fine for a standalone paper; heavy across the set.

### 4. Which the author should answer, and which are the reader's

**Answer in the text:**
- Section 4's tense. Say which of the ten rows exist today and which are
  being built, or say "will ship." The paper's own header points at the
  document that contradicts it.
- Mutation proves sensitivity, not meaning. Either weaken the bold claim or
  say what closes the remaining gap (the reviewer's reading of the claim,
  the probe, or both).
- "Not a process" against "pulls its discipline in behind it." Pick one, or
  say plainly that the boundary implies a workflow and that this is the
  point.
- The stopping rule. Say what structurally ends a review under the shape
  beyond the reviewer running out of questions, or drop "structurally."
- Binary verdicts. Move the reconciliation (the shape detects the games) up
  from pr-shape.md into section 4, since it is the answer to paper 2's own
  argument.
- Name the reader in one line. Define "span" and "the process record" where
  they first appear, or drop the list of ten names in favor of the five the
  paper has already explained.
- The postmortem straw man. Say "too often" rather than "always," or give
  one real postmortem that ended in a process layer.

**The reader's to weigh:**
- Whether generation is solved for their codebase.
- Whether judgment can be exercised without reading.
- Whether the first-task cost pays by the tenth task.
- Which of their claims a trace can carry at runtime.
