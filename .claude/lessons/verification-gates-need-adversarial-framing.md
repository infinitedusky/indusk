# Verification gates must describe checks that can't pass for the wrong reason

# Verification gates must describe checks that can't pass for the wrong reason

When writing a verification gate for a phase of work, ask "how could this gate pass for the wrong reason?" If you can think of a scenario where the gate passes but the thing it claims to verify isn't actually true, the gate is insufficient.

## Why

Verification gates that pass for the wrong reason feel successful but don't actually verify the claim. You tick the box, move on, and the unverified thing breaks in a later phase — often after more work has been built on top of it.

The adversarial framing — "what would someone trying to cheat this gate do?" — catches insufficient verification before it's written, not after it fails.

## Concrete example

Numero's arena-generalization plan Phase 4 had a verification gate: "PokerV2 test harness passes." This gate was satisfied — the harness did pass. Three phases later, it turned out PokerV2Room was calling `table.actionTaken()` and `table.endBettingRound()` directly, not going through the `GameEngine` interface at all. The interface that the plan claimed to validate was only being used by Arena. The "validation" was a rubber stamp.

Adversarial framing would have asked: "how could PokerV2Room pass the harness without actually using the new interface?" Answer: by calling the underlying Table class directly. The gate that would have caught this: "grep `games/poker-v2/` for `\.table\.` or `\.actionTaken\(` — should be zero."

The Phase 4 gate was amended retroactively in Phase 7 after the gap was discovered. If it had been written adversarially from the start, Phase 7 wouldn't have been needed — or would have been scoped into the plan from day one instead of added as a surprise.

## The rule

For every verification gate you write, generate one scenario where the gate could pass for the wrong reason. If you can't think of one, the gate is probably fine. If you can think of one, add a check that rules it out.

Common failure modes worth checking:
- **Functional gate without structural check** — "test passes" doesn't mean "the thing being tested uses the interface we think it does"
- **Positive assertion without negative grep** — "X is used" should be paired with "Y is not used"
- **Inner-loop behavior without outer-loop visibility** — "unit tests pass" doesn't mean "integration works"
- **Build succeeds without runtime check** — "typecheck passes" doesn't mean "the app runs"

The cost of writing an adversarial gate is a few extra lines per phase. The cost of a rubber-stamp gate is discovering the gap after building on top of it.

## See Also

This lesson is the intellectual origin of the [Falsification Ritual](apps/indusk-docs/src/guide/falsification-ritual.md) — the `/falsify {plan}` skill that runs between `/work` completion and `/retrospective`. The ritual operationalizes this lesson as a structural step every plan performs before archival: the same working agent goal-flips from "prove it works" to "find a failing test" and hunts specific hypotheses about what's broken. See `.indusk/planning/archive/falsification-ritual/` (once archived) for the full design.

The lesson covers the *technique* (four failure-mode patterns); the ritual covers the *discipline* (when, how, and with what gating).

