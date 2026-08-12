# Test Trajectory Parser — Reference

Technical reference for the parser and validator primitives at `apps/indusk-mcp/src/lib/trajectory/`. For the user-facing guide on authoring Test Trajectories in impl documents, see the [Test Trajectory guide](/guide/test-trajectory). For the design rationale, see [`.indusk/planning/tests-first-planning/adr.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/tests-first-planning/adr.md).

## Module layout, and the port

The hooks are plain JavaScript and cannot import a `.ts` module, so every piece of this logic exists twice: once as the TypeScript source, once as a hand-written mirror under `hooks/`. That duplication is structural and is not going away. What keeps it honest is a **one-to-one file correspondence** — each `_`-prefixed hook module mirrors exactly one `src/lib` module, so *"change the TS and every JS port together"* is a rule you follow by reading two filenames rather than by hunting through a thousand-line hook.

| Concern | TypeScript | JS port | Read by |
|---|---|---|---|
| Phase/gate headings, phase ordering, fences | `lib/impl-headings.ts` | `hooks/_impl-headings.js` | every parser |
| Trajectory table + Deferred Verification rows | `lib/trajectory/parser.ts` | `hooks/_trajectory-parser.js` | `check-gates`, `validate-impl-structure` |
| Test Phase 1's register | `lib/trajectory/register.ts` | `hooks/_register.js` | `validate-impl-structure` |
| The validation rules | `lib/trajectory/validator.ts` | inline in `validate-impl-structure.js` | — |

`_`-prefixed modules are **imported by hooks, never registered as hooks**: they need no `settings.json` entry, but they must exist in `.claude/hooks/` or the importing hook dies at load. `globSync("*.js")` copies them on init and update.

::: warning Why the parser is shared rather than copied
`check-gates.js` and `validate-impl-structure.js` each carried their own trajectory-row parser until they were unified, and the copies had already diverged in two ways at once. One kept a local `Phase N` regex, so when `Test Phase N` became a legal cell it read every row as `NaN` and Gate A matched nothing — silently. The other never produced a `state` field at all, which surfaced the moment the two were merged. A duplicated parser does not announce itself when it falls behind; it just stops enforcing. A structural test now asserts there is exactly **one** definition under `hooks/`, because no behavioural test can catch a divergence that has not happened yet.
:::

## Types

```ts
type TrajectoryState =
  | "planned"
  | "writable"
  | "written"
  | "passing"
  | "blocked"
  | "skipped"
  | "unknown";

type TrajectoryKind = "example" | "property" | "contract" | "approval" | "formal";

type TrajectoryScope = "unit" | "integration" | "e2e";

interface TrajectoryRow {
  id: string;               // e.g. "T1", "T2"
  asserts: string;          // one-line description of what the test claims
  writableAt: number;       // phase number at which the test can be authored
  passesAt: number;         // phase number at which the test flips to passing
  state: TrajectoryState;
  kind?: TrajectoryKind;    // optional; present when the header column exists
  scope?: TrajectoryScope;  // optional; present when the header column exists
}

interface DeferredRow {
  name: string;
  reason: string;           // why the item isn't testable here
  wouldRequire: string;     // what would unlock a proper test
  mitigation: string;       // compensating control (alert, review, etc.)
}

interface Trajectory {
  rows: TrajectoryRow[];
  deferred: DeferredRow[];
  present: boolean;         // false if `## Test Trajectory` section is absent
}
```

## Parser

### `parseTrajectory(body: string): Trajectory`

Parses the `## Test Trajectory` section of an impl.md body (content after the frontmatter). Returns an empty trajectory with `present: false` when the section is absent. Never throws.

- **Phase references** parsed as numeric (`"Phase 3"` → `3`). Malformed references yield `NaN`; the temporal-coherence validator catches them with a specific error message.
- **State values** parsed case-insensitively; unknown values become `state: "unknown"` so the validator can flag them separately from missing data.
- **Optional columns** (`Kind`, `Scope`) are detected by header name and populated when present; ignored otherwise.
- **Deferred Verification** subsection parsed as a bulleted list. Each item must have either a single line with em-dash-separated fields (`reason:`, `would require:`, `mitigation:`) or three sub-bullets with those field names.

## Validator Rules

Four rules, composable individually or via the `validateTrajectory` composite.

### `validateTrajectoryPresence(body: string): ValidationError[]`

Rule 1. Returns a single error if the impl body has no `## Test Trajectory` heading. This rule fires first; other rules are skipped if presence fails.

### `validateCrossReferenceIntegrity(body: string, trajectory: Trajectory): ValidationError[]`

Rule 2. For each phase's Verification section, parses checklist items and:

- Extracts test ID references via `/\bT\d+\b/g`. Each must exist in `trajectory.rows`; otherwise an orphan error is emitted.
- Checks for the explicit declaration `(no tests flip at this phase — reason: {reason})`. The reason must be one of: `schema-only`, `delete`, `refactor`, `infra`.
- If a Verification block has no test ID references AND no declaration, emits an error.

### `validateTemporalCoherence(trajectory: Trajectory): ValidationError[]`

Rule 3. For every row, asserts `writableAt ≤ passesAt`. Also catches `NaN` from malformed phase references and emits a specific error for each. A test cannot pass before its dependencies exist; if phases were reordered and this invariant broke, the validator surfaces the mismatched row by ID.

### `validateDeferredCompleteness(trajectory: Trajectory): ValidationError[]`

Rule 4. Every `DeferredRow` must have non-empty `reason`, `wouldRequire`, and `mitigation`. Missing any = error naming the row and the specific fields. The mitigation field is the compensating control — without it, deferring a test means flying blind, which the rule explicitly disallows.

### `validateTrajectory(body: string): ValidationError[]`

Composite. Runs presence → (if present) cross-reference integrity + temporal coherence + deferred completeness. Returns combined errors.

## ValidationError

```ts
interface ValidationError {
  rule:
    | "trajectory-presence"
    | "cross-reference-integrity"
    | "temporal-coherence"
    | "deferred-completeness";
  message: string;
  line?: number;   // rough line in the impl body, when determinable
}
```

Error messages are intentionally verbose — they name the offending row or phase and explain what the author should do. The `rule` discriminant lets callers group or filter errors by kind.

## Hook Integration

The `validate-impl-structure.js` hook (installed into `.claude/hooks/` by `indusk init`) includes a pure-JS port of the validator. The hook runs trajectory validation when either:

- The impl frontmatter contains `trajectory: required`, OR
- The body contains a `## Test Trajectory` heading

Otherwise the hook skips trajectory rules — grandfathered impls without trajectories pass through. The TypeScript source in `apps/indusk-mcp/src/lib/trajectory/` is the canonical reference; the JS port mirrors its behavior and is regenerated by hand when rules change. Tests cover the TS version; the JS port is exercised via end-to-end hook invocations.
