# Falsification Ritual

The Falsification Ritual runs between `/work` completion and `/retrospective`. Its job: take the plan's attested state ("we built X; these properties hold"), flip the agent's goal from "prove it works" to "find a failing test," and drive a bounty-hunting loop through the code until no in-scope failure remains. It's the bookend to the [Test Trajectory](/guide/test-trajectory) — the Trajectory writes currently-failing tests at plan *start* whose passing proves success; the ritual hunts currently-failing tests at plan *end* that shouldn't be producible if success is real.

Invoke via `/falsify {plan-name}`. The ritual is required before `/retrospective`.

## Why this exists

`tests-first-planning` (archived 2026-04-16) solved universal deferral structurally — `check-gates` refuses to close a phase whose named tests aren't passing. But it left a deeper problem untouched: **the author only writes the tests they can think of**. Happy-path thinking produces happy-path tests. Edge cases, implicit invariants, "I don't know what I don't know" — none of these show up in the Trajectory, because the author never thought to include them. The plan closes green, and the blind spots ship.

The Numero lesson at [`verification-gates-need-adversarial-framing.md`](https://github.com/infinite-dusky/dusk/blob/main/.claude/lessons/verification-gates-need-adversarial-framing.md) captured one instance: a harness test (`"PokerV2 test harness passes"`) that ran green while the code bypassed the `GameEngine` interface the plan claimed to validate. The gate was a rubber stamp. The gap was discovered three phases later.

The `/falsify` ritual operationalizes that lesson as a structural step every plan runs before archival.

## The principle

It's a **bullshit detector** — a mechanism for forcing the system to find problems with itself before moving on. Three reasons it works:

- **Prove-failure is asymmetrically cheaper than prove-success.** One counterexample falsifies; total coverage requires covering the whole state space. Flipping the goal from "make it work" to "make it break" puts asymmetric effort on the side where each iteration is more productive.
- **It addresses unknown unknowns.** The author cannot enumerate properties they didn't think of. But once the goal is "find a failure," the same brain surfaces properties it skipped while building. Goal-flipping is the mechanism.
- **The deterrent is welcome.** Knowing `/falsify` will run changes what gets written upstream. Claims tighten, scopes narrow, edge cases move from "we'll handle it later" to "let's write the phase now." That's a side effect, not the purpose — but it happens.

The deterrent is *welcome*, not the point. The point is rigor through self-examination.

## Same agent, flipped goal

`/falsify` runs with the **same working agent** that built the plan. No persona switch, no adversarial agent identity, no separate model. What changes is the agent's goal: from "make this work" to "find a failure."

This works because the agent's output under "prove success" is not the same as its output under "prove failure." The same brain, asked a different question, looks at different things. You don't need a different perspective — you need a different goal. `complementary-personas` (a future plan) may provide richer framings later, but the baseline ritual ships today with whatever agent is running `/work`.

## Bounty hunting, not candidate generation

This is the most important framing in the ritual, and the easiest to get wrong.

**Candidate generation** is: write many hopeful tests, run them, see which ones fail, investigate those. It's a shotgun. It's cheap and useless — you can always write twenty more tests that might fail.

**Bounty hunting** is: investigate the code, form a *specific* hypothesis about what should be broken, write the test that confirms that hypothesis, run it. Each iteration hunts a specific target. If the test passes, your hypothesis was wrong — form a *different* specific hypothesis, not a retry.

The distinction matters because bounty hunting **terminates meaningfully**. Every failed hypothesis narrows the space of things that can still be broken. The ritual ends when the agent genuinely can't construct a specific attack vector — not when it runs out of random candidates to throw at the wall.

## The ritual

The ritual **authors** work — it does not run tests. Running tests is `/work`'s job after the ritual appends a phase. This separation is deliberate: it makes falsification deferrable (you can capture hypotheses now and execute them later), visible (phases render in the admin UI; sidecar log files don't), and traceable (the plan's phase sequence tells the full story).

1. **Read the attested state.** The impl's Goal, the Trajectory rows (all in terminal state — every `Passes at: Phase N` row is `passing`, `skipped`, or `blocked`), the claims the plan makes about what is now true.
2. **Investigate the code.** Read the actual implementation, the test coverage, the invariants the attestation claims. Look for a concrete thing that *should be broken*.
3. **Form a specific hypothesis.** Not "what if something doesn't work?" — "*this specific condition, with these specific inputs, will violate this specific invariant.*" The hypothesis names the failure before any trajectory row is written.
4. **Capture the hypothesis as a trajectory row** in the plan's `## Test Trajectory` table — a T-ID, a one-line `Asserts` describing the failure the test will guard against, `Writable at: Phase 0` (typically — hypothesis tests are usually authorable against current behavior, red until the fix lands), `Passes at: Phase N+1` (the new Falsification Phase being authored).
5. **Capture the fix work as impl items** under a new phase heading `### Phase N+1: Falsification — {short summary}`. One checklist item per concrete code change. Include standard Verification / Context / Document gates; the Verification gate references the trajectory rows added in step 4.
6. **Repeat steps 2–5** for each additional hypothesis. Each hypothesis appends one trajectory row + (if a fix is needed) one or more impl items to the same Falsification Phase.
7. **Terminate.** The agent proposes termination with a summary of hypotheses captured + regions of code investigated without finding an attack vector. The user confirms or points at an unexplored region.

When the ritual ends, the plan's `impl.md` contains a new Falsification Phase — unchecked, with trajectory rows that are `planned`. The plan's impl status stays `in-progress`. The next `/work {plan}` invocation picks up the phase normally: authors the writable-at-phase tests red, runs items, closes the phase. No special-case handling.

## What you do not do in the ritual

- **You do not write test files.** `/work` authors writable-at-phase tests at phase start — that's its job.
- **You do not run any tests.** The ritual's output is the modified `impl.md`, nothing else.
- **You do not pick a three-way outcome per hypothesis.** In-scope fixes become impl items in the Falsification Phase. Genuinely out-of-scope hypotheses are not authored — stop that branch and move on. If the hypothesis deserves its own planning lifecycle, mention it in the retrospective for follow-up; don't invent a third pseudo-outcome.

The old ritual distinguished "fix in scope" (reopen impl with a new phase) from "spawn new plan" (new plan with blocks reference) from "accept as finding" (log-only). With phase-authoring as the default, "fix in scope" IS the shape — the Falsification Phase is the new phase being added. "Spawn new plan" stays available for genuinely large gaps; it's just not a decision made inside the ritual. "Accept as finding" is gone — findings that deserve record either become phase items (so they actually get done) or get flagged in retrospective (so they're visible, not buried in a sidecar log).

