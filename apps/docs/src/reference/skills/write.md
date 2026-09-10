# Write

The write skill is a writing session's `/catchup`, voice sheet, review
ritual, and publish step in one. It exists because InDusk is tuned for code
in four places, and a paper pays for each of them: the lifecycle did not know
what a paper was, the close-out rituals assume a diff, catchup loads
engineering lessons and a telemetry health check, and nothing packaged the
two things that make a writing session work, the plan folder as a corpus and
the conduct rules in AGENTS.md. The design is
`.indusk/planning/archive/writing-skill/adr.md`.

It is prose only. No hooks, no gates, nothing blocks a write.

## What it does

1. **Load.** Registers presence, reads the plan folder's prose documents
   (every `kind: paper` document plus any outline, shape, or master beside
   them), reports what it loaded with each paper's status and staleness, and
   skips lessons, health checks, and extensions.
2. **Voice.** A sheet distilled from the founding thesis: declarative,
   one move per paragraph, one bold claim per section, a named reader, a
   one-line thesis, a close that is a verdict, a "What this paper is not"
   ending, no hand-off questions between standalone pieces.
3. **Outline.** Outline before draft; the outline moves in the same turn the
   draft moves, or is declared stale.
4. **Stance.** AGENTS.md conduct plus the research skill's rule: let the
   user ask the next question; thinking-aloud turns get a few sentences and
   no edits.
5. **Read as the reader.** Before a paper moves to `accepted`, a cold read
   as its named reader, recorded in the plan folder as
   `<paper-stem>.review.md`: does the opening stand alone, does the close
   land as a finding, where does it lean on a term the reader lacks, what
   would the reader do differently.
6. **Falsify the argument.** The goal flipped: the strongest objection per
   section, every unsupported claim, where papers in a set disagree.
   Recorded, not fixed inline.
7. **Publish.** `indusk papers publish <plan>/<file>` and never a hand copy.
   When no destination is configured the skill asks where the paper goes and
   writes the `papers.destinations` block into `config.json` itself.

## Invocation

- `/write <plan>` loads the plan's papers and begins; `/write <plan> <file>`
  focuses one.
- Without the slash: the skill's description names drafting, outlining,
  revising, reviewing, and publishing a paper, thesis, or essay, so a plain
  request such as "let's work on the grift paper" routes to it. The
  description is the routing key; if routing misses in use, the fix is the
  description text.

## Papers as plan documents

A paper is any plan document declaring `kind: paper`. The parser gives it a
status (`draft`, `accepted`, `published`, or `malformed`) and derives
`stale` from a content hash on every read; a folder of papers with no
lifecycle document is a `paper`-stage plan. See
[`indusk plans`](/reference/cli/plans#papers-kind-paper) for the document
kind and [`indusk papers`](/reference/cli/papers) for publishing.

## The hotfix path

Edit the plan copy, commit it with an intent-named message, publish. There
is no brief per typo. The destination is a build artifact: a hand edit there
is refused while uncommitted and overwritten once committed, with the
overwrite named in the destination commit.
