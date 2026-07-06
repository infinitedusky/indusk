---
name: falsify
description: Run the falsification ritual against a completed plan. Goal-flip from "prove it works" to "find a failing test" — investigate the code, form specific hypotheses about what should be broken, author a new Falsification Phase in the plan's impl.md capturing the hypothesis tests and fix items. The ritual authors; /work executes. Required between /work completion and /retrospective.
argument-hint: "{plan-name}"
---

You are about to run the **falsification ritual** against a plan whose `/work` has completed. The plan has an attested state — the goal, the Trajectory rows (all in terminal state), the claims it makes about what is now true. Your job is **not** to confirm those claims. Your job is to **falsify them**.

This is a goal-flip, not a persona switch. Same agent, different question. Instead of "does this work?" — "what specific thing, with what specific inputs, makes this fail?"

The ritual's output is **a new phase appended to the plan's `impl.md`** — not a separate log file, not an inline test run. You investigate, you form hypotheses, you author a Falsification Phase that captures the hypothesis tests as trajectory rows and any fix work as checklist items, and you leave. `/work` picks up the phase later and actually runs the tests + implements the fixes. `/retrospective` waits for the phase (and any follow-up fix phases) to close before the plan archives.

Why this shape: falsification phases are **visible** (admin UI renders all phases), **deferrable** (you don't have to run tests right now to preserve the discipline), and **traceable** (the plan's story shows normal work → falsification → fix phases → close). The old ritual wrote to a sidecar `.md` file that was invisible and forced immediate execution — easy to skip under time pressure. The new shape keeps the discipline while removing the friction.

## How to hunt

This is bounty hunting, not candidate generation. **Do not write hopeful tests and see what fails.** Each iteration hunts a specific target:

