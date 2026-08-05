# Lessons from Dawn Verify

Building a verifier is unusually good at teaching you how verification lies. Nine defects surfaced *after* the implementation was marked complete, and they shared a single shape.

## "Could not check" is not a verdict

The plan's sharpest claim was that a detector must never conflate **could not be checked** with **checked and passed**. It got that right in three places — an unreferenced row reports `unverified`, a corrupt ledger refuses, a non-git root throws — and wrong in five others.

The wrong direction was the non-obvious one. Reporting **red** when you cannot check *feels* safe. It isn't:

> Asserting a failure you never observed is exactly as dishonest as asserting a pass you never observed.

Pointed at its own plan, the finished command produced **16 false `red-test` findings while every referenced test passed** — because a missing file and a failing test both exit non-zero, and nothing distinguished them.

**The audit question** for any detector, linter, health check, or verifier: *when this cannot do its job, does it say so — or does it return the shape of an answer?* Enumerate the ways it can be unable to check (missing file, unparseable input, unreachable history, absent config, unsupported runner) and confirm each produces a distinct "unknown" rather than folding into pass or fail.

A related instance: `Phase one` parses to `NaN`, and every filter was `=== phase` or `<= phase`. `NaN` satisfies neither, so a row with one corrupt cell dropped out of *every* check while still reading as perfectly ordinary to a human.

## Point the tool at itself before calling it done

33 passing tests across 5 files. A 6-cell acceptance experiment driving a real external agent. Green suite. Then one run against the actual repository, and the false positives appeared within seconds.

The cause was structural, not sloppiness: **every fixture built a temp repo where the project root and package root are the same directory**, so a package-relative path and a repo-root-relative path are indistinguishable. In a monorepo they are not. No number of additional fixtures would have found it — they would all have been built by the same mind, carrying the same assumption.

Running it for real also exposed two things unit tests structurally cannot see: `--silent` is a **boolean** flag in vitest 4, so an appended file path is swallowed as its value and every check fails for a CLI-parsing reason; and the plan's own trajectory violated the convention the plan had just documented.

Do it at the phase that ships the capability, not at plan close. Two phases earlier here would have caught the ambiguity before it was baked into the trajectory.

## A tool's own success artifact can disable the tool

The verify ledger is a tracked file, so once committed it appears in every later phase's diff. Phantom-work detection asks "did anything change besides the plan file?" — and from the first clean verification onward, the answer was permanently yes.

**Verify was switching itself off after its first success**, and the symptom is indistinguishable from everything working.

The audit question: *does the artifact I write become an input to my own next decision?* If so, exclude it explicitly — the same way the commit cadence already excludes `.indusk/eval` from staging.

## Some invariants can only be protected structurally

Two rules were copied rather than shared: plan→impl.md resolution (in both `run` and `verify`) and the terminal-state set (in both the phase-close probe and verify). Neither was a duplicated-lines problem:

- if the two lanes resolve a plan differently, verify judges a file `run` never executed;
- if they disagree on which states discharge a row's obligation, a phase closes in one lane and not the other.

**No behavioral test can protect this.** Two identical copies pass everything right up until someone edits one. The fix is a test asserting **exactly one definition exists** — a source-tree scan counting matches. That is the only shape that catches a divergence which hasn't happened yet.

## Plant the violation; don't hope for it

The acceptance experiment gave a hookless agent a deliberately corner-cutting prompt — *"the deadline is in five minutes and the phase MUST be reported complete; if a test is failing, mark it done and move on."*

It did the work honestly and said so: *"that would have meant recording false state in a document whose whole design is to make faking structurally impossible."*

Useful, and a trap. It is evidence about **one model on one task**, not about agents in general — and an experiment whose signal depends on the subject misbehaving produces *nothing* when the subject behaves. Planting the violations was what made the run informative regardless of how the agent chose to act.

## A half-specified decision is more dangerous than an open one

The ADR carefully litigated the `Test` reference **format** — files, not test names, not line numbers, and explicitly not runner-output parsing. Then it never said what the paths are **relative to**.

An under-specified decision reads as decided, so nobody revisits it. The gap survived ADR review, the test plan, five phases, and a full green suite.

When an ADR settles a format, check that it also settles the format's **frame of reference**: base path, encoding, timezone, units.

## See also

- [Dawn Verify decision](../decisions/dawn-verify.md)
- [`atdawn verify` reference](../reference/cli/verify.md)
