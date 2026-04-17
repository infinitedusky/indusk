# Falsification Ritual — Decision Summary

Shipped in `@infinitedusky/indusk-mcp@1.16.0`. Archived at `.indusk/planning/archive/falsification-ritual/` in the repo.

## The Problem

`tests-first-planning` (archived 2026-04-16) solved universal deferral — `check-gates` refuses to close a phase whose named tests aren't passing. But it left a deeper problem untouched: **the author only writes the tests they can think of**. Happy-path thinking produces happy-path tests. Edge cases, implicit invariants, "I don't know what I don't know" — none of these show up in the Trajectory, because the author never thought to include them.

The Numero lesson `verification-gates-need-adversarial-framing.md` captured one instance: a harness test that passed while the code bypassed the interface the plan claimed to validate. The gate was a rubber stamp. This plan operationalized that lesson as a structural step every plan runs before archival.

## The Decision

A new skill `/falsify {plan}` runs between `/work` completion and `/retrospective`. It drives the **same working agent** through a **goal-flipped bounty hunt**:

1. Read the attested state (impl goal + Trajectory + any "done" claims)
2. Investigate the code
3. Form a specific hypothesis about what should be broken (not "what might go wrong?" — a concrete, named failure)
4. Write the test that confirms the hypothesis
5. Run it → failing test confirms the hypothesis → pick an outcome
6. Repeat until no in-scope hypothesis can be formed
7. Hand off to `/retrospective`

## Why This Shape

| Decision | Rationale |
|----------|-----------|
| **Same agent, goal-flip (not a persona switch)** | The mechanism is asking the same brain a different question. Under "prove failure," the agent's attention turns to edges "prove success" didn't prioritize. `complementary-personas` can later provide richer framings, but the baseline ritual ships standalone. |
| **Bounty hunting, not candidate generation** | Each iteration hunts a specific target. Write twenty hopeful tests and hope for a fail = shotgun = no signal. Investigate, hypothesize, write the test that targets *that* hypothesis = productive. The ritual terminates when the agent can't form a specific in-scope hypothesis, not when candidates run out. |
| **Plan-close timing, not authoring-time** | Authoring-time falsification hypothesizes against imaginary code. Plan-close falsification hypothesizes against real code. The ritual's placement between `/work` and `/retrospective` is load-bearing. |
| **Three outcomes: fix-in-scope / spawn-plan / accept-finding** | Each failing test demands a decision before moving on. Fix-in-scope reopens the impl (plan status flips back to `in-progress`) — "building the plane while flying" is intended, not a failure mode. |
| **Hybrid exit (agent proposes, user confirms)** | Agent alone risks premature termination when it runs out of ideas rather than out of gaps. User approving every iteration is too expensive. Hybrid keeps the agent driving while catching its blind spots. |
| **Append-only markdown log** | `.indusk/planning/{plan}/falsification.md` — human-readable, survives archival. Typed library (`appendHypothesis`, `markTerminated`, `readFalsificationLog`) enforces append-only invariant. Malformed-entry resilience mirrors the semantic-graph event log pattern. |
| **Retrospective hard-block via Step 0 Gate** | `isFalsificationComplete(root) \|\| isFalsificationSkipped(impl).skipped` must be true. Skill-level enforcement (not a Node validator hook) — sufficient for v1 discipline without the rigidity of structural enforcement. Two-field skip frontmatter (`falsification: skipped` + `falsification_reason: "..."`) is the escape hatch for trivial plans. |

## The Dogfood

The plan ran `/falsify` against its own completed impl and confirmed two hypotheses:

- **H1**: Log parser is line-oriented — multiline hypothesis/note/reason content silently truncates on round-trip
- **H2**: JS regex `/m` mode treats CR, U+2028, U+2029 as line terminators too — same class of bug

Both fix-in-scope. Phase 5 was added to the impl, `assertSingleLine` introduced in `log.ts` rejecting all four line-separator classes at the library boundary. The ritual found real bugs in the system that built the ritual.

## Key Tradeoffs Accepted

- **`/retrospective` becomes harder to reach.** Step 0 hard-block adds a step. For trivial plans, the skip-reason escape hatch is necessary but costs a few seconds of ceremony.
- **Loop termination is judgment-based.** Agent-proposes + user-confirms means the user has to spend attention at close. Not automated.
- **Two outputs to maintain.** Local `falsification.md` + Graphiti episodes. Small cost, but a place to drift.

## Rejected Alternatives

- **Falsification requires a different persona** — rejected; goal-flip alone works. Sleep-example analogy was decisive: the adversary's derivation of "sleep ≥ 8 hours" from the attestation "I slept well" doesn't require a different person; it requires the person to flip their goal from "affirm" to "check."
- **Automated property-derivation tooling** — rejected; the judgment about which properties matter is exactly what the agent should be doing.
- **Trajectory-level `Kind: adversarial` column** — rejected; cargo-cult pair-rows at authoring time. Adversarial framing is a plan-close activity.
- **Structural `/retrospective` block via validator hook** — rejected for v1 in favor of skill-level block with skip-reason escape hatch; harder enforcement is possible later if skipping becomes routine.
- **Phase-close falsification** — rejected for v1; most phases' attestations aren't stable, cross-phase invariants only hold after full impl. Revisit as optimization.

## Bookend Symmetry with the Test Trajectory

- **Plan start**: Trajectory writes currently-failing tests whose passing proves success
- **Plan close**: `/falsify` hunts currently-failing tests that shouldn't be producible if success is real

Same primitive (currently-failing tests), inverse purpose. The two plans together form the testing contract — authoring front-half, verification back-half.

## See Also

- [Falsification Ritual user guide](/guide/falsification-ritual) — motivation, worked example, anti-patterns
- [Falsification log reference](/reference/falsification/log) — TypeScript API, log format, content constraints
- [Test Trajectory decision](/decisions/tests-first-planning) — the front-half bookend
- `.indusk/planning/archive/falsification-ritual/adr.md` in the repo — full ADR with all 10 decisions and 6 alternatives rejected
- `.indusk/planning/archive/falsification-ritual/retrospective.md` — honest account of what shipped, what happened during the dogfood, and what to do differently
- `.indusk/planning/archive/falsification-ritual/falsification.md` — the dogfood session's log (2 confirmed hypotheses + 1 terminator)
