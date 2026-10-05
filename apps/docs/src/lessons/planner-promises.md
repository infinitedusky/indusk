# Planner Promises — Lessons

## A reader that drops what it cannot read passes every rule above it

Three readers made the same mistake. The trajectory parser skipped a row with
a cell missing; the brief parser read entries only in the exact shape it
expected; the purpose parser read `promise: \`name\`` as a reason. Each time
the rules downstream were correct and judged nothing, because the reader had
already decided the thing was not there. A line in the shape of what a reader
reads, which it cannot read, is reported with its location and refused.

## A refusal that names a command needs a test that runs it

`promises confirm` told the reader to run `promises replace`, which refused
that very case; the registry check told an archived plan to confirm, which
refused archived plans. A refusal's advice is the user's only way out. Write the
test that reproduces the refused state, follows the advice, and asserts the
first command then succeeds — with the refusal, not after.

## Run the product in a project it was not built in

A four-turn conversation in a fresh scratch project found a defect that had
shipped since the promise registry first did: InDusk's installed hooks name
dusk's own promises, so a new project's first `promises check` failed. It also
found a skill step pointing at a file new projects do not have. Neither was
visible from inside the repository that builds them.

## What we would do differently

- Edit plan documents only through the tools the hooks watch: a script edit is
  the one path where every gate is off.
- Run the live check before the falsification ritual, so the hunt starts from
  what it found.
