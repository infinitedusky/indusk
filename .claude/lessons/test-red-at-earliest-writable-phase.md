# Tests go red at the earliest writable phase, not the fix phase

# Tests go red at the earliest writable phase, not the fix phase

When authoring an impl Test Trajectory, set each row's `Writable at` to the earliest phase where the test's infrastructure dependencies exist — NOT the phase that lands the fix making it pass.

## The rule

**If it is possible to write a test, write it. Then let it pass when it will.**

The validator only enforces `Writable at ≤ Passes at` (a floor). The real discipline is `Writable at = earliest feasible phase`.

## Why

A test authored in the same phase as its fix (`Writable at = Passes at`) is a rubber stamp. Nothing ever proves intermediate phases didn't break it or accidentally fix the bug early. A red test that lives from an early phase through every intermediate phase until its fix lands is a live tripwire:

- Any intermediate phase that turns it green prematurely signals unexpected coupling (the bug was already fixed, or a sibling change inadvertently fixed it — investigate).
- Any intermediate phase that breaks an unrelated passing test signals regression.
- A test that only appears at its passing phase can't perform either of those signals.

## Phase 0 is the default

`Writable at: Phase 0` means "writable today against the current stack, before any plan code lands." Phase 0 rows do NOT need a rationale entry — they're the default and need no justification. We only require rationale when a test will be authored AFTER some plan implementation has happened (Writable at: Phase 1+). This keeps the rationale subsection from filling with "trivially writable today" boilerplate.

## Honest trajectory shapes

- **Regression tests for reported bugs** — `Writable at: Phase 0`. The stack runs; the bug is reproducible today; no plan code is needed to author the test. Passes at = the phase that lands the fix.
- **End-to-end scenarios via HTTP/WS** — `Writable at: Phase 0` if the test is a script hitting current endpoints (404 today is real-red, the test stays red until the endpoint lands). Move later only if authoring requires a not-yet-existing TypeScript symbol.
- **Reconstruction / persistence tests** — `Writable at: Phase 0` if the test is a "restart-and-check" script. Today fails because state doesn't persist; that's real-red. Move later only if the assertion references a not-yet-existing symbol.
- **Unit tests for new code** — `Writable at = Passes at` is legitimate when the test's subject is a TypeScript symbol (schema file, new function, new enum value) introduced in that phase — the test file would not compile today.
- **Grep-the-thing-is-gone tests** — `Writable at: Phase 0` (the old identifier exists today; grep finds it, which is the red state). Passes at = the phase that removes the identifier.

## The authoring question

For every row, challenge it: *"could this test be authored earlier than the phase that makes it pass?"* If yes, `Writable at` must point to that earlier phase. If no, document why (the test's own subject doesn't exist yet).

## Phase Verification structure

The Writable-phase's Verification block adds a `(write red)` item that commits the test against the current implementation and asserts the expected failure symptom. The Passes-phase's Verification block keeps its `(goes green)` item. Both reference the same test ID — the cross-reference validator accepts multiple phase references to one trajectory row.

Example from `table-lifecycle-unification/impl.md`:

```
#### Phase 1 Verification
- [ ] T37 (write red): commit the chip-credit regression harness at scripts/test-harness/table-lifecycle/chip-credit-regression.ts; run against the current stack; assert it fails with no_seat 404. Stays red until Phase 9.

#### Phase 9 Verification
- [ ] T37: harness — create table, sit down, deposit $50; assert credit-chips succeeds first try; chip_balance=50 within 5s of on-chain confirmation.
```

## Concrete example

`table-lifecycle-unification/impl.md` initially put 10 trajectory rows at `Writable at = Passes at`. Audit flagged that several were reported-bug regressions (the $50-stuck chip-credit bug, the 9-seat heads-up bug, the silent-swallow enter bug) whose tests were writable-today against the running stack. Revisions:

- T22 (9-seat heads-up bug) — `Writable at: Phase 6 → Phase 1`, `Passes at: Phase 6`
- T26 (silent-swallow FK on WS enter) — `Writable at: Phase 7 → Phase 1`, `Passes at: Phase 7`
- T37 (the $50-stuck chip-credit bug) — `Writable at: Phase 9 → Phase 1`, `Passes at: Phase 9`
- T35/T36 (reconstruction rebuilds sessions + engine seats) — `Writable at: Phase 9 → Phase 7`, `Passes at: Phase 9`
- T39–T43 (S1 deposit-to-chips, S4 multi-wallet, S5a/b/c withdraw) — `Writable at: Phase 10 → Phase 5`, `Passes at: Phase 10`

