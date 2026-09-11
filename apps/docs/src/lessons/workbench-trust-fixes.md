---
title: Workbench Trust Fixes — Lessons
---

# Workbench Trust Fixes — Lessons

The plan set out to fix five safety mechanisms that a coincidence had been
keeping safe. Four tools took one folder as their whole world and had only
ever been stopped from doing damage in a workbench by tripping over "this is
not a git repository"; when the workbench root became a repository (1.37.0)
nothing tripped. The fifth, the gate reminder, had never once reached a model.
Every fix was the same principle applied again: a tool that cannot answer
correctly refuses loudly and says why.

The plan closed green: nine phases, 24 trajectory rows, falsification and
cleanup both run, six defects found and fixed by the rituals. Then the
retrospective found that the enforcement lane which gated the plan had itself
been working by coincidence. That is the lesson, and everything below is a
way of describing it.

## A gate that fails to load is a gate that passes

Every InDusk hook is registered as `node .claude/hooks/<name>.js`, a path
relative to the current directory, and Claude Code runs hook commands in the
session's current working directory, which drifts with every `cd` in a Bash
call. From `apps/indusk-mcp` the file does not exist, `node` exits 1, and an
exit code other than 2 is a non-blocking error the host does not show the
model. The gate is off, and nothing says so.

That is how two trajectory rows stayed `written` through eight phase closes
that the `check-gates` hook's Gate B exists to refuse. Replaying the first
Build Phase 2 checkoff through the hook today blocks it, naming both rows; on
the night, the checkoff came two minutes after a Bash call that ended inside
`apps/indusk-mcp`. The three refusals that *did* fire in the session all came
seconds after a `cd` back to the worktree root.

The rule: an enforcement hook must resolve its own path independently of cwd
(`$CLAUDE_PROJECT_DIR`), and its failure to run must read as a refusal, not a
pass. This is the same shape as the gate reminder that wrote to a channel
nobody read. The enforcement existed; the delivery did not. Filed as
`hook-cwd-independence`.

## Silence from a gate is not evidence

The hook's silence during Build Phases 2 through 9 was read as the gates
passing. A gate whose absence is indistinguishable from its approval is the
exact defect this plan spent nine phases fixing elsewhere: the cleanup scan
that returned `[]` for code it never saw, the evaluator that scored the wrong
repository without complaint, the restore that printed a path it did not use.
If you cannot tell "the gate approved" from "the gate did not run", you have
no gate.

The cheap check that would have caught it: replay `check-gates` over the
final impl at close, every row, every phase. Neither close-out check asks that
question today. The ritual gate checks that the falsification and cleanup
phases have every checkbox ticked, and the trajectory audit reports `blocked`
and deferred rows only, so a row left `written` is invisible to both.

## Fixtures encode the world the tests believe in

Twelve versioned-workbench defects were found by using the feature after its
plan closed green, and four more surfaces failed silently in that shape,
because no fixture in the suite had a `git init`ed root. Every workbench
fixture reproduced the pre-1.37 world, so the regression net was structurally
blind to the whole class. This plan's first deliverable was the fixture
(`helpers/versioned-workbench.ts`), and twelve of its thirteen new test files
stand on it.

The fixture for the shape a feature exists for is the one most likely to be
missing, because it is the one the author had to invent rather than copy.

## The first statement of an invariant is usually an over-claim

"A commit from a workbench-root cwd is never attributed to the workbench
repository" was clean, testable, and wrong. The workbench repository receives
commits too, every checkbox and every brief, and "never the workbench" would
have scored those against the code repository's unrelated HEAD. Falsification
replaced the sentence with "a commit is attributed to the repository that
received it", and the code followed: newer HEAD wins, the code repository on
a tie, the choice logged.

The value of the ritual was correcting a claim. Tests written against the
first claim would all have passed.

## Assert the outcome, not the absence of a crash

Two bugs sat on one path in `linkTrunk`. It did not create the link's parent
directory on a sibling layout with a two-segment path, and once it did, the
link pointed at itself, because its relative target was computed from the
workbench root rather than the link's own directory. The test that asserts
*the link resolves to the clone* found both. A test asserting "restore exits
0" would have found neither, and would have been green.

## A refusal is a user interface

Verify's refusal told the user to run it at a directory that did not exist.
A refusal that names a wrong path is a silent wrong answer dressed as an
honest one, and it is tested the same way any output is: does the path it
names exist.

## Do not build the abstraction the next plan replaces

Three refusal sites now compose the same "this is a workbench, its code lives
in X" message, which meets the rule of three. Cleanup declined to extract
them, because `dawn-workbench-execution`'s `resolveExecutionRoots` is their
designated single home, and a helper built now is the abstraction that plan
would replace a phase later. The decision is recorded as a left-as-is with
its reason, where the next plan can read it.

## Libraries that address phases by number are blind to the test sequence

`prepareShapeReview({ phase: 1 })` means Build Phase 1, so a test phase's
craft review cannot be scoped or recorded by the Shape library; it predates
test-phase-structure, the same way the admin UI's private phase regex did.
Any reader that takes a bare phase number has this hole until it takes a
`{ kind, number }`.

This plan is the sequel to [Versioned Workbench — Lessons](/lessons/versioned-workbench),
whose twelve post-close defects are where the fixture lesson comes from. The
archived plan at `.indusk/planning/archive/workbench-trust-fixes/` holds the
full record, including the transcript replay that established the hook
finding, and the follow-on is `.indusk/planning/hook-cwd-independence/`.
