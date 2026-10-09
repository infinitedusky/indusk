# Incident Recording — Lessons

From the plan that made a production break record itself and reach the running agent (2026-10-08). Retrospective: `.indusk/planning/archive/incident-recording/retrospective.md`.

## Read a mark where it is read, not where it is written

The recorder marked each of its passes under its own promise, tagged with the project it was recording. The promise lives in InDusk's own registry, and the read drops marks that name another project, so every mark was invisible to the one place that could read it. Every unit test of the writer passed. Only reading `promises status` against a real daemon showed it. When a mark is written for one project and read in another, test the reader with a fixture whose project differs from the registry's.

## A row that asserts two things gets one tested

A15 said a reopened plan gets a worktree *and* the plan tools read it from there. The test covered the first half; the second was false: the resolver read the trunk's archived copy and listed the worktree as unassigned. Split any trajectory row whose assertion joins two claims with "and".

## A writer on a timer meets the person's git

The admin commits every five seconds in the checkout a developer also commits in, so a held `index.lock` is an everyday failure, not an edge case. The first version dropped a failed commit for good and then reported itself healthy. Write what the person must hear first, commit second, keep the paths that could not be committed until a later pass commits them, and call the writer broken until it has.

## Per-session delivery means a new session has heard nothing

"Every running session hears each break once" was right for sessions already running and wrong for one started a week later: it heard every entry ever written, fixed incidents and each day's reminder included. Delivery to a session has to filter to what is still true and say each thing once.
