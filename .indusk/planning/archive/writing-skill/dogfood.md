---
title: "Writing skill — dogfood procedures"
date: 2026-09-09
status: draft
---

# Writing skill — dogfood procedures

The four manual trajectory rows (A4, A13, A18, A19). Each is a procedure with
its expected observation. Results are recorded under each procedure when
Build Phase 6 runs them; until then the rows are `written`, meaning the
procedure exists and has not been run.

## A4 — the Day plan reports a real stage

**Procedure**

1. In `indusk-v4-day`, confirm `thesis.md`, `obsolescence.md`,
   `paper-1-the-grift.md`, `paper-2-the-landscape.md`, and
   `paper-3-the-right-way.md` carry `kind: paper`; the outline, the shape,
   and `master.md` do not.
2. Call `mcp__indusk__list_plans` with no arguments and find `indusk-v4-day`.
3. Open the plan in the admin UI (`indusk ui`, then `/p/dusk/plan/indusk-v4-day`).

**Expected**

- `stage: "paper"`, `stageStatus` the least-advanced paper's status, and a
  `nextStep` that is not "Create a brief".
- `papers` lists five entries with the five titles.
- The admin page shows a Papers section with five entries and a badge each;
  no "malformed" notice.

**Result (2026-09-09, from the plan worktree)**: observed as expected on
the real tool path. `list_plans` called over stdio against the worktree's
built `indusk serve` (the trunk's MCP server runs the published code and
reads the trunk's undeclared documents, so it cannot see this): `stage:
"paper"`, `stageStatus: "draft"`, `nextStep: "Review paper:
obsolescence.md"`, five papers in filename order with their titles;
`paper-1-the-grift.md` is `published`, `stale: false`, the other four
`draft`. The admin reader (`readActivePlans` on the worktree) reports the
same five with the same statuses and header status `draft`. The live daemon
was not consulted: it serves the published admin bundle against registered
projects, and this worktree is neither; the Papers section's rendering is
proven by A5 against this exact shape.

## A13 — the documented publish command, verbatim

**Procedure**

1. In `~/code/site`, on `main`, clean: add `writing/index.md` carrying
   `<!-- papers:start -->` / `<!-- papers:end -->`, change the nav link in
   `.vitepress/config.mts` to `/writing/`, commit by hand. Note `git rev-parse
   HEAD` and `git log origin/main..main` (empty).
2. In dusk, confirm `.indusk/config.json` has the `blog` destination
   (`path: ~/code/site`, `dir: writing`, `index: writing/index.md`) and that
   paper 1 is `accepted` and committed.
3. Copy the publish command from `apps/indusk-mcp/skills/write.md`'s Publish
   section and run it unchanged, from the dusk root.

**Expected**

- Exit 0; stdout names the destination and the destination commit.
- `~/code/site`: exactly one new commit, subject `publish: The pernicious
  grift (source <8 hex>)`; `writing/the-pernicious-grift.md` present with
  `title` and `description` and no `kind`/`status`/`published`;
  `writing/index.md` lists it between the markers and is otherwise unchanged;
  `git status` clean; `git log origin/main..main` shows the one commit, so
  nothing was pushed.
- dusk: paper 1's frontmatter has `status: published` and a `published` block
  with `destination: blog`, the path, the destination short commit, the
  source short commit, and a `sha256:` hash; one new commit `chore(papers):
  publish paper-1-the-grift.md to blog (<short>)`; working tree clean.

**Result (2026-09-09, from the plan worktree)**: observed as expected, with
two notes.

- Site prep committed by hand as `d995ddc` ("Writing index with the papers
  markers; nav points at the index"), on `main`, clean, 0 unpushed before.
- Command run: `indusk papers publish indusk-v4-day/paper-1-the-grift.md
  --to blog`, with `indusk` being the worktree's built CLI
  (`node apps/indusk-mcp/dist/bin/cli.js`), because the global `indusk` is
  the published 1.43.0 and has no `papers` command until this ships. The
  argument text is the skill's line unchanged.
- Exit 0. Five warnings on stderr: links to `thesis.md`,
  `papers-outline.md`, `obsolescence.md`, `paper-2-…`, `paper-3-…` left as
  is, none published. Correct, and worth knowing: the paper's preamble
  paragraph links its siblings by plan filename, so on the site those are
  dead links until the siblings publish or the preamble is revised. An
  editorial hotfix, not a defect.
- Site: one new commit `c12faa3 publish: The pernicious grift (source
  1ad363e1)`; `writing/the-pernicious-grift.md` present with `title` only
  (paper 1 declares no `description`, so none travelled); `writing/index.md`
  lists it first, then the pre-split thesis page with its description; `git
  status` clean; `origin/main..main` shows 2 commits (the hand prep and the
  publish), nothing pushed.
- dusk worktree: paper 1 reads `status: published` with `published:
  {destination: blog, path: writing/the-pernicious-grift.md, commit:
  "c12faa3", source_commit: "1ad363e1", hash: sha256:e4867e78…}`; the
  `date: 2026-09-08` line and the quoted title survived byte-for-byte; one
  new commit `86646e85 chore(papers): publish paper-1-the-grift.md to blog
  (c12faa3)`; the paper file clean.

## A18 — plain-language invocation

**Procedure**

1. Open a fresh Claude Code session in dusk. Do not run `/catchup` or any
   slash command.
2. Say exactly: "let's work on the grift paper".
3. Watch the first tool call.

**Expected**

- The first tool call is the `Skill` tool invoking `write` (visible as
  "Launching skill: write" or the skill's instructions loading), before any
  file is read.
- Record the exact phrasing used and whether the skill was invoked. If it was
  not, record what the session did instead; the fix is the description text
  and the run is repeated.

**Result (2026-09-09, from the plan worktree)**: **not observable here;
re-run after merge.** A fresh context (a subagent in the worktree) was given
exactly "let's work on the grift paper". Its first call was a grep, which
found the paper and the `write` skill; it then chose the skill as the one
that should govern the work and planned to read its file, reporting that
`write` was not in its Skill listing. That is the environment, not the
description: Claude Code discovers skills per project, and
`.claude/skills/write/` exists only in this worktree until the branch
merges to the trunk. So this run says the wording finds the right skill by
search, and says nothing about routing. The procedure stands as written and
must be run in a fresh session on the trunk after merge; the trajectory row
is `skipped` with that reason until then.

## A19 — the skill on the Day folder

**Procedure**

1. In a fresh session in dusk, run `/write indusk-v4-day`.
2. Read the session's load report.
3. Ask it to run the read-as-the-reader pass and the falsify pass on each of
   the three papers.

**Expected**

- The load report lists the Day folder's prose documents (the thesis, the
  outline, the papers outline, the shape, the obsolescence piece, the three
  papers) and says lessons, health, and extensions were skipped; no lesson
  titles and no health output appear anywhere in the transcript.
- After the passes, the plan folder contains one recorded read-as-the-reader
  pass and one recorded falsify pass per paper (three of each), each naming
  the paper, the reader, and the findings.

**Result (2026-09-09, from the plan worktree)**: the skill's instructions
did what the row asserts; the invocation went through the file, not the
Skill tool. A fresh context (a subagent in the worktree) asked the Skill
tool for `write` and was refused ("Unknown skill"), the same per-project
discovery limit A18 hit, so it read `apps/indusk-mcp/skills/write.md` and
followed its Load step and both passes verbatim.

- Load report: all nine Day documents, one line each with title and status;
  the five papers marked `kind: paper`, paper 1 shown as `published` with
  its destination, path, and both commits. It ran `indusk agent register`
  first. It called `mcp__indusk__list_plans` because the skill names it,
  and noted the tool returned no `papers` field: that server is the trunk's
  published one, which predates the field; on the worktree's own server the
  field is present (see A4).
- Lessons, health, extensions: none called, nothing from them appears in
  any review file or the report.
- Three review files written, none of the papers touched, nothing
  committed: `paper-1-the-grift.review.md`, `paper-2-the-landscape.review.md`,
  `paper-3-the-right-way.review.md`, each with `## Read as the reader` and
  `## Falsify the argument`.
- Findings the author should see first, one per paper: the published page
  carries the plan-folder preamble with five dead links (an editorial
  hotfix); paper 2's "order of magnitude per engineer" is unsupported and
  unhedged where paper 1 hedged its 3x; paper 3's "ship as one thing" is
  present tense while `master.md` and `pr-shape.md` mark most of it not
  built. Two cross-paper disagreements recorded in all three files, and
  `papers-outline.md` is stale against paper 1 by the skill's own rule.
