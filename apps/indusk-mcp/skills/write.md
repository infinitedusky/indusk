---
name: write
description: Draft, outline, revise, review, or publish a paper, thesis, or essay that lives in a plan folder. Loads the plan's prose documents and nothing else. Use when the work is writing rather than code — "let's work on the paper", "revise the landscape essay", "publish paper 1".
argument-hint: [plan] [paper-file]
---

You are writing, not coding. This skill replaces `/catchup` for a writing session and shapes every turn of it. The papers are plan documents (`kind: paper`); the plan folder is the corpus; the conduct rules in AGENTS.md are the stance.

## Load

Do these, and nothing else, before the first reply:

1. Register presence: `indusk agent register --task "<plan>: writing — <what>"`.
2. Read the plan folder's prose documents: every `.md` under `.indusk/planning/<plan>/` that declares `kind: paper`, plus any outline, shape, or master document beside them. Read them whole. `mcp__indusk__list_plans` shows the plan's `papers` field with each paper's status and whether it is `stale`.
3. Report what was loaded, one line per document: file, title, status, and `stale` when the parser says so.
4. Skip lessons, skip health checks, skip extensions. A writing session pays for none of them and gets nothing back. Do not read CLAUDE.md; it is injected.

If the plan folder has no papers yet, ask for the title and the reader before writing anything. A paper without a named reader has no way to be judged.

## Voice

Distilled from the thesis that founded this skill. It is a sheet, not a style guide; the paper's own voice wins where they differ, and the user says which.

- Declarative sentences. Short paragraphs, one move each. A paragraph that makes two moves is two paragraphs.
- Bold the one claim a section exists to make, and nothing else.
- A concrete example beats an abstraction, and a named thing beats a category.
- Every paper names its reader, states its thesis in one line, and closes on the verdict it earned. A close that asks the next paper's question is a cliffhanger, not a close; each paper stands alone.
- No italic hand-off questions between standalone pieces.
- End with "What this paper is not": the misreadings that would let a reader dismiss it, one line each.
- No em-dashes; use a colon, a comma, or a new sentence. No "great question". No hedge on every claim; qualify once, where it matters.
- Lead with the strongest objection to your own claim when that is the honest move, the way AGENTS.md asks in conversation.

## Outline

Every paper has an outline beside it, the way `thesis-outline.md` sits beside `thesis.md`: per paragraph, what it achieves and why it sits where it does.

- Outline before draft. A draft without an outline is a draft nobody can judge against anything.
- When the draft moves, the outline moves in the same turn, or say plainly that the outline is stale. An outline went stale within two turns of the conversation that produced this skill; this rule is what came of it.
- The outline is where the arc is tested: does each section earn its verdict, does the close land as a finding, where does the paper depend on a term the reader does not have.
- **Short pieces get the same discipline one level down.** For anything short that will be sent or submitted in the user's name (an application field, a cover note, a message), the drilldown below goes all the way to sentence jobs; it does not stop at paragraphs. Before writing it, state the reader's prompt and its constraints: a direct question wants its answer in sentence one; an open box needs a framing sentence, because the reader does not know what is coming. Then one line per sentence saying what it does for the reader, one candidate sentence under each job drawn from the record or the user's own dictation, and only then does the user write the sentences. The agent repairs and strips tells; it flags a move it would drop rather than dropping it. Lock sentences one at a time, dated, in the working file. A wrong sentence is then caught as "wrong job," which is arguable, instead of "sounds off," which is not. See the lesson `community-plan-content-as-sentence-jobs-before-writing`.

### Before the drilldown

A new piece gets off the ground first, in its genre's brainstorm skill (`/brainstorm-fiction` today; others as they arrive): the seed in the user's words, ten books and what each gives, the purpose separate from the product's success, the register, an adversarial round with every objection labelled open, answered, or declared, the axes check, and the threshold. Its output is the piece line and the outline file's level zero. If the plan folder has no piece line, say so and hand over to that skill before drilling anything.

### Outline drilldown

The technique for building the outline, at any length. It starts from the piece line the brainstorm produced. Descend one level at a time, and at every level the entry is a purpose, never prose. Prose is written last, into the slots. The arc is complete at every level: the list of parts tells the whole story on its own, and so does the list of sentences, which is what the numbering is for.

1. **The piece.** What it is about, who reads it, and the prompt or occasion it answers. One line.
2. **The arc.** The story from open to close: what the reader holds at the start and what they hold at the end.
3. **The parts.** Chapters for a book, sections for a paper, paragraphs for a short piece. One line each: what this part does for the arc and why it sits where it does.
4. **Each part, roughly.** Under each part, what is going to happen in it: the moves, in order.
5. **The sentences.** For each paragraph, one line per sentence: the job it does for the reader. Number by paragraph and position (`3.2`), so a sentence can be cited, moved, or split without renumbering the rest, and a later job can say which earlier one it pays off.

From there the writing and the planning run together. As ideas arrive for a paragraph or a section, record them where they belong in the outline and put them in order; the outline is the document you keep going back to. At the end there are two artifacts: the piece, and a sentence-by-sentence outline that says what every sentence is for.

### Worked example: outline drilldown on a short piece

At every level below, the entry is a purpose, never prose. The company and its model are unnamed here; the user's working file names them.

**Piece.** Answer an open box, "anything you want to include," with a two-part reason for wanting the job. Reader: a recruiter skimming, then a hiring manager. No question is asked, so the piece needs a frame.

**Paragraphs.**

1. Say what the answer is going to be: the reason I want the job.
2. Reason 1.
3. Reason 2, part 1: helping the customer.
4. Reason 2, part 2: improving the system.

