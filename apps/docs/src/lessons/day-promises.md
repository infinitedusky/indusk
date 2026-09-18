# Promises — Lessons

**Plan:** `.indusk/planning/archive/day-promises/` · **Decision:** [Promises](../decisions/day-promises.md) · **Closed:** 2026-09-18

What the day-promises plan taught that applies beyond it.

## A checker's own documentation is its first false positive

`indusk promises check` scans the code root for the token `promise: <name>`.
Run against this repository for the first time, it found six citations that
were nothing of the kind: a field named `promise` in a type annotation, a
package called `promise` in the lockfile, a test's example string — and, once
the rule was tightened, the docblock in `vocabulary.ts` that *describes* the
token. A file that documents a scanned marker carries the marker.

Two rules follow. Run a new checker against the repository that documents it
before its first build phase closes, not at the end. And write the
documenting files so they describe the marker without spelling it: "the
token followed by the name", `{ promise: <type> }`, never the literal.

## "Before the token" has two readings, and the first one was wrong

The tightened rule required the token to be the *first* thing after a
comment opener, so `// enforces promise: x` was refused as not naming the
promise. Falsification caught it. The rule that holds: a comment opener
(`//`, `#`, `/*`, `<!--`) anywhere earlier on the line, or a line-leading
docblock, SQL or ini opener, with any text between; a quote must come
*directly* before, or a type annotation on a line with an earlier string
literal becomes a citation. When a rule has a "before" in it, write down
which of the two readings it means and test the other.

## A path that exists is not a path that is what you meant

The owner check asked `existsSync` whether `.indusk/planning/<owner>` was
there. A file (`master.md`) and the `archive` folder both answered yes, and
both were accepted as plan owners. A plan is a *directory* under the planning
dir whose name is not `archive`. When a check is "does X exist", ask "is X
the kind of thing I mean" in the same breath.

## A read that reports problems must still return what it read

The first registry reader returned only the problems when any entry was
malformed. One bad file would have hidden every well-formed neighbour from
the admin page, which is the opposite of naming the bad file. The problems
travel with the partial registry; the page lists the good entries under the
error block. A reader's failure mode should never shrink the world it
reports on.

## A link path is a boundary value until it is guarded

`sites:` and `tests:` are joined onto the code root. Falsification put
`../outside.ts` in a promise and a token-bearing file one directory up, and
the shipped check read it and called the link satisfied. Every path a person
writes into a registry is guarded (`isUsableRelPath`) at read time, before
anything joins it — the same rule the workbench declarations already follow.

## The admin sees registered paths, not branches

Worktree-per-plan puts every plan in flight on `plan/<name>` in its own
checkout, and the admin daemon reads the trunk checkout that is registered.
So the live progress bars, built one plan earlier, never move for the plan
being worked until it merges. Registering the worktree as a second project
was tried and rejected within the hour: the worktree is not the project.
The fix belongs in the one plan inventory — resolve a plan's documents,
boundary record and ledger from its worktree when one exists — and it is
queued in the root master as the bugfix to do next.

## A "surely free" port is a coin flip

`daemon-identity.test.ts` assumes port 65001 is unbound. The local-telemetry
collector restarted mid-session and took it; the test went red for every
branch on the machine. Tests that need a free port bind and release one.
