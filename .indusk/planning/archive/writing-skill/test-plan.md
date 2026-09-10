---
title: "Writing skill — Test Plan"
date: 2026-09-09
status: accepted
---

# Writing skill — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
feature is working. Each assertion names the mechanism by which it will be
tested, not the test code but the test approach. When all assertions can be
made true by an architecture, we have a feature; when all are passing in
code, the feature is shipped.

The assertions become the source rows for the impl's `## Test Trajectory`
table. The ADR that follows is constrained by "what makes all of these true?"

Three of the feature's parts are testable in three different ways, and the
plan keeps them apart: the **document kind** (`kind: paper`) is library code
and gets unit tests; the **publish step** writes into a second git repo and
gets integration tests against a temporary one; the **skill** is prose read by
a model, so its tests pin the instruction text (the way the planner skill's
Test Phase 1 instruction is pinned today) and the rest is a manual dogfood run
against the Day papers.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A plan folder whose documents all carry `kind: paper` appears in `list_plans` with a stage and status derived from those papers, never `unknown`, and its next step is never "Create a brief". | vitest unit (plan parser) |
| A2 | A plan folder with lifecycle documents and papers keeps its lifecycle stage, and the papers are listed beside it with their own statuses. | vitest unit |
| A3 | A paper's status vocabulary is `draft`, `accepted`, `published`, and `published (stale)`; any other value is reported as malformed, not silently treated as draft. | vitest unit |
| A4 | The Day plan (`indusk-v4-day`), once its documents declare `kind: paper`, reports a real stage in `list_plans` and in the admin UI. | manual smoke (dogfood) |
| A5 | The admin UI renders a paper under its plan with its title and status, read-only, and a plan with only papers renders without an error. | vitest browser (admin component) |
| A6 | After `indusk update`, a project with no `papers` block in `config.json` has an empty `papers.destinations` list; a project that already has destinations keeps them byte-for-byte. | vitest unit (config ensure) |
| A7 | Publishing a paper to a configured destination puts the page in the destination directory with its frontmatter mapped to the destination's shape, adds the nav entry, and commits in the destination repo on its current branch, with no push. | vitest integration (temporary git repo as destination) |
| A8 | After a publish, the paper's own frontmatter records the destination name, the destination path, and the destination commit, and its status reads `published`. | vitest integration |
| A9 | Editing the plan copy after a publish makes the paper report `published (stale)`; publishing again clears it. | vitest integration |
| A10 | Publishing with no destination configured stops with a message naming the missing configuration and writes nothing anywhere. | vitest unit |
| A11 | Publishing to a destination whose path does not exist, or is not a git repo, or whose target page has uncommitted changes, refuses with the reason and writes nothing. A target page that was edited and committed by hand is overwritten, and the destination commit message says the page had diverged. | vitest integration |
| A12 | Inside a workbench, a destination given as a declared repo name resolves through the workbench's declarations; outside a workbench, a repo name is refused with a message saying that only paths are accepted here. | vitest unit |
| A13 | The publish command documented in the skill, run verbatim from a clean checkout, performs A7 and A8. | manual smoke (dogfood: paper 1 to `~/code/site`) |
| A14 | The writing skill is installed in every project on update, byte-identical to the package source, and registrable: its frontmatter carries `name` and `description`. | vitest (skill-sync parity, already exists; extends to the new file automatically) |
| A15 | The skill's description names drafting, outlining, revising, and publishing a paper, thesis, or essay, so a plain-language request routes to it. | vitest (pin on the skill text) |
| A16 | The skill's instructions tell the agent to register presence, load the plan folder's prose documents, and skip lessons, health, and extensions. | vitest (pin on the skill text) |
| A17 | The skill's instructions carry the voice sheet, the outline discipline, the read-as-the-reader pass, and the falsify pass for arguments, each as a named section. | vitest (pin on the skill text) |
| A18 | "Let's work on the grift paper" in a fresh session invokes the skill without the slash command. | manual user test |
| A19 | Running the skill on `indusk-v4-day` loads the thesis, the outline, the shape, and the three papers, prints nothing from lessons or health, and leaves a read-as-the-reader pass and a falsify pass recorded in the plan folder for each paper. | manual smoke (dogfood) |
| A20 | The docs site has a reference page for the skill and the page is in the sidebar. | vitest unit (sidebar config) |
| A21 | Publishing refuses while the paper's plan copy has uncommitted changes, and a successful publish's destination commit message carries the source commit hash of the plan copy it published. | vitest integration |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Prose drafted under the skill is in the thesis's voice. | LLM output quality; no oracle. | The read-as-the-reader pass (A19) plus the user's own read before `accepted`; the voice sheet is pinned (A17) so at least the instruction is present. |
| U2 | Model invocation without the slash command happens reliably, not once. | Probabilistic routing; one manual pass (A18) proves it can, not that it will. | The description is the routing key and is pinned (A15); if routing fails in use, the fix is the description text, and A18 is re-run. |

## Notes

- A7 through A12 assume the publish step is a library function with a CLI
  entry point, so that A13 can run the documented command verbatim. The
  lesson on file: a library the skills call is not shipped until it is
  exported and its documented invocation has been run. The ADR settles the
  command's name and shape.
- **Papers are managed like code.** The plan copy is the source; the
  destination is a build artifact the publish step owns, the way a build owns
  `dist/`. Nobody hand-edits the destination. A11's refusal on an uncommitted
  target page is git hygiene, not a merge strategy; a committed hand edit is
  overwritten because git history already holds it. A21 makes every publish
  traceable to a plan commit: a hotfix is an intent-named commit in the plan
  repo followed by a publish, and a larger revision goes through the plan
  folder and ends in the same publish. There is no per-typo brief.
- A9's staleness is a content hash of the plan copy recorded at publish
  time, compared on read. Mtime and commit ordering were considered and
  rejected as the mechanism: a checkout resets mtimes and a rebase reorders
  commits. `published (stale)` reports only; it never blocks an edit or a
  publish. It is the ordinary state between a plan commit and the publish
  that clears it, a signal that a publish is owed.
- A4, A13, A18, and A19 are the dogfood run, which is also this plan's
  acceptance test: point the tool at its own repo before calling it done.
