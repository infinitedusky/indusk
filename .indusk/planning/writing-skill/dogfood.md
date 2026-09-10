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

**Result**: not yet run.

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

**Result**: not yet run.

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

**Result**: not yet run.

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

**Result**: not yet run.
