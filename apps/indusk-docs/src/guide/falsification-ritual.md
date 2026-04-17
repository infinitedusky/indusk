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

1. **Read the attested state.** The impl's Goal, the Trajectory rows (all in terminal state — every `Passes at: Phase N` row is `passing`, `skipped`, or `blocked`), the claims the plan makes about what is now true.
2. **Investigate the code.** Read the actual implementation, the test coverage, the invariants the attestation claims. Look for a concrete thing that *should be broken*.
3. **Form a specific hypothesis.** Not "what if something doesn't work?" — "*this specific condition, with these specific inputs, will violate this specific invariant.*" The hypothesis names the failure before any test is written.
4. **Write the test that confirms the hypothesis.** If the hypothesis is right, the test fails. If the hypothesis is wrong, the test passes.
5. **Run the test.**
   - **Fails** → hypothesis confirmed, real gap found. Pick one of the [three outcomes](#three-outcomes) below.
   - **Passes** → hypothesis was wrong. The attestation held against that specific attack. Go back to step 2 with a *different* hypothesis.
6. **Repeat** until the agent can no longer form a specific in-scope hypothesis to investigate.
7. **Terminate.** The agent proposes termination with a summary of hypotheses investigated and outcomes. The user confirms or points at an area that wasn't investigated. When confirmed, `markTerminated(planRoot, reason)` is called and the log closes.

## Three outcomes

When a failing test is confirmed, the user picks one of three outcomes:

| Outcome | When to use |
|---------|-------------|
| **Fix in scope** | The gap is small, clearly in-scope for the plan's original goal, and the fix is direct. Adds a new phase to the current impl. The plan's status flips back to `in-progress` and `/work` resumes. This is the "build the plane while flying" path — the plan grows during its own closure. |
| **Spawn a new plan** | The gap is large, touches unrelated areas, or deserves its own planning lifecycle. A new plan is created with the failing test as its core motivation. The current plan's brief gets a `blocks:` reference to the new plan. |
| **Accept as finding** | Rare. The gap is small, unambiguously out-of-scope, and the cost of a new plan isn't justified. The finding is recorded in the falsification log and surfaced in retrospective. Use only when "fix in scope" and "new plan" both genuinely don't fit. |

The agent recommends the outcome based on the gap's shape; the decision is the user's.

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

Write the test: inject a partial journal write via a test harness, call `recoverState(userId)`, assert either a specific `TruncatedJournalError` is thrown OR the state is flagged invalid. Run it.

Test fails → the implementation silently returns a partially-recovered state without any error, which is exactly the pathology the attestation claimed was impossible.

Outcome: **fix in scope**. Phase 5 is added to the impl: "detect truncated journal entries and surface as `TruncatedJournalError`." The plan reopens, `/work` resumes.

After the fix lands, `/falsify` restarts.

**Hypothesis 2**: "Two concurrent `recoverState(userId)` calls for the same user could race on the file handle and interleave reads, producing inconsistent state for one of the callers."

Test: spawn two threads calling `recoverState(sameUserId)` concurrently, assert both return identical state objects. Run it.

Test passes → the implementation correctly serializes reads with a per-user lock. Hypothesis was wrong.

**Hypothesis 3**: "The journal format has a version byte, but the attestation doesn't say what happens when a journal is read by an older code version (no forward compatibility). If a user runs an older binary against a newer journal, `recoverState` may silently skip entries it doesn't understand."

After investigation: this is a real gap, but forward compatibility is a separate plan that's already drafted (`journal-schema-evolution`).

Outcome: **spawn a new plan** (link to `journal-schema-evolution`, which is now `blocked_by: [recovery-subsystem]` for the part it depends on, OR simply noted in retrospective as a downstream concern). The ritual continues.

**Hypothesis 4, 5, 6…** more attempts against serialization boundaries, input validation, time-based invariants. All pass. Agent proposes termination: "Investigated truncated journals, concurrent reads, forward compatibility, serialization boundaries, malformed inputs, and clock skew. No more specific in-scope hypothesis remains."

User confirms. Terminator entry written. `/retrospective recovery-subsystem` now unblocks.

## Where the log lives

The ritual writes to `.indusk/planning/{plan}/falsification.md` alongside the plan's research / brief / adr / impl / retrospective. The log is **append-only markdown** — never edited in place. Each confirmed-hypothesis entry and the final terminator is an H2 section with a timestamp. See the [log format reference](/reference/falsification/log) for the structure.

After archival, the log travels with the plan to `.indusk/planning/archive/{plan}/falsification.md`. It's part of the plan's permanent record — a hypothesis that was wrong at plan close is valuable context for future plans attacking similar surfaces.

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

The retrospective skill's **Step 0 Falsification Gate** refuses to proceed unless either:

- `isFalsificationComplete(planRoot)` is true — the log exists and its last entry is a terminator, OR
- `isFalsificationSkipped(implContent).skipped` is true — the two-field skip is set in the impl

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
