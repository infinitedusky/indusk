# Writing Skill — papers as first-class plan documents

**Status:** accepted (2026-09-09) · shipped 1.44.0
**Full ADR:** `.indusk/planning/archive/writing-skill/adr.md`

## What was decided

Three things, deliberately thin:

- **A declared document kind.** A plan document that says `kind: paper` in its frontmatter is a paper. Never inferred from a filename. A folder of papers with no lifecycle document is a `paper`-stage plan instead of `unknown` with next step "Create a brief". Status vocabulary `draft | accepted | published`; anything else reads `malformed`. Staleness is derived on every read from a content hash the publish records, never stored, and shows as `published (stale)`.
- **A prose-only `/write` skill.** A writing session's catchup (load the plan folder's prose, skip lessons and health), a voice sheet distilled from the founding thesis, an outline discipline, the read-as-the-reader and falsify-the-argument passes, and the publish step. No hooks, no gates.
- **`indusk papers publish` to a destination outside the repo.** The plan copy is the source; the destination is a build artifact. Ten steps that refuse with nothing written when a precondition fails, commit in the destination without pushing, and write provenance (destination, commit, source commit, hash) back into the paper as a text edit of its frontmatter. A hotfix is a commit in the plan repo, then a publish; nobody hand-edits the destination.

## Rejected

Filename inference; a `papers/` subfolder; a hooks-and-gates writing mode; a provenance ledger under `.indusk/`; editing the destination's VitePress config for nav (the index page between two markers is the data the step owns); auto-push; merging hand edits at the destination.

## What falsification changed

Eight hypotheses, eight confirmed. The one found by reading alone: `published` was a new status word and no status-keyed detector had been told, so `archive-dead` would have swept a plan carrying a published paper after thirty days. The others hardened the mechanism: siblings left behind are named with the command that repairs them, slug collisions refuse, a reverted status republishes, the index keeps first-publish order, push runs last and fails as a warning, a retitle moves its page, and no git failure escapes past a commit the step made.

## Key tradeoffs accepted

- Every publish adds a provenance commit to the source repo.
- Existing documents declare `kind: paper` by hand.
- One manual nav change on first use of a destination.
- The skill's effect on prose is untestable; only its presence is pinned.
- Plain-language invocation is verified on the trunk after merge, because skill discovery is per project.

See also: [`indusk papers`](/reference/cli/papers), [`/write`](/reference/skills/write), [papers in `indusk plans`](/reference/cli/plans#papers-kind-paper), and the [lessons](/lessons/writing-skill).
