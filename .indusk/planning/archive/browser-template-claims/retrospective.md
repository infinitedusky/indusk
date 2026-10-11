---
title: "Browser template claims — retrospective"
date: 2026-10-11
---

# Retrospective — browser-template-claims

## What We Set Out to Do

One promise, `a-propagation-entry-covers-what-it-names`: a propagation entry sends the click's trace to the requests it names and to no others, for exact and pattern entries alike. Plus one corrected line of documentation: the reference page said a `.then()` chain follows the click, which the template (no async-aware context manager) does not do.

## What Actually Happened

- **Build Phase 1:** an exact entry keeps its path (`/v1` covers `/v1/seats`, not `/v2` or `/v10`); a pattern entry's written default port (`:443`/`:80`) is optional; the docs line was corrected and pinned by a test that reads the pages.
- **Build Phase 2 (falsification):** path compared as written (the `i` flag had been widening `/Admin` to `/admin`); the docs guard's "not" exemption narrowed so a reworded claim cannot slip through; the promise's code site named.
- **Build Phase 3 (after the cold audit):** a query or fragment on an entry is cut for every entry — an exact entry dropped it and a pattern entry kept it literally, so the "treated the same way" clause was untrue; the template's header comment now states the rules.
- Diff: 6 code/doc files, about +190 / −20, plus the plan documents.

## Getting to Done

- A worktree made by `plans start` has no `node_modules`; `pnpm install --frozen-lockfile` first.
- `declare_promise` over MCP refused (it reads the trunk, where the plan folder is not yet); `indusk promises declare` from the worktree worked.
- A cold audit claimed a pattern entry with a trailing slash was dead; evaluating the shipped compiler showed it matches (the trim happens before the branch). The query claim in the same audit was true and became Build Phase 3. Audit findings are leads, not verdicts.

## What We Learned

- A parity clause in a promise ("exact and pattern treat it the same way") is a conjunction of every input class; each class needs a row. Path, port, case and query were four separate defects behind one sentence.
- A guard that reads prose (the docs test) must be tested against a reworded violation, or an exemption word defeats it.

## What We'd Do Differently

- Falsify the plan's own promise wording before writing rows: "the same way" would have produced the query, case and trailing-slash rows in the test plan instead of in three later phases.

## Audit findings left open (advisory)

- `*://host:443` keeps the port literal: `*` could be `http` or `https`, whose defaults differ. No row pins it.
- A pattern entry with an upper-case host works (scheme and authority are lower-cased) but no row names it.
- `init`'s printed instructions do not mention paths, default ports or case; the installed skill copy and existing projects' template copies update only at `indusk update` / re-init (`known-issues.md` carries the second).
- T5's keyword heuristic is narrower than "the docs say only what the template does"; a claim with none of its tokens passes.

## Shape numbers

Shape raised nothing in Build Phases 1–3 and Test Phase 1: 0 findings, 0 judged wrong by a human.

## Release

Nothing published; this project installs its own build at landing.
Landed on main at 73f114bf, 2026-10-11.
