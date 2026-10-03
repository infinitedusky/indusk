# Context tiers — Lessons

What the [context tiers](/decisions/context-tiers) plan learned that applies
beyond it.

## Test the derivation, not only the artifact

A hook's refusal printed `lesson: test-red-at-earliest-writable-phase`, and the
test that read the hook's output passed. The lesson scan, which decides whether
a lesson is guarded, read the same lesson as unguarded: the token sat after a
`\n` escape inside one string, a position the token grammar did not accept.
When one system derives a fact from another's artifacts, test the derivation
against the real artifact.

## A register of claims needs reading back

The register's first check asked only that every row had a destination. A
second check — each enforcer row's file, read through the lesson scan — found
two of ten enforcer rows false on its first run: one hook carried no token at
all. A claim that something is enforced is checked by asking the enforcement,
not the claim.

## Every new reader repeats the workbench mistake

Three readers written in this plan — the lesson scan, `check-pointers`, and the
budget hook's handling of a plan worktree — looked only at the workbench root,
whose git ignores the code. The same mistake had already been fixed in tooling
detection and the cleanup scan. A rule scoped to the readers already bitten
does not reach the next one; writing each new reader over all four workbench
layouts does.

## A port copies the defaults too

The budget hook carries a JavaScript port of where a declared repo lives. Its
docblock named the rule it mirrored, and it still read an absent `repos_root`
as the workbench root where the rule reads its parent. It showed only when the
two were read side by side.

## What we would do differently

- Write the register's read-back check in the first test phase, before the
  root was rewritten around the two false rows.
- Never edit a hooked file from a script. It goes around the guards the plan
  exists to build; one edit went over budget that way.
