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

## Common Gotchas

- Flaky tests are worse than no tests — fix or delete them
- Don't use `test.only` in committed code — it silently skips everything else
- `toEqual` for deep comparison, `toBe` for reference equality — know the difference
- Async tests must `await` — a missing await means the test passes before assertions run
- Snapshot tests become noise if updated without review — use sparingly
