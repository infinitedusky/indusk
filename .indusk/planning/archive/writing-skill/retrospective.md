---
title: "Writing skill — papers as first-class plan documents"
date: 2026-09-10
---

# Writing skill — Retrospective

## What We Set Out to Do

Make a paper written inside a plan folder something InDusk can see, review,
and publish with the discipline of code. The brief named four ways the
system was tuned for code and a session spent writing paid for each: the
lifecycle reported a folder of finished essays as `unknown` with next step
"Create a brief"; the close-out rituals assumed a diff; catchup loaded
engineering lessons and a telemetry health check; and nothing packaged the
two things that had made a writing session work, the plan folder as a
corpus and the conduct rules in AGENTS.md. The ADR decided a declared `kind:
paper` document kind, a prose-only `/write` skill, and `indusk papers
publish` to a configured destination outside the repo, with provenance
written back and staleness derived rather than stored. The plan's own
acceptance test was to point all of it at the Day papers and put paper 1 on
the blog.

## What Actually Happened

All of it shipped, in one worktree, across one test phase, six build phases,
a falsification phase, and a cleanup phase. The diff against the merge base
is 59 files: 22 code files (+1,375), 12 test files (+1,147), 23 markdown
files (+3,669, most of them the three papers and their reviews). Thirty-one
trajectory rows: thirty passing, one skipped with its reason.

Three things diverged from the ADR, each recorded in the impl where it
happened:

- **Provenance is a text edit, not a gray-matter round trip.** Checked
  before writing it: js-yaml re-dumps `date: 2026-09-09` as an ISO
  timestamp and strips quotes, so every publish would have rewritten lines
  it had no business touching.
- **The hash drops `status` as well as the `published` block.** A publish
  flips `accepted` to `published` in the same write-back, so a hash that
  included status would read stale the instant it was written.
- **Divergence is a commit comparison, not a hash.** "The page's last
  destination commit is not the one the paper recorded" needs no extra
  provenance key, and a hand copy with no record counts as diverged, which
  is exactly the blog's pre-split thesis page.

Two of the four manual rows could not be observed from the worktree. Skill
discovery in Claude Code is per project, so a skill that exists only on a
branch cannot be routed to, and the Skill tool refuses it by name. A fresh
context found and chose the right skill by search and then followed its
file verbatim, which proved the instructions; routing itself waits for a
trunk session after merge. That is recorded as a skipped row with its
reason, not as a pass.

## Getting to Done

The rituals did their job, and one thing outside them nearly undid it.

**Falsification found eight defects by reading.** The sharpest was the one
confirmed without running anything: `published`, a status word this plan
invented in Build Phase 1, was never added to `archive-dead`'s blocking
set, so a plan carrying a published paper would have been swept as a dead
draft after thirty days, moving the source the hotfix path publishes from.
Six build phases and their gates never noticed, because no gate asks "which
detectors are keyed on the vocabulary you just extended". The other seven:
sibling pages left with dead links and no stale signal; two titles that slug
the same overwriting each other; a status hand-set back to `accepted`
reading up to date forever; the index reshuffling on a hotfix; a failed
push leaving a half-applied run the next publish mislabeled as divergence;
a retitle orphaning the old page; and git failures escaping as stack traces
past a commit. One hypothesis test was green at first for an uninteresting
reason and had to be extended by one publish before it went red on the real
defect.

**Cleanup moved four things to where the codebase's rules already said
they belonged**: paper parsing out of the lifecycle parser, the `published`
block's read shape beside its write shape (pinned to one definition by
count), the snapshot-and-restore pair into `lib/git.ts`, and the admin
section into its own file. It also left seven things alone with reasons.

**Something stashed the working tree, twice.** Seconds after two of my
commits, a `git stash` appeared in the plan worktree and was never popped.
The first time it was masked by a full rewrite that followed. The second
time it reverted the git primitive move mid-phase, and the next commit
landed with the tree in a mixed state: `git.ts` without the primitives it
had just gained, `publish.ts` importing them while still carrying the old
code. A31, the unit written for exactly that primitive, is what caught it:
"snapshotPaths is not a function" on a test that had passed minutes
earlier. Nothing in the rail's own code greps for `stash`, so the likely
actor is the evaluator session the commit hook spawns. Recovery was
additive: apply the stash, verify, commit the real work as its own commit,
drop the entry. A critical highlight is filed; a rail that stashes the
working agent's tree is a defect in the rail.

