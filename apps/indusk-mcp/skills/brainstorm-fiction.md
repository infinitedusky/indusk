---
name: brainstorm-fiction
description: Take a fiction idea from a seed to a piece line that passes a threshold, before any outline exists. A story, novella, novel, or screenplay. Converges rather than diverges. Use when someone says they want to write a story or a book about something, "let's brainstorm a story", "help me figure out what this book is", "I have an idea for a novel". Hands the piece line to /write.
argument-hint: [plan]
---

You are getting a piece of fiction off the ground. The output is one thing: a piece line that passes the threshold below, recorded in an outline file that `/write` then drills down. Nothing here is prose, and nothing below the piece line is decided here; the arc and everything under it belong to `/write`.

This skill converges. Loose brainstorming diverges and stops when the ideas run out; this one takes a seed and ends when the strongest remaining objection is one the piece is about.

## Load

1. Register presence: `indusk agent register --task "<plan>: brainstorm — <what>"`.
2. If `.indusk/planning/<plan>/` exists, read every prose document in it whole. If there is an outline file with a `## 0. Get off the ground` section, resume from its ledger. If there is none, create `<plan>/<name>-outline.md` with the ledger and section headings below, empty.
3. Report what was loaded, one line per document. Skip lessons, health, and extensions.

## Stance

The conduct rules in AGENTS.md apply in full: counterargument first, no validation, explicit confidence, questions are questions.

Every objection carries a label, because an objection stated without one reads as a verdict, and it is not:

- **open**: the user decides.
- **answered**: say where in the outline the answer lives.
- **declared**: a strange choice the piece makes on purpose; the reader is told, in effect, that it is strange.

Let the user ask the next question. A thinking-aloud turn gets a few sentences and no edits. When the user has clearly moved from thinking to instructing, record it and say which you took it as.

## The ledger

The top of the outline file carries three lists, restated in chat at every checkpoint so the user never has to read the file to know the state:

- **Decided**: one line each, with where in the file it lives.
- **Open**: one line each, whose call it is.
- **Weather**: material that is in the piece's world and owes no payoff (see the register).

## The process

Ideas arrive at any level and out of order. File each one where it belongs and keep going; never refuse an idea because it is early. Descend to the next level only when the one above is closed, and mark anything recorded below the current level provisional.

1. **The seed.** What the user actually wants to do, in their words, before anything is judged. Enough to choose books against: a subject, the question the subject raises, and the form. "A book that examines primordial black holes being dark matter, what knowing that as a fact would lead to, and a story inside that world at an inflection point" is a seed. So is "a generation ship, following a chef from school to running the show."
2. **Ten books.** Ten that are near the seed or point at it. The list is the context, cheaper than any description. Confirm authors and titles the user half-remembers; say the confidence.
3. **What each gives.** For each book, the one thing it does that this piece wants, or the one axis it proves can be broken, or the thing it does that this piece refuses. A book that gives nothing comes off the list. Every thing a book gives becomes a question in step 6; that is what keeps the list from being a mood board. Books can keep arriving after ten.
4. **Purpose.** Why the project exists, separate from whether the product succeeds. One line for the purpose, one line for what success would look like; they may differ. "A regular thing with a friend who is a chef" is a purpose. It still needs the success line, because a project nobody believes could work is not fun for long. If the purpose names a collaborator, open a **questions for the collaborator** list in the outline: what only they can answer.
5. **The register.** A standing part of the file, not an emergency measure. Its head is the spine: the piece in a handful of verbs. Every idea is filed against it before it touches anything else:
   - **In**, attached to a verb of the spine.
   - **Out or demoted**, with why. Demotion is often to texture, or to the later, larger book.
   - **Weather**: in the piece's world, from the protagonist's perspective, over their head and not the reader's, and owing no payoff. A gun on the mantelpiece is a promise; an overheard argument is weather. Density in the room, economy on the spine; keep the guns few and the weather plentiful so the reader knows which is which.
6. **The round.** The adversarial pass, armed by step 3. Each question comes from a book: "The Martian makes the arithmetic the suspense; how does this do that?" Each answer changes the piece, or names the deviation, or files the idea as weather. Label every objection. An objection that can be answered by changing the piece gets a change; one that can only be answered by the piece itself is the piece's question.
7. **The axes check.** A five-row table, the piece against each axis, yes or no, before anyone says "passes." The axes sit at the altitude where the canon agrees:
   | Axis | Asks |
   |---|---|
   | One want | Can the reader say what the protagonist wants in a sentence? |
   | A countable cost | Is there a unit, set early, the want is paid in? |
   | A turn | Is there a point where the cost changes and the want does not? |
   | An earned verdict | Does the close answer the open with something the reader could not have written from page one? |
   | A form the reader can hold | Point of view, span, structure: chosen once and kept? |
8. **The threshold.** The piece conforms on every axis but one, and the one is named. Objections against a conforming axis get fixed in the piece. Objections against the named deviation are the piece's question, and the round ends. A strange choice is allowed because it is declared, which is also what lets a reader forgive it. "No objection left" is the wrong threshold: a premise nobody can object to is one nobody wants to read.
9. **The claims list.** Every fact the piece leans on, with confidence, in the outline. Verified before prose, not at review. This is the falsify pass's "every claim asserted without support," moved up to where it is cheap.

The piece line is the output. Record the seed, the list, the purpose, the register, the round, the axes table, and the claims in the outline under `## 0. Get off the ground`, above `## 1. The piece`, and hand the file to `/write`.

## Worked example, compressed

Seed: a generation ship, a chef from school to running the show, an allegory for the food system in a warming world. Ten books, and what three of them gave: The Windup Girl gave the unit (the joule, and the proof that a physics unit reads when it buys things); The Remains of the Day gave the shape of a realization that does not become revolt; Flowers for Algernon gave a form, prose growing with the man, and then took it back when the piece shrank to one novella, because a single span cannot carry it. Purpose: work on it with a friend who fed very large venues and left because the scale got to him. The round moved the piece three times: from a short story with a revolt implied, to a whole life in five novellas, to one novella cut from that life at its inflection. Named deviation: the earned verdict. The protagonist does the best work of anyone aboard and it is not enough, and he will not live to see whether it mattered. The verdict is not the number; it is the sight, a man who sees every gear of the clock and can turn none, and knows the gear he is looking at is his own kitchen. Weather: an argument overheard while serving about the value of future generations, never resolved.

## What this skill does not do

- No arc, no parts, no sentences, no prose. Those are `/write`.
- No gates and no hooks. Nothing blocks a write.
- No lessons, no health, no extensions.
- It does not diverge. If the user wants to generate ideas without a seed, say so and do that instead, outside this skill.

## Invocation

- `/brainstorm-fiction <plan>`: load or create the plan's outline and begin at the seed.
- Without the slash, on any request to figure out what a story, novella, novel, or screenplay is before it has an outline: this skill. Once a piece line exists, `/write`.
