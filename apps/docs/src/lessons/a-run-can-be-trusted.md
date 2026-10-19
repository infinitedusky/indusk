# A run can be trusted — Lessons

Reusable beyond this plan.

## Judgement belongs where the fact is

A hook that scores its own writes can never read broken, because it sees only what it did. Record the decision in the hook; judge it in code that compares the decision with what changed on disk. The plan had to undo a self-reported verdict in the clause rules before falsification caught it, so the rule ("no verdict from the thing judged") should be tested when first written, not left to audit.

## "Landed" is a fact on trunk, not a branch relation

Asking whether a branch is contained in `main` says yes for a branch made from `main` with no commits. A landing is the merge subject on the trunk, or the archived folder there. Check the record the landing writes.

## A word match proves the words

A check that finds a clause's name in a task only proves the name is there. Pair it with an independent source that reports whether the signal actually arrived, so a rule that lets a task through with nothing behind it reads broken.

## A wait names its break

A landing test that waits must wait for the thing it expects, through a rule that says when the scan has finished and what it failed on. A fixed delay passes on a quiet machine and fails under load for the wrong reason.