## Hybrid exit criterion

The loop terminates when the agent self-declares "I cannot form a specific in-scope hypothesis to investigate." The agent then presents the user with a summary:

- Hypotheses investigated and their outcomes
- Failing tests confirmed and what happened to each
- Regions of the code searched without finding an attack vector

The user confirms termination — or points at an unexplored region. Not "here's another candidate to try" — "I don't see you investigated the serialization path." If the user's pointer produces a new hypothesis, the loop continues. If nothing new surfaces, termination is written to the log.

This is a hybrid between agent-driven and user-driven exit. Agent alone risks premature termination (ran out of ideas, not out of gaps). User alone is too expensive (approve every iteration). The hybrid keeps the agent in the driver's seat while catching the agent's blind spots.

## Worked example

Suppose a plan that built a crash-recovery subsystem attests:

> At any point in time, the state is fully recoverable. No crash, no concurrent write, no partial update can produce a state where a user with a valid ID cannot be returned to the point at which the issue occurred.

The Trajectory ran green. Every `Passes at` row is `passing`. `/work` is done. Now `/falsify recovery-subsystem`.

**Hypothesis 1**: "`recoverState(userId)` assumes the journal entries for that user are complete. If a crash happens mid-journal-write (half the bytes landed, half didn't), `recoverState` will deserialize garbage and either throw or — worse — return a state that *looks* valid but has corrupt fields."

Captured as trajectory row:

```
| T23 | Truncated journal entries surface as TruncatedJournalError; recoverState never returns a partially-recovered state silently. | Phase 0 | Phase 5 | planned |
```

And Phase 5 authored:

```markdown
### Phase 5: Falsification — truncated journal + version skew

- [ ] Add TruncatedJournalError class in recovery/errors.ts
- [ ] Detect CRC mismatch on journal tail in recoverState; throw TruncatedJournalError
- [ ] (if hypothesis 3 below also in scope) Add journal-version check rejecting unknown-version entries with VersionSkewError

#### Phase 5 Verification
- [ ] T23 passes — inject partial-write harness, assert TruncatedJournalError
- [ ] T24 passes — inject journal with future version byte, assert VersionSkewError
```

