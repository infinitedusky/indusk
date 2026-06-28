---
title: "Lessons from git-only-substrate"
date: 2026-06-27
---

# Lessons from `git-only-substrate`

The 1.31.0 rip-out of dual-SCM support shipped clean, but the falsification ritual surfaced three real bugs after every trajectory test had turned green. Three lessons worth carrying forward.

## "Graceful-degrade" is a design choice, not a hedge

The prior `git-or-jj-substrate` plan (1.28.9) scoped three viable degrade modes for git users and shipped option (c) graceful-degrade — `runSync()` early-returns on git mode, `captureWithLog()` skips the event-log mirror — because at the time the semantic graph was "a power feature, not load-bearing for the agent loop."

By 1.30, that framing was obsolete. The handoff-multi-agent + section-shape plans made Graphiti the canonical long-term memory layer and the semantic graph the file-linkage layer connecting episodes to specific code. The same "graceful-degrade" code path was now structurally broken for the project building InDusk itself (`scm: git`).

The 5-minute spot-check that found "dedup is already content-keyed, the gap is two early-returns" could have happened during the prior plan's research, not 7 months later during this one. The lesson is not "the prior plan was wrong" — it was right for its moment. The lesson is **defensive early-returns that don't fail loudly become dead documentation**. They hide a fixable gap rather than protecting it. Re-examine them as the system evolves, especially when the system's load-bearing surfaces change.

When you write a `if (X) { early-return-with-message }` defensively, also write a calendar reminder or a trajectory row to revisit it. Without that pressure, the dead code stays.

## The Falsification ritual is the difference between "looks done" and "is done"

Of the 13 trajectory rows in this plan, all turned green. The falsification ritual found three real bugs — none of which any trajectory test would have caught.

- **H1**: `indusk init` in a non-git directory produced no warning. Phase 4 deleted the pre-1.31.0 deferred-SCM warning; nothing was added in its place. The trajectory didn't test init's behavior in a non-git environment.
- **H3**: `indusk graph sync` crashed with an unhandled `ChildProcess` stack trace on missing git state. T1, T3, T4 all assumed a happy-path git environment; the trajectory never exercised the error edge.
- **H5**: `\bgit commit\b` matches `git commit-tree` and `git commit-graph` because JS's `\b` matches at `t`→`-`. Pre-existing bug from the dual-form regex; T8 only tested the happy `git commit` path.

Plan authors write tests they can think of. The author is the last person likely to notice the gaps in their own thinking. The falsification ritual is the mechanism for finding what the author couldn't think of.

Two of the three hypotheses were behavior the author created (H1, H3). One was inherited but not probed (H5). Without falsification, all three would have shipped silently. This is the discipline's payoff: it works because the *flip* of the goal ("what's broken?" vs "does it work?") activates a different kind of attention than confirmation.

## Inherited bugs are still bugs you own

H5 is the sharpest version of this. The dual-form regex `/\b(jj describe|git commit)\b/` had the same `\b`-at-`-` flaw — it would have matched `git commit-tree` before 1.31.0 too. Phase 2's narrowing to `/\bgit commit\b/` *inherited* the bug instead of fixing it.

When you refactor a regex (or any input boundary), include adversarial cases against the **new** shape, not just regression tests against the **old** shape. The new shape's defenses are not automatically as strong as the old shape's defenses — sometimes weaker, sometimes stronger, but always different. Probe the new boundary at refactor time, not at falsification time.

This generalizes beyond regexes. Any time a refactor preserves a defensive check, the question to ask is: *would I have written this defensive check, with these exact arguments, in the new shape?* If not, write the missing assertion.

## See also

- [git-only-substrate ADR](../decisions/git-only-substrate.md) — the decision record
- [Falsification Ritual guide](../guide/falsification-ritual.md) — how the ritual works in detail
