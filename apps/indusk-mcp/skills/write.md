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
- **Short pieces get the same discipline one level down.** For anything short that will be sent or submitted in the user's name (an application field, a cover note, a message), the outline is a numbered list of sentence jobs, not paragraphs. Before writing it, state the reader's prompt and its constraints: a direct question wants its answer in sentence one; an open box needs a framing sentence, because the reader does not know what is coming. Then one line per sentence saying what it does for the reader, one candidate sentence under each job drawn from the record or the user's own dictation, and only then does the user write the sentences. The agent repairs and strips tells; it flags a move it would drop rather than dropping it. Lock sentences one at a time, dated, in the working file. A wrong sentence is then caught as "wrong job," which is arguable, instead of "sounds off," which is not. See the lesson `community-plan-content-as-sentence-jobs-before-writing`.

### Worked example: 10,000 feet to one sentence, planning purpose not prose

The piece: an optional free-text box on a job application for a forward-deployed engineer seat.

- **10,000 ft, the piece.** Reader: a recruiter skimming, then a hiring manager. Prompt: "share anything else you want us to know, such as your motivation." No question is asked, so the piece needs a frame. Two paragraphs.
- **1,000 ft, the moves.** (1) Frame. (2) Two reasons for applying. (3) Evidence for reason two, in two halves: what the work did for the customer, and what the writer fixed for every other engineer in the seat. (4) Tie to the posting's own success measure. (5) Next step and close.
- **100 ft, the sentence jobs, paragraph one.** 1 frame. 2 reason one, flat. 3 reason two, both halves named. 4 the seat. 5 the stack, which earns the right to an observation. 6 the verdict. 7 the gate. 8 the action. 9 the primitives, in concrete nouns. 10 the reward.
- **10 ft, one job filled.** Job 2. The writer wants to say "I want to learn how it is done" without the word learn, because learn reads as junior. Name the room, not the benefit: "The first is that I want to work at the cutting edge, and at the pace this company has set for it, with the people who set it."
- **Ground level, what the plan caught.** The writer's own draft opened "I will share a few of my motivations." An earlier critique called that throat-clearing, applying a rule from a direct-question form. Checked against the actual prompt, an open box, the frame was correct and stayed; only the wording was repaired. The plan is what made that argument decidable.

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