**Sentences.**

Paragraph 1

- 1.1 Frame the answer. This space is for the reason I want the job, and it has two parts.

Paragraph 2

- 2.1 Reason one, flat. The cutting edge, the pace they set, the people who set it.
- 2.2 Why that is mine to say and not every applicant's. I have been building on what comes out of this company: the seat, and the stack with their model underneath for the conversation and the post-call analysis.

Paragraph 3

- 3.1 Name reason two and its first half. The recent work was rewarding, first for what it did for the businesses.
- 3.2 The outcome, with numbers. One pilot store to twenty-five, the blueprint every account is configured from.
- 3.3 Succession. Trained the replacement, past a hundred locations without me. This is what makes it "transformed" rather than "touched."

Paragraph 4

- 4.1 The second half, named. Once I had seen what was in the way, I had the agency to fix it for every other engineer in the seat.
- 4.2 The verdict. The limitations were never the model; they were in how we used it.
- 4.3 The gate. Nobody could tell whether a prompt change helped until a customer found out.
- 4.4 The action. Made testing my job.
- 4.5 The primitives, concrete nouns, and the two companies in a room.
- 4.6 Their measure. The posting says success is eval-driven feedback that changes product and model roadmaps, so that half is the job, not a hope.
- 4.7 Next step. One level lower, where the feedback reaches the model. This pays off 2.1.
- 4.8 Close. Golf on nights and weekends as proof the focus is the same off the clock, and the line about the people who make the thing.

**One slot filled, to show the grain.** Job 2.1. The writer wants to say "I want to learn how it is done" without the word learn, because learn reads as junior. Name the room, not the benefit: "The first is that I want to work at the cutting edge, and at the pace this company has set for it, with the people who set it."

**What the plan caught.** The writer's own draft opened "I will share a few of my motivations." An earlier critique called that throat-clearing, applying a rule from a direct-question form. Checked against the actual prompt, an open box, job 1.1 is a frame and the sentence was doing it; only the wording was repaired. A wrong sentence is now an argument about which job it does, and that argument can be settled.

## Stance

The conduct rules in AGENTS.md apply in full: counterargument first, no validation, explicit confidence, questions are questions.

Plus the research skill's principle: let the user ask the next question. A thinking-aloud turn gets a few sentences and no edits. Do not reframe a description as "this changes X"; do not hunt for changes. Edit only when told, or when the user has clearly moved from thinking to instructing, and say which you took it as.

## Read as the reader

On request, and always before a paper moves to `accepted`, read it cold as its named reader and record the pass in the plan folder as `<paper-stem>.review.md` under a `## Read as the reader` heading. Answer, in order:

1. Who is the reader, in one line.
2. Does the opening stand without the companion papers? Name the first sentence that assumes one.
3. Does the close land as a finding, or as a cliffhanger for the next piece?
4. Where does the paper lean on a term or an ID the reader does not have? (An `A2` or a `Phase 3` cited without saying what it is fails the reader; see AGENTS.md.)
5. What would this reader do differently after reading it? If nothing, the paper has no verdict.

## Falsify the argument

The goal flips: not "is this good" but "where is this wrong". Record the pass in the same review file under `## Falsify the argument`:

1. For each section, the strongest objection a hostile expert would raise, in one sentence.
2. Every claim asserted without support, listed by the sentence that asserts it.
3. Across a set of papers, where two of them disagree with each other.
4. Which of the above the author should answer in the text, and which are the reader's to weigh.

Record findings; do not fix inline. The author decides what changes.

## Publish

Papers publish with `indusk papers publish`, never by copying files. The destination is a build artifact and the plan copy is the source: nobody hand-edits the destination.

The command, and the example that this project's first publish used verbatim:

```
indusk papers publish <plan>/<file> [--to <name>] [--push]
indusk papers publish indusk-v4-day/paper-1-the-grift.md --to blog
```

It enforces its own preconditions and refuses with the reason otherwise: the paper is `accepted` or `published`, the plan copy is committed, the destination exists and is a git repository, and the target page there is clean. It renders the page into the destination, regenerates the index between its markers, commits in the destination, and writes provenance back into the paper and commits that in the source. It never pushes unless `--push` is given; deploy is the user's push.

If no destination is configured, the command refuses naming `papers.destinations`. Ask the user where the paper goes, then write the block into `.indusk/config.json` yourself rather than asking them to:

```jsonc
"papers": {
	"destinations": [
		{ "name": "blog", "path": "~/code/site", "dir": "writing", "index": "writing/index.md" }
	]
}
```

Inside a workbench, `"repo": "site"` names a declared repo instead of a path. Make sure the destination's index page carries the marker pair `<!-- papers:start -->` and `<!-- papers:end -->`; the command refuses, printing the pair, when it cannot find them.

**Hotfix**: edit the plan copy, commit it with an intent-named message, publish. There is no brief per typo. A larger revision goes through the plan folder the ordinary way and ends in the same publish.

After a publish the paper reads `published`. Edit it again and it reads `published (stale)` until the next publish; stale reports, it never blocks.

## What this skill does not do

- No gates and no hooks. Nothing blocks a write.
- No per-typo brief.
- No push. Deploy is the user's push, or an explicit `--push`.
- No lessons, no health, no extensions. If the conversation turns into code work, say so and hand over to `/work`.

## Invocation

- `/write <plan>`: load the plan's papers and begin.
- `/write <plan> <file>`: focus one paper.
- `/write` with no arguments: ask which plan.
- Without the slash, on any request to draft, outline, revise, review, or publish a paper, thesis, or essay: this skill, before any file is read.