**Hypothesis 2**: "Two concurrent `recoverState(userId)` calls for the same user could race on the file handle and interleave reads."

After investigation: the existing code holds a per-user lock and serializes reads. No attack vector remaining on this surface. No trajectory row added.

**Hypothesis 3**: "The journal format has a version byte, but the attestation doesn't say what happens when a journal is read by an older code version."

Captured as T24 in the same Falsification Phase 5 above. Fix item added.

**Hypothesis 4, 5, 6…** more attempts against serialization boundaries, input validation, time-based invariants. All investigated without finding concrete attack vectors. Agent proposes termination: "Investigated truncated journals, concurrent reads, forward compatibility, serialization boundaries, malformed inputs, and clock skew. T23 and T24 captured as falsification rows in Phase 5. No more specific in-scope hypothesis remains."

User confirms. Ritual ends. `impl.md` now has Phase 5 authored and unchecked. The plan's impl status is still `in-progress`.

Later, `/work recovery-subsystem` picks up Phase 5: authors the T23/T24 test files red, implements the fixes, runs tests green, closes the phase. Then `/retrospective recovery-subsystem` passes its Step 0 gate (all impl phases terminal) and archives the plan.

## Where the output lives

The ritual modifies the plan's `impl.md` — adding a new Falsification Phase with trajectory rows and checklist items. No separate log file, no sidecar markdown. The phase is visible in the admin UI's plan-detail view like every other phase.

**Legacy plans** (authored before 1.27.4) may have a `.indusk/planning/{plan}/falsification.md` file from the old flow. Those files continue to work — the retrospective gate still accepts `isFalsificationComplete(planRoot)` for backward compatibility. New plans use the phase-authoring flow; legacy plans stay readable as-is.

## When to skip

The skip-reason escape hatch exists for cases where the ritual's cost genuinely exceeds its value. Typical cases:

- A two-line typo fix in a docs page
- A changelog entry
- Renaming an internal variable with no behavioral change

To skip, add both fields to the impl frontmatter:

```yaml
falsification: skipped
falsification_reason: "two-line typo fix in a docs page; ritual cost exceeds discipline value"
```

Both fields are required. The `falsification_reason` is recorded in the archive and surfaced in the retrospective audit. Use sparingly — the skip is a confession, not a bypass. If you find yourself skipping frequently, the discipline is slipping.

## Retrospective hard-block

The retrospective skill's **Step 0 Falsification Gate** refuses to proceed unless one of the following is true:

- **All impl phases are terminal** — the new flow's default path. If `/falsify` authored a Falsification Phase and `/work` closed it (along with any fix-in-scope phases it spawned), the gate passes automatically. No separate "falsification is done" assertion needed — the phase sequence itself is the proof.
- `isFalsificationComplete(planRoot)` is true — legacy path for plans authored before 1.27.4. The log exists and its last entry is a terminator.
- `isFalsificationSkipped(implContent).skipped` is true — the two-field skip is set in the impl (see "When to skip" above).

Without one of these, `/retrospective` surfaces a refusal message pointing you at `/falsify`. This is the structural enforcement layer that makes the ritual load-bearing, not advisory.

## Relation to `complementary-personas`

A future plan, `complementary-personas`, will introduce persona agents with their own accumulated perspectives. The **Adversary** persona is one natural instantiator of `/falsify`: a specialized agent whose entire system prompt is the falsification goal, with accumulated experience across plans about what tends to break.

This plan is **not** a dependency of complementary-personas. The ritual works today with whatever agent is running `/work`, because the mechanism is goal-flipping — not perspective-switching. When personas land, they become a richer way to instantiate the same ritual, not a replacement for it.

## See also

- [Falsification log reference](/reference/falsification/log) — TypeScript API for `appendHypothesis` / `markTerminated` / `readFalsificationLog` / `isFalsificationComplete` / `isFalsificationSkipped`
- [Test Trajectory guide](/guide/test-trajectory) — the front-half bookend this ritual completes
- [Work skill reference](/reference/skills/work) — how `/work` directs users to `/falsify` at completion
- [Retrospective skill reference](/reference/skills/retrospective) — Step 0 Falsification Gate
- [`verification-gates-need-adversarial-framing.md`](https://github.com/infinite-dusky/dusk/blob/main/.claude/lessons/verification-gates-need-adversarial-framing.md) — the Numero lesson that motivated this plan
- `.indusk/planning/falsification-ritual/adr.md` in the repo — full design with 10 decisions and 6 alternatives rejected
