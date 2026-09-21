# Pin a deliberate duplicate with a count, not a behaviour test — and make the shared shape the union of its callers

Some duplication is structural and cannot be refactored away — a hand-written JS mirror of a TypeScript module, because hooks can't import `.ts`; a port across a process or language boundary. The danger isn't the duplication, it's that **a copy which falls behind does not fail. It stops enforcing, and everything downstream reports success.**

**What happened.** Two hand-ported copies of a parser drifted apart in two independent ways:

1. One kept a local regex for a value format. When a new spelling of that value became legal, it parsed every row as `NaN`, and the gate keyed on those rows matched nothing. No error, no warning — the gate simply stopped enforcing.
2. One never produced a `state` field at all. Completely invisible until the copies were merged, at which point every row read as non-terminal and the gate blocked *everything*.

Neither was found by a behavioural test. The first was found because a gate mysteriously stopped firing; the second because unifying the copies broke a suite.

**Two rules:**

**Pin it with a count.** Assert that exactly one definition exists — scan the source, count the definitions, expect 1. No behavioural test can catch a divergence that has not happened yet, and by the time behaviour diverges the enforcement has already been silently off. A structural count fires the moment someone adds the second copy.

**A shared module's shape must be the union of what all its callers need.** When merging duplicates, enumerate every field/behaviour each caller reads. Merging copies that differ in *fields* fails exactly as silently as merging copies that differ in *logic* — the missing field arrives as `undefined`, which usually means "falsy", which usually means "not done".

**Also:** when a port is unavoidable, give it a **one-to-one file correspondence** — one mirror module per source module, named for it. "Change the source and every port together" is a rule you can follow by reading two filenames; it is not a rule you can follow by hunting inside a thousand-line file for the parts that happen to be mirrored.

**And the pin's scan must cover everywhere the duplicate could live.** A count is only as good as the directory it walks. A single-definition pin written to scan `src/lib` went green while the second copy of both the thing it named sat one directory away, in `src/bin` — a command module, which is exactly where a second caller shows up first. The pin reported the shape of the check without performing it, which is worse than no pin at all, because the next reader sees a green guard and stops looking.

Before trusting a count, run it against the known-duplicated state and watch it fail. A pin authored after the duplication already exists must be red when written; if it is green, its scope is wrong, not the codebase.
