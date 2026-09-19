# Testing

You are working in a project with tests. Follow these patterns.

## Structure

- Arrange-Act-Assert: set up state, do the thing, check the result
- One assertion per test when possible — tests should have one reason to fail
- Name tests with `it("should {expected behavior} when {condition}")` or `test("{what it does}")`
- Group related tests with `describe` blocks

## What to Test

- Test behavior, not implementation — test what the function does, not how
- Test the public API — don't test private methods directly
- Test edge cases: empty inputs, null, undefined, boundary values, error paths
- Test error handling — `expect(() => fn()).toThrow()` for expected failures

## What NOT to Test

- Don't test framework code — you didn't write React's `useState`
- Don't test types — the type checker already does this
- Don't test trivial getters/setters with no logic
- Don't test implementation details that change on refactor

## Mocking

- Mock at system boundaries: HTTP calls, databases, file system, timers
- Don't mock the code you're testing — that's testing the mock
- Use real implementations when possible — especially for integration tests
- Reset mocks between tests: `vi.restoreAllMocks()` in `afterEach`

## Asserting a Behaviour Promise

A behaviour promise (`.indusk/promises/`) is marked by the running code with plain OpenTelemetry — the application imports nothing from InDusk:

```ts
span.setAttribute("indusk.promise", "seat-never-double-booked");
span.setAttribute("indusk.promise.outcome", "upheld"); // or "violated", plus:
// span.addEvent("indusk.promise.violated", { "indusk.promise.symptom": "seat 4 held twice" });
```

Test the mark with the trace-shape helper, passing the promise as its token — the call is then the promise's test link, with no other citation:

```ts
import { captureSpans, expectPromiseUpheld } from "@infinitedusky/indusk-mcp/testing/trace-shape";

const spans = await captureSpans(() => holdSeat(4));
expectPromiseUpheld(spans, "promise: seat-never-double-booked", { parent: "handle-request" });
```

- Assert containment, not a snapshot: extra attributes and child spans never fail it; the marked span being gone does
- `captureSpans` owns the global tracer for the call — it refuses when one is already registered
- `expectPromiseViolated(spans, token)` asserts a violation and returns its symptom

## Common Gotchas

- Flaky tests are worse than no tests — fix or delete them
- Don't use `test.only` in committed code — it silently skips everything else
- `toEqual` for deep comparison, `toBe` for reference equality — know the difference
- Async tests must `await` — a missing await means the test passes before assertions run
- Snapshot tests become noise if updated without review — use sparingly
