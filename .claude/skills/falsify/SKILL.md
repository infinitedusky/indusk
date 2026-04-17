---
name: falsify
description: Run the falsification ritual against a completed plan. Goal-flip from "prove it works" to "find a failing test" — investigate the code, form a specific hypothesis about what should be broken, write the test that confirms it, run it. Required between /work completion and /retrospective.
argument-hint: "{plan-name}"
---

You are about to run the **falsification ritual** against a plan whose `/work` has completed. The plan has an attested state — the goal, the Trajectory rows (all in terminal state), the claims it makes about what is now true. Your job is **not** to confirm those claims. Your job is to **falsify them**.

This is a goal-flip, not a persona switch. Same agent, different question. Instead of "does this work?" — "what specific thing, with what specific inputs, makes this fail?"

## How to hunt

This is bounty hunting, not candidate generation. **Do not write hopeful tests and see what fails.** Each iteration hunts a specific target:

1. **Read the attested state.** Open the plan's `impl.md`. Read the Goal. Read every Trajectory row — what does each claim? Read the ADR if one exists — what invariants does the plan promise?
2. **Investigate the code.** Read the actual implementation. Compare what the code does against what the attestation claims. Look for gaps.
3. **Form a specific hypothesis.** Not "what could go wrong?" — "*this specific condition, with these specific inputs, will violate this specific invariant.*" Name the failure before writing any test.
4. **Write the test that confirms the hypothesis.** If the hypothesis is right, the test fails. If the hypothesis is wrong, the test passes.
5. **Run the test.**

Prompts to ask yourself while investigating (use these as starting points, not a checklist):

- **What's an edge case not covered by T1–Tn?** List every row. For each: what inputs did the author think of? What inputs did they miss?
- **What's an implicit invariant the attestation makes that the Trajectory doesn't test?** "Recoverable from crash" implies "recoverable from partial write." Is there a test for partial writes?
- **What about concurrent, partial, or malformed inputs?** Two callers at once. A half-written file. A valid-shape but semantically-wrong input.
- **What would a malicious user try?** If this accepts input, what input breaks the parser, or traverses paths, or exhausts memory?
- **What does the attestation assume about the environment?** Time monotonicity. Disk not full. Network present. Clock skew. Is any assumption documented vs. silently-assumed?
- **What's the first thing someone would try if they were paid $100 to find one failure here?** Specifically. Concretely.
- **What invariants are only enforced in one direction?** (E.g., "create calls validate, but update bypasses validation.")
- **What claim does the Goal make that's not expressed as a Trajectory row?** That's often the unguarded surface.

**Anti-pattern — do NOT do this:** "I'll write several tests and see which ones fail." That's candidate generation. It's cheap and useless. Every candidate you write without a specific hypothesis is noise. Investigate first, hypothesize specifically, write the test that targets *that* hypothesis.

## Three outcomes per failing test

When a test fails (your hypothesis is confirmed), pick one outcome — recommend one, but the user decides:

1. **Fix in scope** — the gap is small and clearly in-scope for the plan's original goal. Add a new phase to the current `impl.md`, flip the impl status back to `in-progress`, return to `/work`. This is "build the plane while flying" — the plan grows during its own closure.
2. **Spawn a new plan** — the gap is large, touches unrelated areas, or deserves its own planning lifecycle. Create `.indusk/planning/{new-slug}/brief.md` with the failing test as its core motivation. Link via `blocks:` in the current plan's brief.
3. **Accept as finding** — rare. The gap is small, unambiguously out-of-scope, and the cost of a new plan isn't justified. Record in the falsification log and note in retrospective. Use only when the other two genuinely don't fit.

After choosing the outcome, record the hypothesis via `appendHypothesis(planRoot, { hypothesis, testPath, outcome, note? })` from `apps/indusk-mcp/src/lib/falsification/log.ts`. The log file at `.indusk/planning/{plan}/falsification.md` captures the session's history.

## Loop exit (hybrid)

Continue hunting until you genuinely **cannot form a specific in-scope hypothesis** about what should be broken. Not "I've tried enough tests" — "I have investigated the code and cannot name a concrete attack vector remaining."

When you reach that point, present the user with a summary:

- Hypotheses investigated and their outcomes (confirmed → fix/spawn/accept; wrong → the hypothesis was rejected, note what held up)
- Regions of code you searched without finding an attack vector
- Any areas you did NOT investigate and why (e.g., "didn't investigate serialization because no serialization code was changed")

The user confirms termination — or points at an area you didn't investigate. Not "write another test" — they should point at a *region* you missed. If that produces a new hypothesis, the loop continues. If nothing new surfaces, call `markTerminated(planRoot, reason)` to close the log and hand off to `/retrospective`.

## When to skip the ritual entirely

For genuinely trivial plans (two-line typo fix, changelog entry, variable rename with no behavioral change), the ritual's cost may exceed its discipline value. To skip, the plan's `impl.md` frontmatter must contain BOTH:

```yaml
falsification: skipped
falsification_reason: "a non-empty reason, quoted as a YAML string"
```

The retrospective skill's Step 0 gate accepts either a completed falsification log OR the two-field skip frontmatter. Skipping is a confession, not a bypass — use sparingly.

## Output

By the time you hand off to `/retrospective`, one of these must be true:

- `.indusk/planning/{plan}/falsification.md` exists with a terminator entry (log is closed cleanly), OR
- The plan reopened (`impl` status flipped to `in-progress`) via a "fix in scope" outcome and `/work` is active again (deferring falsification until the fix lands)

The `/retrospective` skill's Step 0 hard-blocks without this. Don't bypass.

## Why this exists

See the [Falsification Ritual guide](apps/indusk-docs/src/guide/falsification-ritual.md) for the full motivation. Short version: the Test Trajectory made universal deferral structurally impossible, but authors only write tests they can think of — and the author is the last person likely to notice the gaps in their own thinking. The ritual is a bullshit detector. Its purpose is rigor through self-examination.

## Important

- Same agent, flipped goal. No persona, no separate session. The same you that built the plan, asked a different question.
- Bounty hunting, not candidate generation. Investigate first, hypothesize specifically, write the test that targets *that*.
- Exit criterion is "can't form a specific in-scope hypothesis" — not "ran out of candidates" or "tried N things."
- The log is append-only. Never edit `falsification.md` by hand. Write via `appendHypothesis` / `markTerminated` from the library.
- If you find a gap, pick an outcome. Do not log a failing test and then continue looking for more failing tests as if the first didn't matter — each failure demands a decision before moving on.
- The user's input is: $ARGUMENTS