The result: ten tests start red at Phase 1 or Phase 5, stay red through intermediate phases (which is the actual signal that intermediate phases haven't regressed the thing downstream), and only go green when their full fix lands. That's the discipline the COC-4 retrospective's verification-debt lesson was pointing at.

## Where this is codified

- Planner skill in `.claude/skills/planner/SKILL.md` (step 6, Test Trajectory authoring) includes the earliest-writable rule in its guidance, plus the impl template now emits `rationale: required` in frontmatter and a `### Trajectory Rationale` subsection.
- This lesson persists the rule across sessions (loaded at `/catchup`).
- **Validator hook `.claude/hooks/validate-impl-structure.js` structurally enforces rationale completeness.** When `rationale: required` is set in impl frontmatter, `validateRationaleCompleteness` parses the `### Trajectory Rationale` subsection and fails the Edit/Write if any trajectory T-ID is missing an entry, or if the subsection contains entries for T-IDs not present in the trajectory table.

## The rationale subsection shape

Below the trajectory table and `### Deferred Verification`:

```markdown
### Trajectory Rationale

**Starting assumption: every test is writable at Phase 0 (pre-plan) against the current stack.** Every row's `Writable at` that is later than Phase 0 must name what prevents earlier authoring. Read the entries together — if multiple rows share the same weak excuse, the plan is over-sequenced.

- **T1** `Writable at: Phase 1` — Subject is Phase 1's rename migration; before Phase 1 there is no migration to exercise.
- **T22** `Writable at: Phase 1` — Bug is reproducible today against the running stack; test is authorable immediately and fails red.
- **T37** `Writable at: Phase 1` — Chip-credit $50-stuck bug reproducible today; harness fails red against the current stack.
```

## What the rationale exposes

Reading the rationales as a set surfaces three failure modes:

1. **Over-sequencing** — multiple rows citing "the fix lands in Phase N" is the tell. Those tests should be earlier.
2. **Fake dependencies** — rationales like "depends on Phase X completing" when the test could honestly run against the current stack with trivially-red output.
3. **Rubber-stamp rows** — rationales that amount to "we chose this phase because it's when we plan to write the test." Weak rationale → move to earlier phase.

## The rationale-quality test

When auditing each rationale, ask: *does this describe a compile error against today's symbols, or does it describe an uninteresting failure mode?* If the latter, the row is a rubber-stamp — move it to Phase 1.

**Legitimate `Writable > Phase 1` (compile error against today's symbols):**
- Test imports a not-yet-exported TypeScript symbol — `import { pokerTableSettingsSchema } from "@numero/types"` when the export doesn't exist. Compile error; the test file cannot be authored.
- Test constructs an object using a constructor signature that doesn't exist — `new PokerV2Room({ settings: {...} })` when the constructor doesn't take `settings`. TypeScript rejects.
- Test asserts against an enum value that doesn't exist — `expect(result.phase).toBe(GamePhase.CollectingBlinds)` when `CollectingBlinds` isn't in the enum.

**Rubber-stamp `Writable > Phase 1` (red for an uninteresting reason — move to Phase 1):**
- "Assertion checks for error code `X` which is introduced in Phase N." → String comparison. Authorable today; fails because today's response is silent-swallow or a different error code. Stays red until the convention lands.
- "Endpoint doesn't exist yet." → HTTP request returns 404. Authorable today; 404-red is real-red.
- "Column doesn't exist yet." → SQL query errors. Authorable today; query-error-red is real-red.
- "Reconstruction code doesn't read from this column yet." → Restart-and-check script. Authorable today; whatever signal emerges is real.
- "Migration script doesn't exist yet." → Migration runner returns "migration NNNN not found." Authorable today.

The line is *can the test source code be authored today*, not *would it fail for a satisfying reason*. Red-for-uninteresting-reason is the whole point of `Writable at = Phase 1`: the test stays red through every intermediate phase, and any phase that turns it green prematurely or breaks an unrelated test surfaces a regression you'd otherwise miss.

## How the enforcement keeps the rule

The validator cannot judge rationale quality — it enforces *presence*. A weak rationale passes the hook but fails the human read-through. The two-layer check: hook enforces structure, trajectory-review pass enforces quality. If a rationale's reason is "because the fix is in Phase N," that's a writing-time signal to move the row to earlier-Writable-at, not a legitimate justification.

## Relationship to other lessons

- `verification-gates-need-adversarial-framing`: that lesson is about each individual gate's quality (can the gate pass for the wrong reason?). This lesson is about the trajectory's temporal honesty (when does the test first become writable?).
- `dont-defer-verification-to-final-phase`: that lesson is about per-phase verification. This lesson extends it — not only must each phase have verification, each test must live from its earliest-possible writable phase.
- `gate-policy-ask-leads-to-universal-deferral`: that lesson was the COC-4 trigger for `ask` → `strict` consideration. This lesson addresses the other half: even with real items in every gate, tests authored-at-fix-time are still a deferral in disguise.