1. **Read the attested state.** Open the plan's `impl.md`. Read the Goal. Read every Trajectory row — what does each claim? Read the ADR if one exists — what invariants does the plan promise?
2. **Investigate the code.** Read the actual implementation. Compare what the code does against what the attestation claims. Look for gaps.
3. **Form a specific hypothesis.** Not "what could go wrong?" — "*this specific condition, with these specific inputs, will violate this specific invariant.*" Name the failure before writing any trajectory row.
4. **Capture the hypothesis as a trajectory row** — a T-ID, a one-line `Asserts` describing what the test will claim, `Writable at: Phase 0` (typically, since hypothesis tests can usually be authored against current behavior — they'll be red until the fix lands), `Passes at: Phase N+1` (the new falsification phase).
5. **Capture the fix work as impl items** — one item per concrete change the code needs. If the fix is trivial, it's one item. If the fix ripples, it's several.

Prompts to ask yourself while investigating (use these as starting points, not a checklist):

- **What's an edge case not covered by T1–Tn?** List every row. For each: what inputs did the author think of? What inputs did they miss?
- **What's an implicit invariant the attestation makes that the Trajectory doesn't test?** "Recoverable from crash" implies "recoverable from partial write." Is there a test for partial writes?
- **What about concurrent, partial, or malformed inputs?** Two callers at once. A half-written file. A valid-shape but semantically-wrong input.
- **What would a malicious user try?** If this accepts input, what input breaks the parser, or traverses paths, or exhausts memory?
- **What does the attestation assume about the environment?** Time monotonicity. Disk not full. Network present. Clock skew. Is any assumption documented vs. silently-assumed?
- **What's the first thing someone would try if they were paid $100 to find one failure here?** Specifically. Concretely.
- **What invariants are only enforced in one direction?** (E.g., "create calls validate, but update bypasses validation.")
- **What claim does the Goal make that's not expressed as a Trajectory row?** That's often the unguarded surface.

**Anti-pattern — do NOT do this:** "I'll add a bunch of hypotheses and let `/work` figure it out." That's candidate generation. It's cheap and useless. Every hypothesis you write without a specific failure mode in mind is noise. Investigate first, hypothesize specifically, write the trajectory row that targets *that* hypothesis.

## What the Falsification Phase contains

When you've formed one or more specific hypotheses, **append a new phase to the plan's `impl.md`** with this shape:

```markdown
### Phase N: Falsification — {short summary of the hypothesis theme}

**Goal**: verify whether the attested state holds against {one-sentence description of the failure modes being investigated}. Each trajectory row below captures one hypothesis about what's broken; each checklist item captures the fix the code needs if the hypothesis confirms.

- [ ] {Fix item 1 — concrete code change}
- [ ] {Fix item 2}
- ...

#### Phase N Verification
- [ ] T{M}: {restate the hypothesis — test should fail today, pass after fixes land}
- [ ] T{M+1}: {next hypothesis}
- ...

#### Phase N Context
- [ ] {CLAUDE.md edit describing what was learned from the falsification, or "(none — no conventions changed)" with asked/user proof per gate policy}

#### Phase N Document
- [ ] {docs page to update, or "(none — internal-only fix)" with proof}
```

Add the trajectory rows to the plan's `## Test Trajectory` table:

```markdown
| T{M} | {Asserts text — describe the failure being guarded against} | Phase 0 | Phase N | planned |
```

**Writable at is typically Phase 0** — hypothesis tests can usually be authored against current behavior (they fail red today, stay red until the fix lands in Phase N). If authoring requires a symbol that doesn't exist yet, `Writable at: Phase N` with rationale.

**What goes in the phase name**: a short, recognizable theme. `Falsification — PID reuse after process recycle` or `Falsification — Registry concurrent writes` or `Falsification — path-traversal in URL params`. The prefix "Falsification — " is free-form in v1 (the validator doesn't enforce a specific word); we recommend it for grep-ability and admin-UI skim.

**What you do NOT do in the skill**:

- You do not write the test files. That's `/work`'s responsibility at phase start (author writable-at-phase tests red; run them at phase close).
- You do not run any tests. The skill's output is the modified `impl.md`, nothing else.
- You do not pick "fix in scope vs spawn new plan vs accept as finding" as a three-way choice. If the hypothesis is in scope, the fix becomes an item in the Falsification Phase. If the hypothesis is genuinely out of scope, stop hunting that branch — don't write it down as a finding in a log that won't get revisited.

The plan's impl status stays `in-progress` because the Falsification Phase is unchecked. `/work` picks it up the next time someone runs `/work {plan}`.

## Loop exit (hybrid)

Continue hunting until you genuinely **cannot form a specific in-scope hypothesis** about what should be broken. Not "I've added enough rows" — "I have investigated the code and cannot name a concrete attack vector remaining."

When you reach that point, present the user with a summary:

- Hypotheses captured in the Falsification Phase, with one-line descriptions
- Regions of code you searched without finding an attack vector
- Any areas you did NOT investigate and why (e.g., "didn't investigate serialization because no serialization code was changed")

The user confirms termination — or points at an area you didn't investigate. Not "add another hypothesis" — they should point at a *region* you missed. If that produces a new hypothesis, add it to the Falsification Phase. If nothing new surfaces, the ritual ends; the Falsification Phase stays authored and unchecked.

## If there are no hypotheses

If after investigation you genuinely cannot form any specific hypothesis, **do not author an empty Falsification Phase**. Instead, add to the plan's `impl.md` frontmatter:

```yaml
falsification: skipped
falsification_reason: "investigated X, Y, Z regions; all invariants appeared to hold; no concrete hypothesis formed"
```

This is a confession, not a bypass — it's visible in the retrospective audit and documents what you did look at. Use it when you really couldn't find anything, not when you didn't want to spend time hunting.

The retrospective skill's Step 0 gate accepts either:
- A Falsification Phase that is terminal (all items checked off + trajectory rows in terminal state), OR
- A completed legacy `falsification.md` file (for plans authored before this flow), OR
- The `falsification: skipped` + `falsification_reason` frontmatter pair.

## When to skip the ritual entirely without investigating

For genuinely trivial plans (two-line typo fix, changelog entry, variable rename with no behavioral change), even the investigation cost may exceed the discipline value. The skip-frontmatter shape above applies — set `falsification: skipped` with a reason that acknowledges the plan's scope is too narrow for falsification to add value. The hook accepts this at `/retrospective` time.

## Output

By the time you hand off to `/retrospective`, one of these must be true:

- A Falsification Phase has been appended to the plan's `impl.md` (with trajectory rows + fix items + gates); `/work` will later close it. The plan's impl status remains `in-progress`.
- The plan's impl frontmatter contains `falsification: skipped` + `falsification_reason` with a real reason.
- A legacy `falsification.md` exists from the previous flow (backwards compat; the retrospective gate still honors it).

The `/retrospective` skill's Step 0 hard-blocks without one of these. Don't bypass.

## Why this exists

See the [Falsification Ritual guide](apps/docs/src/guide/falsification-ritual.md) for the full motivation. Short version: the Test Trajectory made universal deferral structurally impossible, but authors only write tests they can think of — and the author is the last person likely to notice the gaps in their own thinking. The ritual is a bullshit detector. Its purpose is rigor through self-examination.

The phase-authoring shape (vs the old sidecar-log shape) exists because:

- Falsification **visibility** — admin UI renders all phases; the ritual's output is no longer off-screen.
- Falsification **deferrability** — you can run `/falsify`, capture hypotheses, and let `/work` handle execution later without losing the discipline.
- Falsification **traceability** — the plan's phase sequence tells the full story: normal work → falsification → fix phases → close.

## Important

- Same agent, flipped goal. No persona, no separate session. The same you that built the plan, asked a different question.
- Bounty hunting, not candidate generation. Investigate first, hypothesize specifically, capture the trajectory row that targets *that* hypothesis.
- Exit criterion is "can't form a specific in-scope hypothesis" — not "ran out of rows to add" or "tried N regions."
- **Never run tests during the ritual.** The skill's output is the modified `impl.md`. `/work` runs tests later.
- **Never pick a three-way outcome per hypothesis.** In-scope fixes become impl items in the Falsification Phase. Out-of-scope hypotheses are not authored — they're discarded because the ritual's scope is this plan.
- Phase-naming convention: `### Phase N: Falsification — {summary}` is free-form but grep-friendly; use it unless a better phrase fits.
- The user's input is: $ARGUMENTS
