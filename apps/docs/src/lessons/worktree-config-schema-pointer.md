---
title: Worktree Config Schema Pointer — Lessons
---

# Worktree Config Schema Pointer — Lessons

A two-line bugfix: the worktree extension's starter config pointed its editor
at `../../config.schema.json`, a file no project has. It took four phases, and
every phase after the first came from asking what the fix implied rather than
from the fix itself. Five of the corrections along the way were to our own
work.

## A guard that returns early for one case must not carry unrelated work behind it

`refuseIfIgnoreCannotHold` returns early when a workbench declares where every
repo's worktrees live. That is correct: a declared layout names its directories
exactly, so there is no deny-by-default rule to demand and nothing to refuse.

The ignore-rule top-up was sequenced *after* that return. So declared-layout
workbenches — the shape the project treats as modern — could never receive any
rule added later, and kept offering a package-owned file to their shared
remote. The early return was right about refusals and silently wrong about
everything standing behind it.

The fix is not to remove the return. It is to notice that two different kinds
of rule were sharing one code path: machine-local rules every layout needs, and
deny-by-default rules only a flat layout needs. Appending the second kind to a
declared layout would invert an ignore file the module refuses to rewrite —
so the naive fix was wrong too.

Before sequencing work after a guard, ask whether that work has anything to do
with what the guard decides.

## A positive result shows a mechanism ran, not which mechanism

The plan's one untestable assertion was whether an editor actually resolves the
pointer. Three attempts:

1. **Grey ghost text** offering `"preflight": []` looked like schema-driven
   completion. It was the editor's AI assistant, and it appeared identically
   with the pointer deliberately broken.
2. **A type error** reading `Incorrect type. Expected "string"` proved a schema
   was loaded. It did not prove *which* schema, or that the pointer selected
   it — an editor can map schemas to files by several means.
3. **A contrast** finally proved it: two schema files that disagree about
   whether one field may be a number, the pointer flipped between them,
   everything else held constant. The diagnostic tracks which file the pointer
   names.

When the claim is about *which* artifact is in play, the check has to vary that
artifact. An observation that is equally consistent with the broken state is
not evidence, however real the output looks.

Two caching traps sit on that path: a failed schema lookup is remembered until
the cache is cleared, so the file has to exist before the pointer names it.

## A test can pass because its query cannot see what it asks about

One falsification test asserted that git does not offer the package-owned
schema for commit. It passed before the fix existed.

`git status --porcelain` collapses an untracked *directory* into a single line.
The schema sat inside a directory git had never seen, so git printed the
directory, the filter looking for the file's path matched nothing, and the
assertion held vacuously. `--untracked-files=all` made it red for the reason it
claimed.

The generalization: before trusting a filter over a command's output, check
what that command actually prints in the failing case.

## Signature changes cannot be tested from the inside first

The fourth-phase test was first written as a unit test naming the function
signature the fix would introduce. The file failed to *load*, which by exit code
is indistinguishable from a failing assertion — an absent test wearing a
failure's clothes.

Rewritten to drive the behaviour through the CLI, a boundary that already
existed, it went red on its own assertion today. When the fix changes a
signature, reach the behaviour over a boundary that exists now.

## An enable-time hook is not an upgrade path

A hook that materializes package-owned files into a project runs once, when the
extension is enabled. Nothing re-runs it: the auto-enable pass skips what is
already enabled, and the update pass covers third-party extensions only. So a
project keeps whatever the hook wrote on the day it was enabled, forever.

A changelog promising that a file "arrives on the next update" is therefore
false unless the manifest declares an update hook. And when core needs to decide
*which* extensions refresh on update, that knowledge belongs in the manifest —
hardcoding an extension's name in the update command is the tool knowledge the
project's own conventions forbid.

## A file the package owns must never enter a shared repo

The schema tracks the installed version, so its correct contents differ per
machine. Committed to a shared workbench repo, two teammates on different
versions rewrite it at each other on every enable. Package-owned files under a
shared directory need an ignore rule by name, alongside the eval directory and
the lock file — real content, true only for this machine.

## What we would do differently

- **Audit a docs claim against the code before publishing it.** The
  declared-layout hole was found by checking a changelog sentence already
  written. Reading the function rather than describing the intention would have
  surfaced it a phase earlier.
- **When a falsification row claims something universal, check its fixture
  covers the universe.** The row said "never shared" and its fixture exercised
  one of two layouts. The wording was the signal.
- **Design a manual smoke as a contrast from the start.** All three attempts
  produced real output; only the third produced evidence.

The full record is in the archived plan at
`.indusk/planning/archive/worktree-config-schema-pointer/`.
