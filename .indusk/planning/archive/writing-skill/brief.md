---
title: "Writing skill — papers as first-class plan documents"
date: 2026-09-09
status: accepted
---

# Writing skill — Brief

## Problem

InDusk is tuned for code, and a session spent writing a paper inside it pays
for that in four specific places. Observed on 2026-09-08/09 while splitting
[the Day thesis](../indusk-v4-day/thesis.md) into three papers.

1. **The document lifecycle does not know what a paper is.** Plans are
   research, brief, ADR, impl, retrospective. The Day folder holds a master,
   a thesis, an outline, a shape document, and three papers. `list_plans`
   sees all nine files and reports `stage: unknown`, `nextStep: "Create a
   brief"`. Verified 2026-09-09; `indusk-v2-dawn` (master, maxims,
   positioning, roadmap) reports the same. The admin UI has nothing to render
   for them beyond raw markdown, and nothing tracks that a paper's outline is
   stale against its draft, which happened within two turns yesterday.
2. **The close-out rituals assume a diff.** `/falsify`, `/cleanup`, and the
   eval rubric all read changed code. An essay has exact equivalents, the
   strongest objection to each section and whether each piece earns its own
   verdict, and nothing runs them. A paper commit gets scored by a code
   rubric.
3. **Catchup and the lessons library are code knowledge.** A writing session
   loads 109 engineering lessons and health-checks the telemetry daemon, and
   gets nothing from either.
4. **The reading surface is a terminal.** This is the harness, not InDusk,
   and is out of scope here; noted so it is not mistaken for the skill's job.

What made the session work anyway: the plan folder as a corpus the model can
read directly, and the AGENTS.md conduct rules (counterargument first, no
validation), which are already the thinking-partner stance a paper needs.
Neither is tooling. The tooling gap is that nothing packages those two things
for a writing session, and the lifecycle actively misreports the result.

## Proposed Direction

**A skill, not a mode.** A `/write` process skill (name open, see below) that
shapes the turn the way `/research` does: prose instructions, no hooks, no
gates, nothing changes in the harness. Plus one small library change so the
planner, `list_plans`, and the admin UI recognize a `paper` document kind,
which is what makes "the planning folder as a document library" real rather
than a habit.

The strongest argument against building anything: the paper's own thesis
warns about layers added on top of layers, and yesterday needed none. So the
skill is deliberately thin and the lifecycle change is deliberately narrow.
High confidence a skill is enough; low confidence hooks or a prose lifecycle
are warranted yet.

### What the skill carries

1. **A load list, not `/catchup`.** Register presence, then read the plan
   folder's prose documents (thesis, outline, companions, shape docs) and
   nothing else. Skip lessons, health, extensions. State what was loaded.
2. **A voice sheet**, distilled from thesis.md and kept in the skill:
   declarative, short paragraphs, bold the one claim per section, a concrete
   example over an abstraction, no italic hand-off questions between
   standalone pieces, every paper names its reader, its thesis in one line,
   and the verdict it closes on, and ends with "What this paper is not."
3. **The outline discipline** thesis-outline.md already models: per
   paragraph, what it achieves and why it sits where it does. Outline before
   draft; the outline is updated in the same turn the draft moves, or the
   skill says it is stale.
4. **The thinking-partner stance.** AGENTS.md conduct plus the research
   skill's principle: let the user ask the next question rather than
   answering ten at once. Thinking-aloud turns get a few sentences and no
   edits.
5. **A read-as-the-reader pass.** For each paper: name the reader, read it
   cold, does the opening stand without its companions, does the close land
   as a finding or as a cliffhanger, where does it depend on a term the
   reader does not have.
6. **A falsify pass for arguments.** Strongest objection per section; claims
   asserted without support; where two papers in a set disagree with each
   other. Recorded in the plan folder, the way a Falsification Phase is.
7. **Output is files in the plan folder.** The plan copy is canonical.
   Publishing is a separate step, below, that copies outward and records
   where the copy went.

### The document kind

- A `paper` kind, declared in frontmatter (`kind: paper`) rather than
  inferred from filenames, so a thesis, a shape document, and a paper can all
  declare it. Status vocabulary reuses the existing one where it fits
  (`draft`, `accepted`) and adds `published` for a paper that has gone to the
  docs site.
- A plan may be paper-only, with no impl. `list_plans` reports its stage
  from the papers' statuses instead of `unknown`, and its next step is never
  "Create a brief" for a folder that declares papers.
- A plan may be a **living master** (indusk-v4-day, indusk-v2-dawn) with a
  `master.md` and no brief. That is a second unknown-stage case the same
  change should settle, or explicitly not settle; see open questions.
- Admin UI: render papers as markdown under the plan, with status. Read-only,
  per the existing decision.

### Publishing

A paper leaves the repo. The first destination exists today: the VitePress
site at `~/code/site`, deploying to GitHub Pages from `.github/workflows/
deploy.yml`, remote `infinitedusky/infinitedusky.github.io`. It already
carries one essay, a hand-copied thesis committed 2026-09-08, with no record
in the plan folder that the copy exists. That copy is now behind the plan
copy (the thesis was split into three papers the same day) and nothing can
tell.

So publishing is configured, not conventional, because the destination is
outside the repo and differs per project:

- `config.json` gains a `papers` block naming destinations: a path (the
  site's `writing/` directory), how frontmatter maps (VitePress `title`,
  `description`), and whether the destination's nav or sidebar must be
  updated (lesson on file: always add new docs pages to the sidebar).
