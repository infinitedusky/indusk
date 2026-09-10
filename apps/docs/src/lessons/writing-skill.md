# Writing Skill — Lessons

From the plan that made papers first-class plan documents (2026-09-09, shipped 1.44.0). Retrospective: `.indusk/planning/archive/writing-skill/retrospective.md`.

## A new vocabulary word must be registered with every detector keyed on that vocabulary

`published` was introduced as a paper status in Build Phase 1 and never added to `archive-dead`'s blocking set. Six build phases and every gate passed; a plan carrying a published paper would have been swept as a dead draft after thirty days. Falsification found it by reading the set. Gates check what you built, not the detectors that read the vocabulary you extended, and a status-keyed detector fails open. When a plan adds a word to a fixed vocabulary, grep for every set and switch over it and register the word in the same commit; put the list in the ADR so the checklist line exists.

## Frontmatter written back by a tool is a text edit

A gray-matter round trip re-dumps every key: `date: 2026-09-09` comes back as an ISO timestamp, quoted titles lose their quotes. Every publish would have rewritten lines it had no business touching. Edit the fence's text for the keys you own and leave every other byte; keep the round trip for hashing, where normalization is what you want.

## Skill discovery is per project

A skill that exists only on a branch cannot be routed to from a worktree, and the Skill tool refuses it by name. A fresh context found the right skill by search and followed its file, which proved the instructions and nothing about routing. Write plain-language invocation rows as post-merge checks from the start.

## A hypothesis test that is green on day one for an uninteresting reason is not a hypothesis test

The index-order row passed because the index regenerates before the destination commit, so the reorder shows one publish later. Extended past that boundary, it went red on the real defect. Ask why a falsification row is green before marking it written.

## A focused unit for a moved primitive is what notices when the tree is not what you think

Seconds after two commits, something running in the worktree stashed the working tree and never popped it; one commit landed with the tree in a mixed state. The unit written for the moved primitive failed with "snapshotPaths is not a function" on a test that had passed minutes earlier, while the wider suites stayed green through the old copy. On a regression of that shape, check `git stash list` before debugging the code, recover additively (apply, verify, commit, drop), and commit the impl's checkoffs with each item so they are not exposed. Nothing in a commit-triggered rail may stash the working agent's tree.

## Rollback snapshots every path it touches, including a rename's old name

Restoring "the page" is not enough once a retitle moves it; the snapshot takes the page, the index, and the old path, and the restore proves the staged-rename case.

## Shape cannot see a test phase

`prepareShapeReview` keys by plain phase number, so for an impl with test phases "phase 1" is Build Phase 1's gate. The test phase's review was done by hand from the same inputs. The phase key needs an ordinal or a kind; flagged for `lifecycle-rebalance`'s follow-ons.
