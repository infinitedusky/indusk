---
title: Versioned Workbench — Lessons
---

# Versioned Workbench — Lessons

The plan closed green: 14 phases, 32 terminal trajectory rows, falsification and
cleanup both run, seven defects found and fixed by the rituals. Then it was used
on three real workbenches and **twelve more defects surfaced within the hour**.

That gap is the lesson. Everything below is a way of describing it.

## The case a feature exists for is the one most likely to be untested

`workbench migrate-layout` converts a *legacy flat* workbench to a nested layout.
Every fixture in its suite used the modern plural config shape, so the moves were
tested and the step that records where things went was not — on exactly the
configs the migration exists for. The worktrees moved and nothing was written
down, so the next `worktree create` put a worktree back at the root and the
cleanup silently undid itself.

`wt.sh` had the same shape of hole: declared worktree layouts shipped a release
earlier, and its tests all used the flat root, so a worktree in a declared
directory was *invisible* rather than ambiguous.

**When a feature converts A to B, at least one fixture must start at A.** A suite
made entirely of B proves the feature works for inputs that never needed it.

## Ask what a check proves, not whether it passes

Three checks in this codebase were green, well-built, and answering a question
adjacent to the one that mattered:

- **Parity ≠ correctness.** A test compared every packaged skill to its installed
  copy byte-for-byte. Two of those skills had no frontmatter and could never
  register — and two identical *unregistrable* files are perfectly in parity.
- **Presence ≠ capability.** A health check tested for a service-token file. The
  normal path is an interactive login that needs no such file, so the check went
  red on working setups.
- **An override discards the correct answer.** An extension marked
  `required: true` bypassed its own `detect` rule, which already asked precisely
  the right question, and then hard-errored for a credential most projects had no
  use for.

A check permanently red on healthy systems trains people to ignore the report; a
check permanently green on broken ones is a false guarantee. Both are worse than
no check.

## Invert every fix, or the test may be measuring something else

The portability test for `repos_root` — the entire point of the feature — passed
with the fix deleted. `resolve(".")` happens to equal the workbench when the
CLI's working directory *is* the workbench, so the test proved nothing. Nothing
about reading it suggested that.

Reverting the fix and watching nothing go red is what exposed it. The repair was
to invoke the CLI from a subdirectory, so cwd and workbench differ.

## A two-lane contract breaks silently on one side

This repo states the rule explicitly: a TypeScript module and its bash port change
together. 1.38.0 still shipped `repos_root` in TypeScript with the shell scripts
still requiring `sibling_parent`, so `worktree create` died on every workbench
using the new key.

The single-definition tests pin the *count* of definitions, which cannot see a
rename. **Knowing an invariant is not the same as having a check for it.**

## Config fields are shared; absolute paths and relationship-names both go stale

`sibling_parent` was an absolute path in a file that syncs between machines, so it
named whoever wrote it. And its name described a relationship that stops holding
in the layout it was later asked to express.

A config field should name its value, and a location that must reproduce
elsewhere should be relative to something both machines have.

## See also

- [`indusk workbench`](../reference/cli/workbench.md)
- [Sharing a workbench](../guide/workbench-sharing.md)
- [Decision: versioned workbench](../decisions/versioned-workbench.md)