**The trajectory table lagged the checklist once.** A1 through A3 passed at
Build Phase 1 and their rows still read `written` three phases later; the
check-gates hook caught it at the first Build Phase 4 checkoff. The lesson
already exists on file. It happened anyway, which says the lesson is a
reminder and the hook is the control.

**Shape could not see the test phase.** `prepareShapeReview` keys by plain
phase number, so for an impl with test phases "phase 1" is Build Phase 1's
gate and Test Phase 1 reports "not green" after its gate is closed. The
review was done by hand from the same inputs. A highlight is filed.

## What We Learned

- **A new vocabulary word must be registered with every detector keyed on
  that vocabulary, in the commit that introduces it.** The status-keyed
  detectors today are `archive-dead`'s blocking set and `plan-tools`'s
  active set. Nothing but a reading found the gap.
- **Frontmatter written back by a tool must be a text edit.** Any library
  round trip normalizes what it did not mean to touch; the date line was
  the visible case.
- **Skill discovery is per project.** A skill on a branch cannot be routed
  to from a worktree; plain-language invocation is only checkable on the
  trunk after merge. Plan the manual row that way from the start.
- **A test that passes on day one for an uninteresting reason is not a
  hypothesis test.** A25 was green because the index regenerates before
  the commit; it became a real test only when extended past that boundary.
- **A focused unit for a moved primitive is the thing that notices when the
  tree is not what you think.** A31 caught an external stash that no other
  signal would have.
- **The publish step's rollback needs a snapshot of every path it touches,
  including a rename's old name.** Restoring "the page" is not enough once
  a retitle moves it.

## What We'd Do Differently

- **Commit the impl's progress with each item, not only at phase close.**
  Uncommitted impl edits were exposed to the stash twice; everything
  committed survived. The convention says one commit per item; the impl
  should ride in it.
- **Add "which detectors read this vocabulary" to the ADR template's
  Decision section** for any plan that introduces a status or kind word.
  The falsification found it; a checklist line would have found it in
  Build Phase 1.
- **Write the manual invocation row as a post-merge row from the outset**,
  with `Passes at` in a follow-on, rather than skipping it at the end.
- **Run git with absolute paths from the first command.** Three commits in
  this session failed on a pathspec because the shell's working directory
  had moved between calls; each cost a round trip and one nearly masked the
  stash.

## Insights Worth Carrying Forward

- The like-code policy for papers (source in the plan, destination a build
  artifact, hotfix is a commit then a publish) held up under falsification
  without an exception. Every defect found was in the mechanism, none in
  the policy.
- Reading the code against the ADR's claims found more than the tests
  did: eight of eight falsification hypotheses confirmed, one by reading
  alone. The ritual's value is the goal flip, not the test count.
- The three Day papers now have review files with substantive findings
  (an unsupported order-of-magnitude claim, present-tense claims about
  unbuilt components, two cross-paper disagreements) that the author has
  not yet acted on. That is the writing skill working as designed.

## Quality Ratchet

No Biome rule emerged. The mistakes were process, not syntax: a table
lagging a checklist (hook-enforced), pathspecs relative to a moved working
directory (a habit, recorded as a memory), and an unused import after a
refactor (an existing rule caught it).

Shape findings: **4 raised, 0 judged wrong by a human.** Build Phase 1
raised two (a named staleness rule, a named stage resolution), Build Phase 3
one (a named divergence rule), Build Phase 4 one (a named reader). Five
phases raised nothing. No human reviewed the four as wrong, so the streak
counter stands at zero; this is the first plan reporting under that
convention.

## Metrics

- Sessions spent: 1 (2026-09-09 into 2026-09-10)
- Files touched: 59
- Lines added/removed: +6,209 / −121
- Trajectory rows: 31 (30 passing, 1 skipped with reason)
- Falsification: 8 hypotheses, 8 confirmed, 8 fixed
- Cleanup: 7 extractions, 7 reasoned leave-as-is
- Commits on the branch at close: 49
- Published to the blog: paper 1, commit `c12faa3`, unpushed
