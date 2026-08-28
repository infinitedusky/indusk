---
title: "Versioned Workbench — Retrospective"
date: 2026-08-28
status: complete
---

# Versioned Workbench — Retrospective

Covers the plan as authored (14 phases, 32 trajectory rows, shipped 1.37.0) **and
the work that followed it** — 1.37.1 through 1.38.3, which came out of actually
using the feature on three real workbenches. Splitting those would have produced
two thin retrospectives and hidden where most of the learning was.

## What We Set Out to Do

Make a workbench reconstructible from its remote and shareable between machines.
A workbench holds the shared context — `.indusk/planning/`, `.claude/` skills and
lessons — while the repos it wraps live beside it. Before this, only the repos
were versioned. The planning history existed on exactly one laptop: lose it and
it was gone, get a second machine and there was no way to have it there too.

Concretely: `worktree.repos[]` as the repo set (with the legacy `wrapped_repo`
reducing to a one-element list), `workbench restore` to materialize a cloned
workbench, a commit → pull → push sync loop, and a `.gitignore` shape that keeps
worktrees and secrets out of the shared remote.

## What Actually Happened

**81 files changed, +7600/−888** across the plan and its follow-on work.
Four releases: 1.37.0 (the plan), 1.37.1, 1.37.2, 1.38.0–1.38.3 (the follow-on).

The plan itself went roughly as designed. Thirteen phases closed green, both
close-out rituals ran, 32 rows terminal. Falsification found seven real defects;
cleanup found three layout facts each written down twice.

Then the plan closed, and we used it. That is where the interesting part happened:
**using it on three real workbenches found about eight more defects than the whole
planned process did.** Not because the process was slack — falsification and
cleanup both did real work — but because every fixture in the suite was built by
the same hands that built the feature, and shared their blind spots exactly.

## Getting to Done

The post-close defects, in the order reality produced them:

| Found by | Defect |
|---|---|
| numero-workbench restore | A30's case in the wild: trunk is a real directory, reported as "trunk linked" |
| a skill-list report | two shipped skills had no frontmatter and could never register |
| numero's config | `migrate-layout` recorded nothing on a legacy `wrapped_repo` config — the shape it exists for |
| the same | `worktree create <slug>` ignored the declared location on a single-repo workbench |
| designing the nested layout | `sibling_parent` absolute-only, so nesting did not survive a clone |
| the same | `path`/`worktrees` limited to one segment, so `worktrees/A` was inexpressible |
| looper-workbench | `pnpm wt` scanned only the root — declared layouts were invisible to it |
| looper-workbench | `worktree create` died in bash: TS learned `repos_root`, the scripts did not |
| looper-workbench | provisioning and `post_create` ran with a cwd that did not exist |
| career-workbench | dangling symlink at the clone target → `File exists` for a path every check saw as absent |
| a health report | doppler `required: true` overrode its own `detect`, hard-erroring on projects with no Doppler |
| the same | the doppler check tested for a token file, so `doppler login` read as broken |

Twelve, in fact. Every one of them was found by a person using the thing, not by
the suite that was green the whole time.

**Shape numbers**: 8 findings raised across the plan's phases, 4 recorded as
considered-and-left-as-is. **Zero judged wrong by a human.** The most useful one
was self-indicting: Phase 13 exported two symbols nothing outside the module
called — the same dead-export class that phase had just deleted two of.

**Deferred Verification**: 1 row (SSH host aliases on a clean machine), mitigation
A15 — force the requirement into restore's printed out-of-band list. That
mitigation was observed working in the wild: the career-workbench restore printed
exactly that list on a machine that had never seen the workbench.

## What We Learned

**The case a feature exists for is the case most likely to be untested.**
`migrate-layout` exists to convert *legacy flat* workbenches, and every fixture
used the modern plural shape. `wt.sh` had to serve *declared* layouts, and its
tests all used the flat root. In both cases the feature was correct for inputs
the author already had and broken for the input that motivated it. This is the
same structural failure as the jj audit that stayed green for seven weeks by
scanning the wrong scope — the test and the code share an author, so they share a
blind spot.

**A two-lane contract breaks silently on one side.** This repo states the rule
explicitly — a TS module and its bash port change together — and 1.38.0 still
shipped `repos_root` in TypeScript with the shell scripts requiring
`sibling_parent`. Knowing the invariant is not the same as having a check for it.
The single-definition tests pin *count*, which cannot see a rename.

**A test can pass for the wrong reason in a way only inversion reveals.** The
portability test — the entire point of `repos_root` — passed with the fix
deleted, because `resolve(".")` happens to equal the workbench when the CLI's cwd
*is* the workbench. Nothing about reading it suggested that. Reverting the fix and
watching nothing go red is what exposed it.

**Byte-equality answers "did it sync", not "does it work".** `skill-sync-parity`
compared every package skill to its installed copy and passed on two files with
no frontmatter at all — two identical unregistrable files are perfectly in parity.
The check was well-built and asking a question adjacent to the one that mattered.

**A flag that overrides a check discards the correct answer.** Doppler's
`required: true` bypassed its own `detect` rule, which already asked exactly the
right question. The cost was not noise: a health check permanently red on every
project stops being read, which is worse than not having the check.

**Absolute paths in shared config name the machine that wrote them.**
`sibling_parent` was resolved against the process cwd and had to exist, so the
only way to express "the repos live inside the workbench" was a path unique to one
laptop. Relative-to-the-workbench is what makes a layout reproduce.

**Naming: a field should name its value, not a relationship.** `sibling_parent`
meant "the parent of the siblings", which stops being true the moment the repos
live inside the workbench — a field describing a layout it no longer governs.
`repos_root` is true in both shapes.

## What We'd Do Differently

**Test the migration input, not the migrated output.** Both migration defects
would have been caught by one fixture built in the *old* shape. When a feature's
purpose is "convert X to Y", the fixture must start at X.

**Change both lanes in the same commit, and pin the field name.** The port tests
assert one definition exists; they should also assert both lanes read the same
config keys. A rename is exactly what a count-based test cannot see.

**Run the documented invocation on a real target before calling a plan done.**
Every post-close defect was reachable in under a minute of real use. The plan had
a Deferred Verification row acknowledging that a second machine was unavailable —
but numero-workbench was available the whole time and would have caught four of
them.

**Don't publish while work is in flight.** Twice a version was published while
more work sat uncommitted, and twice the local version number briefly described
contents that were not in the published tarball of the same number. Caught both
times by checking the published artifact rather than trusting the number.

**Retract instructions once they are done.** A `npm publish` line left in a
message after the publish had succeeded got run again and produced a confusing
"cannot publish over previously published versions" error. State that ages is a
cost paid by the reader.

## Insights Worth Carrying Forward

1. Green suites measure what the author imagined. Use is the only source of the
   inputs they didn't.
2. When a feature converts A to B, the fixture must be A.
3. Invert every fix. A test that stays green without its fix is measuring
   something else.
4. Ask what a check *proves*, not whether it passes. Parity, presence, and
   correctness are three different questions.
5. Config fields are shared across machines — absolute paths and
   relationship-names both go stale.
