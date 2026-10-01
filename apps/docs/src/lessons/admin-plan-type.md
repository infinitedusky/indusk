# The Plan's Type — Lessons

**Plan:** `.indusk/planning/archive/admin-plan-type/` · **Guide:** [what an absent document reads as](../guide/plan-lifecycle.md#what-an-absent-document-reads-as) · **Closed:** 2026-10-01

The plan bar drew every absent document as *skipped*, whether the plan never
needed it or closed without it. This plan made a plan declare its type and
made that type the judge. What it taught that applies beyond it:

## A fixture that uses a word nobody uses proves nothing about the data that exists

The test for "a spike with finished research is not told to create a brief"
wrote its research with `status: completed`. It passed. Thirty-three of the
thirty-six research documents in this repository say `complete`, and the code
under test did not count that word as finished. Every real spike still read
wrong while the row read green.

What found it was not a test. The phase's Verification asked for this
repository's own plans to be printed after the fix, and one of them read
"Review research" beside a bar that said the plan was over.

When a hypothesis is about data people wrote, one of its cases is lifted from
that data. And after a fix, print what the real things read as. A constructed
case tells you the code handles what you imagined.

## When a new fact becomes the judge, find every reader of the question

The type was wired into the one function that reads which documents exist.
But four places answer "what comes next for this plan": the bar's segments,
the bar's label, the plan list's next step, and the `advance_plan` tool. Three
of them had never heard of the type. A bugfix with an accepted test plan was
told to write the ADR by a tool standing next to a bar that drew the ADR as
skipped.

Searching for readers of the *data* (who reads `workflow:`) finds one site.
Searching for readers of the *question* (who says what a plan needs next)
finds four. The second search is the one that matters, and it belongs in the
brief.

## A single-definition scan covers only the directories it reads

This repository pins shared definitions with a source-tree scan that asserts
exactly one file defines a thing. The lifecycle's scan read `src/lib`. Two of
the three copies of "which status words mean finished" and of "the next
document" lived in `src/tools`, so the scan reported one definition of each
while three existed.

A pin is a claim about a set of files. Read its glob before trusting it, and
when a copy is found outside it, widen the glob in the same change that
removes the copy.

## `String()` of a parsed value is not what was written

`workflow: [bugfix]` is a YAML list. `String(["bugfix"])` is `"bugfix"`, and
the plan read as a bugfix. A mapping reads as `[object Object]`.

A frontmatter value that is matched against a vocabulary is a plain string or
it is unrecognised. What is shown to a person is the text on the line, read
from the raw document, never a rendering of what the parser made of it.

## A template is a statement of the rules

The planner skill's table said a bugfix requires a test plan. The template a
bugfix is written from did not list one, and neither did the reference page.
`release-ritual` closed without a test plan because the document its author
started from never asked for it.

Wherever a rule is restated for a different reader — a table, a template, a
reference page — pin every restatement to one definition by test. The one
that is wrong is the one somebody will read last.

## What we would do differently

- Author each falsification row with one case taken from real data.
- List, in the brief, every place that answers the question the plan changes.
- Kill a test run by process tree and look for leftovers by working directory
  before the next run. A dev server orphaned by an interrupted run fails every
  HTTP test in the admin, and looks exactly like 43 real failures.
