# Test Trajectory Parser — Reference

Technical reference for the parser and validator primitives at `apps/indusk-mcp/src/lib/trajectory/`. For the user-facing guide on authoring Test Trajectories in impl documents, see the [Test Trajectory guide](/guide/test-trajectory). For the design rationale, see [`.indusk/planning/tests-first-planning/adr.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/tests-first-planning/adr.md).

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
