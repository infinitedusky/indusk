---
title: "Lessons from stale-indusk-docs-path"
date: 2026-07-06
---

# Lessons from `stale-indusk-docs-path`

A small, mechanical fix — 20 dead path references left over from the `apps/indusk-docs` → `apps/docs` rename — became the first real dogfood of the `planner-hotfix-mode` workflow. Two lessons worth carrying forward, plus one process observation.

## "Fixed" means fixed where consumers actually look, not just in the working tree

The Ship phase fixed every agent-facing skill file in the git repo, shipped a PR, and the trajectory row passed. Then `/falsify` asked the obvious question a happy-path author doesn't: *who actually reads these files, and where do they get them from?*

The answer was uncomfortable. `npm pack @infinitedusky/indusk-mcp@latest` — the actual, currently-published version anyone gets from `npx indusk-mcp init` — still shipped every one of the broken files. The published VitePress docs site had the same staleness across ten reference pages. A git commit to the source repo fixes the source repo. It does not touch a separate publish or deploy step.

This generalizes past this one bug: any fix to content with a distribution step (a published package, a deployed site, a CDN asset) isn't "done" when it merges — it's done when the distribution step runs. Ask "does this need to be published to reach consumers?" while defining scope, not after falsification surfaces the gap.

## Grep width is a lower bound, not a guarantee

Both fixing passes in this plan — the original Ship phase and the Falsification phase — under-scoped on their first attempt. The initial search pattern (`apps/indusk-docs`, with the path prefix) missed the relative-link form (`../../indusk-docs`) and several sibling extension-skill files that a narrower directory scope skipped over. The falsification investigation repeated the mistake at a larger scale before widening to a bare-string search across the docs site.

Each time, the fix was to re-run with a wider net and recount, not to trust the first pass's completeness. For "find every reference to X" bugs, start with the widest reasonable search — a bare string match, not the expected prefix — and narrow from there by excluding what's genuinely out of scope, rather than starting narrow and hoping nothing was missed.

## Process observation: git and npm can silently diverge

Investigating the version bump surfaced that `origin/main`'s `package.json` and changelog trailed the actual latest published npm version by nine patch releases — those versions were published from feature branches that were never merged back to `main`. Not something this plan fixed (out of scope, unrelated root cause), but worth knowing: in a fast-moving, heavily-branched repo, "what does `main` say the version is" and "what's actually published" are two different questions, and only one of them is authoritative for a version bump.