- The publish step copies the paper, applies the mapping, updates the nav,
  and **commits in the destination repo, siloed, without pushing.** The
  site deploys on push, so a push is publication to the world; it is the
  user's action or an explicit `--push`.
- It records, in the paper's frontmatter, the destination path and the
  destination commit, and sets status `published`. A drift check compares
  the plan copy to the published copy by hash, so a paper edited after
  publication shows as `published (stale)` rather than `published`.
- The docs site inside the repo (`/strategy`) stays `/document`'s job by
  convention. The `papers` block is for destinations that are not the repo.
- **Addressing.** A destination is a path (with `~` expanded) from a normal
  repo such as dusk, which cannot see another workbench's declarations. From
  inside a workbench it may instead be a declared repo name from
  `worktree.repos[]`, resolved through the existing `repoDir` reader. Both
  forms resolve to a directory that is a git repo; nothing else is required
  of the destination.
- **How a destination gets added.** `update` ensures an empty
  `papers.destinations` block the way it ensures the `cleanup` and decay
  blocks, so the key is always present. On the first publish with no
  destination configured, the skill asks for one and writes it into
  `config.json` itself; the user never has to hand-edit the file. No CLI
  subcommand in v1; `indusk papers destination add` is a follow-on if
  hand-editing turns out to be the friction.

The site is reachable from the career workbench as a symlink,
`~/code/career-workbench/site -> ../site`, but the workbench's
`worktree.repos[]` declares only `career`. Verified 2026-09-09. An
undeclared symlink is exactly what the workbench convention forbids
(topology is declared, never inferred): `workbench restore` will not
reproduce it on a clone, and nothing InDusk-side can address it by name.
Declaring the site as a second repo there is a one-line config change and is
what lets a `papers` destination name a repo rather than an absolute path.
The site itself has no `.indusk`, which the publish step must tolerate: the
destination is a directory and a git repo, not an InDusk project.

## Context

- **Why the papers live in the repo.** They are the "why" that Day's
  sub-plans assume; master.md and pr-shape.md link to them. Moving them to a
  chat app's project library would fork them from the plan within a week.
  The skill exists so that staying in the repo costs nothing.
- **Skill invocation.** Skills are invoked through the harness's native
  `Skill` tool, two ways: the user types `/name`, or the model calls it on
  its own because the skill's `description` (SKILL.md frontmatter) matches
  the task. The description is the routing key and is the only thing the
  model sees before deciding. This repo's skills use `name`, `description`,
  and `argument-hint`. So the writing skill's description must name its
  triggers plainly: drafting, outlining, or revising a paper, thesis, essay,
  or argument in the planning folder.
- **Neighbors.** `/research` is the closest relative (conversational,
  thin). `/document` is not: it records what was built for the docs site.
  `/retrospective`'s compaction step is unrelated. The writing skill is a
  core process skill, not an extension, because it carries no tool
  knowledge.
- **Package-owned.** Lives in `apps/indusk-mcp/skills/`, syncs to every
  project on init/update, pinned by the skill-sync parity test. The
  `paper` kind lives in `lib/plan-parser.ts` (stage detection) and the
  admin reader.

## Scope

### In scope

- The skill file, with a description tuned for model invocation.
- The `paper` document kind: frontmatter, stage detection in `list_plans`,
  admin UI render.
- The publish step and the `papers` config block, with the drift check.
- A docs page under `/reference/skills/`.
- Running the skill against indusk-v4-day as its own acceptance test (the
  lesson: point the tool at itself before calling it done).

### Out of scope

- Hooks or gates for prose. Nothing blocks a write.
- A prose rubric for the eval agent. Open question below; deferred.
- Publishing to the repo's own docs site (`/strategy`). That stays
  `/document`'s job by convention; the `papers` block is for destinations
  outside the repo.
- Pushing. The publish step commits in the destination and stops. Deploy is
  the user's push, or an explicit flag.
- Any change to how the harness renders long text.

## Open Questions

1. **Name.** `/write`, `/paper`, `/essay`. `/write` is the broadest and the
   most likely to be invoked by the model on a plain-language request.
2. **The eval agent on prose commits.** Skip by path, score with a prose
   rubric, or leave the code rubric and accept noise. Deferred; the skill
   does not depend on it.
3. **Living masters.** Should the same change give `master.md`-only plans a
   real stage, or is that a separate fix? It is the same `unknown` symptom
   with a different cause.
4. **Outline staleness.** Detect it (outline older than draft by mtime or
   commit) or only instruct against it. Start with the instruction.
5. **The site's existing thesis page.** It is the pre-split thesis. Replace
   it with the three papers, keep it as the long-form original alongside
   them, or retire it. The first publish run has to decide, and the
   decision should be recorded in the paper set, not only in the site.
6. **Config shape.** One destination per project, or a list keyed by name
   so a paper can declare which destination it publishes to. Start with a
   list; a single entry is the common case and costs nothing extra.

## Success Criteria

- A fresh session runs the skill on indusk-v4-day and has the thesis, the
  outline, the shape, and the three papers loaded, with no lessons or health
  output.
- `list_plans` reports indusk-v4-day with a real stage derived from its
  papers, and a next step that is not "Create a brief."
- The three papers each have a recorded read-as-reader pass and a falsify
  pass in the plan folder.
- "Let's work on the grift paper" invokes the skill without the slash
  command.
- Publishing paper 1 to `~/code/site` produces a commit in that repo with
  the page and a nav entry, sets the paper's status to `published` with the
  destination recorded, and a later edit to the plan copy shows as stale.
  No push happens without being asked.
