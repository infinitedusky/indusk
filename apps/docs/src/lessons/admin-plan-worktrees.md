# Plans in Worktrees — Lessons

**Plan:** `.indusk/planning/archive/admin-plan-worktrees/` · **Reference:** [`indusk worktree`](../reference/cli/worktree.md) · **Closed:** 2026-09-18

Every plan is worked in its own worktree, and the admin and the plan tools
read only the trunk, so the plan being worked was the one plan whose progress
never showed. This plan made them read each plan's live copy. What it taught
that applies beyond it:

## Record the tie; never infer it from names

The first proposal matched a worktree to its plan by branch name. Reading
`indusk worktree create` showed two conventions already in use — it named
branches after the bare slug, while every plan worktree had been made by hand
as `plan/<name>` — and a name that does not match falls back silently to the
trunk copy, with nothing on the page to say a live copy exists.

What shipped is a record written by the one command that creates the
worktree, stored in the repository's shared git directory so every checkout
reads the same file, and checked against `git worktree list` on every read.
Every mismatch then has a name: gone, doubled, missing, malformed. Before
proposing a naming convention as the link between two things, read the code
that creates them and count the conventions already in use.

## Falsify a feature against the lifecycle it runs inside

None of the twenty planned tests found the worst bug. The retrospective's
Step 9 moves a plan's folder to `archive/` on its branch, and Step 10 releases
the assignment only after the merge. In that window the resolver handed every
reader a folder that no longer existed: `list_plans` threw, and every admin
page of the project returned 500. This plan's own close-out was the first to
cross it.

Falsification found it by asking what the plan's own close-out does to the
thing the plan built. For any feature that tracks a unit of work, list the
steps that move, archive or delete that unit, and test the window between
each pair.

## A shared record loses writes in practice

The record was read, changed and written back with nothing held in between.
Twelve concurrent `assign` runs kept six. The project already had a file lock
for exactly this; the record did not use it until a test counted what
survived. "The window is microseconds" is not evidence; the count is.

## A row passes when its reader is built

Three command tests asserted "the plan reads from it" by asking the plan tool,
which learned to read the record one phase later — so they could not pass
where they were placed. A fourth passed early for the wrong reason: "reads the
trunk after release" is also what a reader that ignores assignments shows.
Place `Passes at` at the phase that builds the component a test observes
through, and when a row passes early, ask whether the old behaviour would pass
it too.

## A test that slices a document must check its slice

A test read the retrospective skill's "Step 10" section and checked the order
of three commands in it. Its cutter searched for the next heading one
character into the current one, so the heading matched itself and the
"section" was one character long. Every structural slicer in a test should
assert its slice is non-trivial before the real assertions run.

## What we'd do differently

- Read the creating command before proposing the link; the record belonged in
  the first brief.
- Put the plan's own close-out steps into the test plan.
- Read `package.json`'s `name` before writing a `--filter` into a plan; four
  commands here filtered on a package that does not exist and matched nothing.
- Run formatters on the files a change touches, not on neighbours.
